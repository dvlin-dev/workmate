import { describe, it, expect } from 'vitest';
import { RunContext, type Tool } from '@openai/agents-core';
import { WorkmateStore, createEmptyData } from '../src/main/store';
import { MockReminderBridge } from '../src/main/reminders/mock';
import { createWorkmateTools } from '../src/main/agent/tools';
import {
  ReminderPermissionError,
  type AgentContext,
  type ReminderBridge,
  type ReportService,
} from '../src/main/agent/context';
import type { ToolTraceItem } from '../src/shared/types';

const fixedNow = () => new Date(2026, 5, 24, 10, 0, 0);

function makeCtx(overrides?: Partial<AgentContext>) {
  const store = new WorkmateStore({ initial: createEmptyData(), now: fixedNow });
  const trace: ToolTraceItem[] = [];
  const report: ReportService = { generate: async () => '# 周报' };
  const ctx: AgentContext = {
    store,
    reminders: new MockReminderBridge(store),
    report,
    trace,
    ...overrides,
  };
  return { ctx, store, trace };
}

async function invokeTool(
  tools: Tool<AgentContext>[],
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext
) {
  const found = tools.find((t) => t.name === name);
  if (!found || found.type !== 'function') throw new Error(`tool not found: ${name}`);
  const rc = new RunContext(ctx);
  const raw = await found.invoke(rc, JSON.stringify(input));
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

describe('Workmate tools · execute 经 invoke', () => {
  it('create_goal / add_task / complete_task / get_snapshot 串联', async () => {
    const tools = createWorkmateTools();
    const { ctx, store, trace } = makeCtx();

    const { goalId } = await invokeTool(tools, 'create_goal', { title: '登录联调' }, ctx);
    expect(goalId).toBeTruthy();

    const { taskId } = await invokeTool(tools, 'add_task', { goalId, title: '联调接口' }, ctx);
    expect(store.getTask(taskId)?.done).toBe(false);

    await invokeTool(tools, 'complete_task', { taskId }, ctx);
    expect(store.getTask(taskId)?.done).toBe(true);

    const snap = await invokeTool(tools, 'get_snapshot', {}, ctx);
    expect(snap.goals).toHaveLength(1);

    expect(trace.map((t) => t.tool)).toEqual([
      'create_goal',
      'add_task',
      'complete_task',
      'get_snapshot',
    ]);
  });

  it('complete_task 按完成比例推动派生进度', async () => {
    const tools = createWorkmateTools();
    const { ctx, store } = makeCtx();
    const { goalId } = await invokeTool(tools, 'create_goal', { title: '写设计文档' }, ctx);
    await invokeTool(tools, 'add_task', { goalId, title: '列大纲' }, ctx);
    const { taskId } = await invokeTool(tools, 'add_task', { goalId, title: '写初稿' }, ctx);
    expect(store.getSnapshot().goals[0].progress).toBe(0);
    await invokeTool(tools, 'complete_task', { taskId }, ctx);
    expect(store.getSnapshot().goals[0].progress).toBe(50); // 1/2
  });

  it('complete_goal 整体收口到 100/done', async () => {
    const tools = createWorkmateTools();
    const { ctx, store } = makeCtx();
    const { goalId } = await invokeTool(tools, 'create_goal', { title: '订单服务上线' }, ctx);
    await invokeTool(tools, 'add_task', { goalId, title: '灰度' }, ctx);
    const res = await invokeTool(tools, 'complete_goal', { goalId }, ctx);
    expect(res.progress).toBe(100);
    const goal = store.getSnapshot().goals[0];
    expect(goal.status).toBe('done');
    expect(goal.tasks.every((t: { done: boolean }) => t.done)).toBe(true);
  });

  it('find_goal 命中/未命中，命中返回待办清单含 taskId', async () => {
    const tools = createWorkmateTools();
    const { ctx } = makeCtx();
    const { goalId } = await invokeTool(tools, 'create_goal', { title: '做完登录联调' }, ctx);
    const { taskId } = await invokeTool(tools, 'add_task', { goalId, title: '联调接口' }, ctx);
    const hit = await invokeTool(tools, 'find_goal', { query: '登录联调' }, ctx);
    expect(hit.matches).toHaveLength(1);
    expect(hit.matches[0].tasks).toHaveLength(1);
    expect(hit.matches[0].tasks[0].taskId).toBe(taskId);
    const miss = await invokeTool(tools, 'find_goal', { query: '完全不相关的东西' }, ctx);
    expect(miss.matches).toHaveLength(0);
  });

  it('log_event 写进度流', async () => {
    const tools = createWorkmateTools();
    const { ctx, store } = makeCtx();
    const res = await invokeTool(
      tools,
      'log_event',
      { rawText: '今天状态不错', kind: 'note', summary: '随手记一笔' },
      ctx
    );
    expect(res.eventId).toBeTruthy();
    expect(store.getCurrentWeekData().events.some((e) => e.summary === '随手记一笔')).toBe(true);
  });

  it('write_reminder 成功返回 reminderId 且幂等', async () => {
    const tools = createWorkmateTools();
    const { ctx, store } = makeCtx();
    const { goalId } = await invokeTool(tools, 'create_goal', { title: '登录联调' }, ctx);
    const { taskId } = await invokeTool(
      tools,
      'add_task',
      { goalId, title: '提测', due: '2026-06-25T10:00:00.000Z' },
      ctx
    );
    const first = await invokeTool(tools, 'write_reminder', { taskId }, ctx);
    const second = await invokeTool(tools, 'write_reminder', { taskId }, ctx);
    expect(first.reminderId).toBeTruthy();
    expect(second.reminderId).toBe(first.reminderId);
    expect(store.getTask(taskId)?.reminderId).toBe(first.reminderId);
  });

  it('write_reminder 权限被拒 → 不抛错，返回 needsPermission', async () => {
    const tools = createWorkmateTools();
    const denyingBridge: ReminderBridge = {
      writeReminder: async () => {
        throw new ReminderPermissionError();
      },
      writeReminderById: async () => {
        throw new ReminderPermissionError();
      },
    };
    const { ctx, trace } = makeCtx({ reminders: denyingBridge });
    const res = await invokeTool(tools, 'write_reminder', { taskId: 'whatever' }, ctx);
    expect(res.needsPermission).toBe(true);
    expect(res.error).toBeTruthy();
    expect(trace.at(-1)?.summary).toContain('授权');
  });
});
