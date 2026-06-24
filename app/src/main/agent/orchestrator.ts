/**
 * 编排器：一次对话 = 落原始事件 → run(agent, [user], {maxTurns:MAX_TURNS, context}) → {reply,snapshot,toolTrace}。
 * 提供非流式 runTurn（测试用）与流式 runTurnStream（IPC 用，逐字 + 工具足迹增量）。
 * 真相源：docs/reference/agent-runtime.md §5。
 */

import { run, user, MaxTurnsExceededError } from '@openai/agents-core';
import { hasApiKey, type AppConfig } from '@shared/config';
import type { Snapshot, ToolTraceItem } from '@shared/types';
import type { WorkmateStore } from '../store';
import type {
  AgentContext,
  ReminderBridge,
  ReportService,
  SkillsPort,
  ToolLogger,
  Workspace,
} from './context';
import { buildAgent } from './agent';
import { getWorkspace } from './workspace';
import { MissingApiKeyError } from './model';

/** 开放任务（写多文件/跑命令）需要更多轮，从 8 提到 30；doom-loop 由 agents-core 兜底 */
export const MAX_TURNS = 30;
/** 主对话单轮超时；超时让 agents-core 抛 AbortError，IPC 层映射为 LLM_TIMEOUT */
export const AGENT_TIMEOUT_MS = 180_000;

const MAX_TURNS_FALLBACK = '这次要做的步骤有点多，我先把已处理的更新好了，需要的话再说一次 🙏';

export interface RunTurnDeps {
  store: WorkmateStore;
  reminders: ReminderBridge;
  report: ReportService;
  /** 不传则取 store.getConfig() */
  config?: AppConfig;
  /** 仅供单测显式使用确定性 mock；运行时不传 */
  allowMockModel?: boolean;
  /** Skills 端口（可选；无则不注入技能能力） */
  skills?: SkillsPort;
  /** 测试可注入临时 workspace，避免依赖 Electron app.getPath */
  workspace?: Workspace;
  /** 工具执行日志（运行时由 IPC 注入文件实现；测试不传则不落盘） */
  toolLogger?: ToolLogger;
}

export interface RunTurnResult {
  reply: string;
  snapshot: Snapshot;
  toolTrace: ToolTraceItem[];
}

/** 流式增量回调事件 */
export type StreamEvent =
  | { kind: 'text'; delta: string }
  | { kind: 'tool'; item: ToolTraceItem }
  | { kind: 'snapshot'; snapshot: Snapshot };

function prepare(text: string, deps: RunTurnDeps) {
  const { store, reminders, report, skills } = deps;
  const config = deps.config ?? store.getConfig();
  if (!hasApiKey(config) && !deps.allowMockModel) {
    throw new MissingApiKeyError();
  }
  // 录入即落原始事件（周报原料的一部分；即使 agent 失败也不丢）
  store.appendEvent({ kind: 'note', rawText: text, summary: text });
  const snapshot = store.getSnapshot();
  const trace: ToolTraceItem[] = [];
  const context: AgentContext = {
    store,
    reminders,
    report,
    trace,
    skills,
    workspace: deps.workspace ?? getWorkspace(),
    toolLogger: deps.toolLogger,
  };
  const skillsBlock = skills?.getAvailableSkillsPrompt() ?? '';
  const agent = buildAgent(config, snapshot, skillsBlock, { allowMockModel: deps.allowMockModel });
  return { store, agent, trace, context };
}

/** 非流式（单测用） */
export async function runTurn(text: string, deps: RunTurnDeps): Promise<RunTurnResult> {
  const { store, agent, trace, context } = prepare(text, deps);

  let reply: string;
  try {
    const result = await run(agent, [user(text)], {
      maxTurns: MAX_TURNS,
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      context,
    });
    reply = (result.finalOutput ?? '').toString();
  } catch (error) {
    if (error instanceof MaxTurnsExceededError) {
      reply = MAX_TURNS_FALLBACK;
    } else {
      throw error;
    }
  }

  return { reply, snapshot: store.getSnapshot(), toolTrace: trace };
}

/**
 * 流式：逐字 onEvent('text')，工具执行后 onEvent('tool')；返回最终结果。
 * signal 由调用方提供（叠加超时 + 用户取消）。注意：agents-core 在 abort 时是**优雅 close 流**
 * （不抛错、stream.completed 仍 resolve），所以超时/取消必须在循环结束后查 signal.aborted 才能识别。
 */
export async function runTurnStream(
  text: string,
  deps: RunTurnDeps,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal
): Promise<RunTurnResult> {
  const { store, agent, trace, context } = prepare(text, deps);

  let reply = '';
  const emitted = { n: 0 };
  const flushTrace = () => {
    let advanced = false;
    while (emitted.n < trace.length) {
      onEvent({ kind: 'tool', item: trace[emitted.n]! });
      emitted.n += 1;
      advanced = true;
    }
    // 有新工具执行完 → store 可能已被改写，立刻下发最新快照让看板实时刷新（不等整轮结束）
    if (advanced) onEvent({ kind: 'snapshot', snapshot: store.getSnapshot() });
  };

  try {
    const stream = await run(agent, [user(text)], {
      maxTurns: MAX_TURNS,
      signal,
      context,
      stream: true,
    });

    for await (const event of stream) {
      flushTrace(); // 工具刚执行完就把足迹推给前端
      if (event.type === 'raw_model_stream_event' && event.data?.type === 'output_text_delta') {
        const delta = event.data.delta;
        if (delta) {
          reply += delta;
          onEvent({ kind: 'text', delta });
        }
      }
    }
    await stream.completed;
    flushTrace();

    if (signal.aborted) {
      const reason = signal.reason as { name?: string } | undefined;
      if (reason?.name === 'TimeoutError') {
        // 超时：抛 TimeoutError 让 IPC 层映射为 LLM_TIMEOUT（兑现 §5 降级契约）
        throw Object.assign(new Error('LLM 响应超时'), { name: 'TimeoutError' });
      }
      // 用户取消：保留已流式收到的部分文本，静默收尾
      reply = reply || '（已停止）';
    } else {
      reply = (stream.finalOutput ?? reply).toString() || reply;
    }
  } catch (error) {
    if (error instanceof MaxTurnsExceededError) {
      reply = reply || MAX_TURNS_FALLBACK;
    } else {
      throw error;
    }
  }

  return { reply, snapshot: store.getSnapshot(), toolTrace: trace };
}
