/**
 * 一轮对话的会话协调器：单窗口单飞（同一时刻只跑一轮）+ 超时 + 用户取消。
 * 从 IPC 层抽出——这是 register.ts 里唯一有状态的逻辑（跨 sendMessage/cancel 两个 handler 的可变状态）。
 *
 * abort signal 单一真相源：本模块独占 signal 的所有权——超时由内部 timer 触发（reason=TimeoutError，
 * 编排器据此抛出、IPC 映射 LLM_TIMEOUT）；cancel() 触发 reason=AbortError（编排器静默收尾、保留部分回复）。
 */

import { runTurnStream, AGENT_TIMEOUT_MS } from './orchestrator';
import type { RunTurnDeps, RunTurnResult, StreamEvent } from './orchestrator';

type RunStream = (
  text: string,
  deps: RunTurnDeps,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal
) => Promise<RunTurnResult>;

function timeoutReason(): Error {
  return Object.assign(new Error('LLM 响应超时'), { name: 'TimeoutError' });
}
function cancelReason(): Error {
  return Object.assign(new Error('用户取消'), { name: 'AbortError' });
}

/** 是否为超时（→ IPC 映射 LLM_TIMEOUT）；用户取消是 AbortError、由编排器静默收尾、不算超时。 */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

export interface TurnSession {
  /** 跑一轮：建 signal + 武装超时 → runTurnStream；超时会抛 TimeoutError。 */
  run(text: string, onEvent: (event: StreamEvent) => void): Promise<RunTurnResult>;
  /** 取消进行中的一轮；无在途返回 false。 */
  cancel(): boolean;
}

export function createTurnSession(
  deps: RunTurnDeps,
  options: { timeoutMs?: number; run?: RunStream } = {}
): TurnSession {
  const runStream = options.run ?? runTurnStream;
  const timeoutMs = options.timeoutMs ?? AGENT_TIMEOUT_MS;
  let current: AbortController | null = null;

  return {
    async run(text, onEvent) {
      const controller = new AbortController();
      current = controller;
      const timer = setTimeout(() => controller.abort(timeoutReason()), timeoutMs);
      try {
        return await runStream(text, deps, onEvent, controller.signal);
      } finally {
        clearTimeout(timer);
        if (current === controller) current = null;
      }
    },
    cancel() {
      if (!current) return false;
      current.abort(cancelReason());
      return true;
    },
  };
}
