import { create } from 'zustand';
import type { AgentChunk, SendMessageResult } from '@shared/ipc';
import type { ToolTraceItem } from '@shared/types';
import { cancelAgent, onAgentChunk, sendMessage } from '../lib/api';
import { chatErrorText } from '../lib/errors';
import { useSnapshotStore } from './useSnapshotStore';

/**
 * 一条助手消息的**有序**内容片段（参考 moryflow 的 UIMessage.parts 模型）：
 * 文字段与工具足迹按流式到达的真实顺序交错，保证"前言 → 工具 → 中间话 → 工具 → 收尾"自上而下展示，
 * 而不是把所有文字拼一坨、所有工具堆一坨。
 */
export type MessagePart =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; item: ToolTraceItem };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** 有序片段，严格按到达顺序 */
  parts: MessagePart[];
  pending?: boolean;
  /** 错误提示（与 parts 分离，保留已流式收到的部分） */
  errorText?: string;
  /** 该助手消息对应的用户输入，用于重试 */
  sourceText?: string;
}

/** 取一条消息的纯文本（所有 text 段拼接）——复制、用户消息显示、兜底用 */
export function messageText(m: ChatMessage): string {
  let out = '';
  for (const p of m.parts) if (p.kind === 'text') out += p.text;
  return out;
}

interface ChatState {
  messages: ChatMessage[];
  sending: boolean;
  activeId: string | null;
  send: (text: string) => Promise<void>;
  retry: (assistantId: string) => Promise<void>;
  cancel: () => Promise<void>;
  clear: () => void;
  applyChunk: (chunk: AgentChunk) => void;
  subscribeChunks: () => () => void;
}

const newId = () => crypto.randomUUID();

function patch(messages: ChatMessage[], id: string, fn: (m: ChatMessage) => ChatMessage) {
  return messages.map((m) => (m.id === id ? fn(m) : m));
}

/** 定稿：流式已构建有序 parts，这里只做收尾兜底（取消/空流/非流式路径） */
function finalizeAssistant(m: ChatMessage, res: SendMessageResult): ChatMessage {
  const parts = m.parts.slice();
  // 流式正常时工具已作为 chunk 进入 parts；仅当一条都没有才用最终结果补（保持工具在前）
  if (res.toolTrace.length && !parts.some((p) => p.kind === 'tool')) {
    for (const item of res.toolTrace) parts.push({ kind: 'tool', item });
  }
  // 一句收尾文字始终存在（取消前没流出文字时用 reply，否则给个默认）
  if (!parts.some((p) => p.kind === 'text')) {
    parts.push({ kind: 'text', text: res.reply || '搞定 👍' });
  }
  return { ...m, parts, pending: false, errorText: undefined };
}

export const useChatStore = create<ChatState>((set, get) => {
  // 真正驱动一轮：把流式增量按序写进 assistantId 的 parts，结束后定稿
  const runChat = async (assistantId: string, text: string) => {
    set({ sending: true, activeId: assistantId });
    try {
      const res = await sendMessage(text);
      useSnapshotStore.getState().setSnapshot(res.snapshot);
      set((s) => ({
        sending: false,
        activeId: null,
        messages: patch(s.messages, assistantId, (m) => finalizeAssistant(m, res)),
      }));
    } catch (error) {
      const errorText = chatErrorText(error);
      set((s) => ({
        sending: false,
        activeId: null,
        // 保留已流式收到的部分 parts，把错误作为附加状态
        messages: patch(s.messages, assistantId, (m) => ({ ...m, pending: false, errorText })),
      }));
    }
  };

  return {
    messages: [],
    sending: false,
    activeId: null,

    subscribeChunks: () => onAgentChunk((chunk) => get().applyChunk(chunk)),

    applyChunk: (chunk) => {
      // 看板快照：tool 改写 store 后实时下发，立刻刷新右侧面板（不进对话 parts）
      if (chunk.kind === 'snapshot') {
        useSnapshotStore.getState().setSnapshot(chunk.snapshot);
        return;
      }
      const id = get().activeId;
      if (!id) return;
      set((s) => ({
        messages: patch(s.messages, id, (m) => {
          const parts = m.parts.slice();
          if (chunk.kind === 'text') {
            // 文字增量并入末尾的文字段（没有就新建）——连续文字合并，遇工具自然断开
            const last = parts[parts.length - 1];
            if (last?.kind === 'text') {
              parts[parts.length - 1] = { kind: 'text', text: last.text + chunk.delta };
            } else {
              parts.push({ kind: 'text', text: chunk.delta });
            }
          } else {
            // 工具足迹作为新的一段追加，保留它相对文字的真实位置
            parts.push({ kind: 'tool', item: chunk.item });
          }
          return { ...m, parts };
        }),
      }));
    },

    send: async (raw) => {
      const text = raw.trim();
      if (!text || get().sending) return;
      const assistantId = newId();
      set((s) => ({
        messages: [
          ...s.messages,
          { id: newId(), role: 'user', parts: [{ kind: 'text', text }] },
          { id: assistantId, role: 'assistant', parts: [], pending: true, sourceText: text },
        ],
      }));
      await runChat(assistantId, text);
    },

    retry: async (assistantId) => {
      if (get().sending) return;
      const msg = get().messages.find((m) => m.id === assistantId);
      if (!msg?.sourceText) return;
      set((s) => ({
        messages: patch(s.messages, assistantId, (m) => ({
          ...m,
          parts: [],
          errorText: undefined,
          pending: true,
        })),
      }));
      await runChat(assistantId, msg.sourceText);
    },

    cancel: async () => {
      if (!get().sending) return;
      try {
        await cancelAgent();
      } catch {
        /* 取消失败也无妨：超时兜底会收尾 */
      }
      // 在途的 sendMessage 会带着部分回复 resolve，由 runChat 定稿
    },

    clear: () => {
      if (get().sending) void get().cancel();
      set({ messages: [], activeId: null, sending: false });
    },
  };
});
