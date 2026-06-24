import { describe, it, expect, vi } from 'vitest';
import type { Snapshot } from '../src/shared/types';
import { createTurnSession, isTimeoutError } from '../src/main/agent/turn-session';
import type { RunTurnDeps, RunTurnResult, StreamEvent } from '../src/main/agent/orchestrator';

const deps = {} as RunTurnDeps; // 注入的 runner 忽略 deps
const noop = (_e: StreamEvent) => {};
const result = (reply: string): RunTurnResult => ({
  reply,
  snapshot: {} as Snapshot,
  toolTrace: [],
});

describe('turn-session · 单飞 + 超时/取消 + signal 所有权', () => {
  it('isTimeoutError 只认 TimeoutError', () => {
    expect(isTimeoutError(Object.assign(new Error('t'), { name: 'TimeoutError' }))).toBe(true);
    expect(isTimeoutError(new Error('x'))).toBe(false);
    expect(isTimeoutError(Object.assign(new Error('c'), { name: 'AbortError' }))).toBe(false);
  });

  it('超时：内部 timer abort 自己的 signal（reason=TimeoutError），由 runner 据此抛出', async () => {
    let captured: AbortSignal | undefined;
    const run = (_t: string, _d: RunTurnDeps, _o: (e: StreamEvent) => void, signal: AbortSignal) =>
      new Promise<RunTurnResult>((_resolve, reject) => {
        captured = signal;
        signal.addEventListener('abort', () => reject(signal.reason));
      });
    const session = createTurnSession(deps, { timeoutMs: 5, run });

    await expect(session.run('hi', noop)).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(captured?.aborted).toBe(true);
    expect(session.cancel()).toBe(false); // 已结束，无在途
  });

  it('取消：cancel() abort 自己的 signal（reason=AbortError），runner 静默收尾', async () => {
    const run = (_t: string, _d: RunTurnDeps, _o: (e: StreamEvent) => void, signal: AbortSignal) =>
      new Promise<RunTurnResult>((resolve) => {
        signal.addEventListener('abort', () => resolve(result('（已停止）')));
      });
    const session = createTurnSession(deps, { timeoutMs: 10_000, run });

    const pending = session.run('hi', noop);
    await Promise.resolve(); // 让 runner 先订阅 abort
    expect(session.cancel()).toBe(true);
    expect((await pending).reply).toBe('（已停止）');
    expect(session.cancel()).toBe(false);
  });

  it('正常完成：清空 timer 与当前会话，cancel() 返回 false', async () => {
    const run = vi.fn(async () => result('ok'));
    const session = createTurnSession(deps, { run });
    expect((await session.run('hi', noop)).reply).toBe('ok');
    expect(run).toHaveBeenCalledTimes(1);
    expect(session.cancel()).toBe(false);
  });
});
