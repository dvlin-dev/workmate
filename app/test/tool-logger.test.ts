import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RunContext, type Tool } from '@openai/agents-core';
import { createFileToolLogger } from '../src/main/agent/tool-logger';
import { WorkmateStore, createEmptyData } from '../src/main/store';
import { MockReminderBridge } from '../src/main/reminders/mock';
import { createWorkmateTools } from '../src/main/agent/tools';
import type {
  AgentContext,
  ReminderBridge,
  ReportService,
  ToolLogger,
  ToolLogRecord,
} from '../src/main/agent/context';
import { ReminderPermissionError } from '../src/main/reminders/errors';

const fixedNow = () => new Date(2026, 5, 24, 10, 0, 0);

/** 内存 ToolLogger，便于断言每次工具执行的埋点 */
function memLogger(): ToolLogger & { records: ToolLogRecord[] } {
  const records: ToolLogRecord[] = [];
  return {
    dir: '(memory)',
    records,
    record: (r) => records.push(r),
    readRecent: (limit = 100) => records.slice(-limit).reverse(),
  };
}

function ctxWith(logger: ToolLogger, reminders?: ReminderBridge): AgentContext {
  const store = new WorkmateStore({ initial: createEmptyData(), now: fixedNow });
  return {
    store,
    reminders: reminders ?? new MockReminderBridge(store),
    report: { generate: async () => '# 周报' } as ReportService,
    trace: [],
    toolLogger: logger,
  };
}

async function invokeTool(
  tools: Tool<AgentContext>[],
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext
) {
  const found = tools.find((t) => t.name === name);
  if (!found || found.type !== 'function') throw new Error(`tool not found: ${name}`);
  const raw = await found.invoke(new RunContext(ctx), JSON.stringify(input));
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

describe('ToolLogger · 文件实现', () => {
  it('record → readRecent 往返（最新在前）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'workmate-log-'));
    const logger = createFileToolLogger({ dir });
    logger.record({ ts: '2026-06-24T00:00:00Z', tool: 'a', status: 'ok', durationMs: 1 });
    logger.record({
      ts: '2026-06-24T00:00:01Z',
      tool: 'b',
      status: 'error',
      durationMs: 2,
      error: 'boom',
    });
    const recent = logger.readRecent();
    expect(recent).toHaveLength(2);
    expect(recent[0].tool).toBe('b');
    expect(recent[0].status).toBe('error');
    expect(recent[0].error).toBe('boom');
  });

  it('超过阈值滚动，仍保留最新一条', () => {
    const dir = mkdtempSync(join(tmpdir(), 'workmate-log-'));
    const logger = createFileToolLogger({ dir, maxBytes: 200 });
    for (let i = 0; i < 50; i += 1) {
      logger.record({ ts: 't', tool: `tool${i}`, status: 'ok', durationMs: i });
    }
    const recent = logger.readRecent();
    expect(recent.length).toBeGreaterThan(0);
    expect(recent[0].tool).toBe('tool49');
  });
});

describe('defineTool · 执行埋点（所有工具自动落日志）', () => {
  it('成功调用记 status=ok，并带入参', async () => {
    const logger = memLogger();
    const ctx = ctxWith(logger);
    const tools = createWorkmateTools();
    await invokeTool(tools, 'create_goal', { title: '登录联调' }, ctx);
    const rec = logger.records.find((r) => r.tool === 'create_goal');
    expect(rec?.status).toBe('ok');
    expect(rec?.input).toEqual({ title: '登录联调' });
    expect(typeof rec?.durationMs).toBe('number');
  });

  it('软失败（write_reminder 权限被拒）记 status=error', async () => {
    const logger = memLogger();
    const deny: ReminderBridge = {
      writeReminderById: async () => {
        throw new ReminderPermissionError();
      },
    };
    const ctx = ctxWith(logger, deny);
    const tools = createWorkmateTools();
    await invokeTool(tools, 'write_reminder', { taskId: 'x' }, ctx);
    const rec = logger.records.find((r) => r.tool === 'write_reminder');
    expect(rec?.status).toBe('error');
    expect(rec?.error).toBeTruthy();
  });
});
