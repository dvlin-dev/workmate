/**
 * IPC 注册：把主进程能力按 ipc-contract.md 暴露给渲染层。
 * 每个 handler 返回 AppResult；失败转错误信封，不抛到渲染层。
 */

import { app, ipcMain } from 'electron';
import { generateText } from 'ai';
import { CH } from '@shared/ipc';
import type { AppResult, SendMessageResult } from '@shared/ipc';
import type { AppConfig } from '@shared/config';
import type { Snapshot } from '@shared/types';
import type { WorkmateStore } from '../store';
import type { ReminderBridge, ReportService } from '../agent/context';
import { ReminderPermissionError } from '../agent/context';
import { runTurnStream } from '../agent/orchestrator';
import { buildRawModel } from '../agent/model';
import { asObjectRecord, broadcastToAllWindows, errorMessage, fail, ok } from './shared';

export interface IpcDeps {
  store: WorkmateStore;
  reminders: ReminderBridge;
  report: ReportService;
}

const TEST_TIMEOUT_MS = 30_000;

function isTimeout(error: unknown): boolean {
  const name = error instanceof Error ? error.name : '';
  return name === 'AbortError' || name === 'TimeoutError';
}

export function registerIpc(deps: IpcDeps): void {
  const { store, reminders, report } = deps;

  ipcMain.handle(
    CH.ping,
    (): AppResult<{ pong: true; version: string }> =>
      ok({ pong: true as const, version: app.getVersion() })
  );

  ipcMain.handle(CH.snapshotGet, (): AppResult<Snapshot> => ok(store.getSnapshot()));

  ipcMain.handle(CH.agentSendMessage, async (_e, payload): Promise<AppResult<SendMessageResult>> => {
    const text = String(asObjectRecord(payload).text ?? '').trim();
    if (!text) return fail('BAD_INPUT', '消息不能为空');
    try {
      const result = await runTurnStream(text, { store, reminders, report }, (chunk) => {
        broadcastToAllWindows(CH.agentChunk, chunk); // 逐字 / 工具足迹增量
      });
      broadcastToAllWindows(CH.snapshotChanged, result.snapshot);
      return ok(result);
    } catch (error) {
      // 即使失败也补发快照：tool 可能已落盘改动，保证看板与磁盘一致
      broadcastToAllWindows(CH.snapshotChanged, store.getSnapshot());
      const code = isTimeout(error) ? 'LLM_TIMEOUT' : 'LLM_ERROR';
      return fail(code, errorMessage(error) || '搭子有点忙，稍后再试');
    }
  });

  // ── 看板人工操作（人机协作）：mutate → 广播 → 返回最新快照 ───────
  const boardOp = (mutate: () => void): AppResult<Snapshot> => {
    try {
      mutate();
      const snapshot = store.getSnapshot();
      broadcastToAllWindows(CH.snapshotChanged, snapshot);
      return ok(snapshot);
    } catch (error) {
      return fail('NOT_FOUND', errorMessage(error) || '操作失败');
    }
  };

  ipcMain.handle(CH.boardToggleTask, (_e, payload): AppResult<Snapshot> => {
    const taskId = String(asObjectRecord(payload).taskId ?? '');
    if (!taskId) return fail('BAD_INPUT', '缺少 taskId');
    return boardOp(() => store.toggleTask(taskId));
  });

  ipcMain.handle(CH.boardAddGoal, (_e, payload): AppResult<Snapshot> => {
    const title = String(asObjectRecord(payload).title ?? '').trim();
    if (!title) return fail('BAD_INPUT', '目标标题不能为空');
    return boardOp(() => store.createGoal(title));
  });

  ipcMain.handle(CH.boardAddTask, (_e, payload): AppResult<Snapshot> => {
    const raw = asObjectRecord(payload);
    const goalId = String(raw.goalId ?? '');
    const title = String(raw.title ?? '').trim();
    const due = typeof raw.due === 'string' && raw.due ? raw.due : undefined;
    if (!goalId || !title) return fail('BAD_INPUT', '缺少 goalId 或标题');
    return boardOp(() => store.addTask(goalId, title, due));
  });

  ipcMain.handle(CH.boardSetProgress, (_e, payload): AppResult<Snapshot> => {
    const raw = asObjectRecord(payload);
    const goalId = String(raw.goalId ?? '');
    const progress = Number(raw.progress);
    if (!goalId || Number.isNaN(progress)) return fail('BAD_INPUT', '缺少 goalId 或进度值');
    return boardOp(() => store.updateProgress(goalId, progress, '手动调整进度'));
  });

  ipcMain.handle(CH.boardClearWeek, (): AppResult<Snapshot> =>
    boardOp(() => store.clearCurrentWeek())
  );

  ipcMain.handle(CH.reportGenerate, async (_e, payload): Promise<AppResult<{ markdown: string }>> => {
    const weekOf = asObjectRecord(payload).weekOf;
    try {
      const markdown = await report.generate(typeof weekOf === 'string' ? weekOf : undefined);
      return ok({ markdown });
    } catch (error) {
      return fail('LLM_ERROR', errorMessage(error) || '周报生成失败');
    }
  });

  ipcMain.handle(CH.configGet, (): AppResult<AppConfig> => ok(store.getConfig()));

  ipcMain.handle(CH.configSet, (_e, payload): AppResult<AppConfig> => {
    try {
      return ok(store.setConfig(asObjectRecord(payload)));
    } catch (error) {
      return fail('BAD_INPUT', errorMessage(error) || '配置无效');
    }
  });

  ipcMain.handle(CH.configTestProvider, async (_e, payload): Promise<AppResult<{ message: string }>> => {
    // 无状态测试：用表单入参构建临时模型，不读 store、不落盘（测试与保存解耦）
    const raw = asObjectRecord(payload);
    const llm = {
      baseURL: String(raw.baseURL ?? '').trim(),
      apiKey: String(raw.apiKey ?? '').trim(),
      model: String(raw.model ?? '').trim(),
    };
    if (!llm.apiKey) return fail('BAD_INPUT', '请先填写 apiKey');
    if (!llm.baseURL || !llm.model) return fail('BAD_INPUT', '请填写 baseURL 与 model');
    try {
      const { text } = await generateText({
        model: buildRawModel(llm),
        prompt: 'Say "Test successful"',
        abortSignal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      });
      return ok({ message: text.trim() || '连接成功' });
    } catch (error) {
      const code = isTimeout(error) ? 'LLM_TIMEOUT' : 'LLM_ERROR';
      return fail(code, errorMessage(error) || '连接失败，请检查 baseURL / apiKey / model');
    }
  });

  ipcMain.handle(CH.remindersWrite, async (_e, payload): Promise<AppResult<{ reminderId: string }>> => {
    const taskId = String(asObjectRecord(payload).taskId ?? '');
    if (!taskId) return fail('BAD_INPUT', '缺少 taskId');
    try {
      const reminderId = await reminders.writeReminderById(taskId);
      return ok({ reminderId });
    } catch (error) {
      if (error instanceof ReminderPermissionError) {
        return fail('REMINDER_PERMISSION_DENIED', error.message);
      }
      return fail('REMINDER_FAILED', errorMessage(error) || '写入提醒事项失败');
    }
  });
}
