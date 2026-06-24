import { describe, it, expect } from 'vitest';
import { WorkmateStore, createEmptyData } from '../src/main/store';
import { MockReminderBridge } from '../src/main/reminders/mock';
import {
  runTurn,
  runTurnStream,
  type RunTurnDeps,
  type StreamEvent,
} from '../src/main/agent/orchestrator';
import type { ReportService } from '../src/main/agent/context';

function makeDeps(options: { allowMockModel?: boolean } = {}): {
  store: WorkmateStore;
  deps: RunTurnDeps;
  reportCalls: () => number;
} {
  const now = () => new Date(2026, 5, 24, 10, 0, 0);
  const store = new WorkmateStore({ initial: createEmptyData(), now });
  let reportCalls = 0;
  const report: ReportService = {
    generate: async () => {
      reportCalls += 1;
      return '# 本周周报\n\n## 本周完成\n- 登录联调推进';
    },
  };
  const deps: RunTurnDeps = {
    store,
    reminders: new MockReminderBridge(store),
    report,
    allowMockModel: options.allowMockModel ?? true,
  };
  return { store, deps, reportCalls: () => reportCalls };
}

describe('显式 mock 闭环（heuristic mock 驱动 runTurn）', () => {
  it('未显式允许 mock 时，无 apiKey 不跑 agent，也不落原始事件', async () => {
    const { store, deps } = makeDeps({ allowMockModel: false });

    await expect(runTurn('这周要做完登录联调', deps)).rejects.toThrow('请先配置 apiKey');

    expect(store.getSnapshot().goals).toHaveLength(0);
    expect(store.getCurrentWeekData().events).toHaveLength(0);
  });

  it('计划输入 → create_goal，看板出现目标', async () => {
    const { store, deps } = makeDeps();
    const res = await runTurn('这周要做完登录联调', deps);

    const snap = store.getSnapshot();
    expect(snap.goals).toHaveLength(1);
    expect(snap.goals[0].title).toContain('登录联调');
    expect(res.toolTrace.map((t) => t.tool)).toContain('create_goal');
    expect(res.reply.length).toBeGreaterThan(0);
  });

  it('进展输入 → find_goal + update_progress 改进度', async () => {
    const { store, deps } = makeDeps();
    await runTurn('这周要做完登录联调', deps);
    const res = await runTurn('登录联调通了', deps);

    const goal = store.getSnapshot().goals[0];
    expect(goal.progress).toBeGreaterThan(0);
    const tools = res.toolTrace.map((t) => t.tool);
    expect(tools).toContain('find_goal');
    expect(tools).toContain('update_progress');
  });

  it('"生成周报" → generate_report 被调用', async () => {
    const { deps, reportCalls } = makeDeps();
    const res = await runTurn('帮我生成这周的周报', deps);
    expect(reportCalls()).toBe(1);
    expect(res.toolTrace.map((t) => t.tool)).toContain('generate_report');
  });

  it('每次录入都落一条 note 原始事件（周报原料不丢）', async () => {
    const { store, deps } = makeDeps();
    await runTurn('这周要做完登录联调', deps);
    const notes = store.getCurrentWeekData().events.filter((e) => e.kind === 'note');
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0].rawText).toBe('这周要做完登录联调');
  });

  it('runTurnStream 逐字流式 + 工具足迹增量，拼接增量=最终回复', async () => {
    const { store, deps } = makeDeps();
    const events: StreamEvent[] = [];
    const res = await runTurnStream('这周要做完登录联调', deps, (e) => events.push(e));

    expect(store.getSnapshot().goals).toHaveLength(1);
    const textEvents = events.filter((e): e is Extract<StreamEvent, { kind: 'text' }> => e.kind === 'text');
    const toolEvents = events.filter((e): e is Extract<StreamEvent, { kind: 'tool' }> => e.kind === 'tool');
    expect(textEvents.length).toBeGreaterThan(0);
    expect(toolEvents.map((e) => e.item.tool)).toContain('create_goal');
    expect(res.reply.length).toBeGreaterThan(0);
    expect(textEvents.map((e) => e.delta).join('')).toBe(res.reply);
  });
});
