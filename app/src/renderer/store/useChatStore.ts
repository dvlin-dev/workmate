import { create } from 'zustand';
import type { AgentChunk } from '@shared/ipc';
import type { ToolTraceItem } from '@shared/types';
import { ApiError, cancelAgent, onAgentChunk, sendMessage } from '../lib/api';
import { useSnapshotStore } from './useSnapshotStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolTrace?: ToolTraceItem[];
  pending?: boolean;
  /** 错误提示（与 text 分离，保留已流式收到的部分） */
  errorText?: string;
  /** 该助手消息对应的用户输入，用于重试 */
  sourceText?: string;
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

export const useChatStore = create<ChatState>((set, get) => {
  // 真正驱动一轮：把流式增量写进 assistantId，结束后定稿
  const runChat = async (assistantId: string, text: string) => {
    set({ sending: true, activeId: assistantId });
    try {
      const res = await sendMessage(text);
      useSnapshotStore.getState().setSnapshot(res.snapshot);
      set((s) => ({
        sending: false,
        activeId: null,
        messages: patch(s.messages, assistantId, (m) => ({
          ...m,
          text: res.reply || m.text || '搞定 👍',
          toolTrace: res.toolTrace.length ? res.toolTrace : m.toolTrace,
          pending: false,
          errorText: undefined,
        })),
      }));
    } catch (error) {
      const errorText =
        error instanceof ApiError && error.code === 'LLM_TIMEOUT'
          ? '搭子有点忙（响应超时），稍后再试～'
          : error instanceof ApiError && error.code === 'CONFIG_REQUIRED'
            ? '请先在「设置」里填写 apiKey，再发送消息。'
          : error instanceof ApiError && error.code === 'LLM_ERROR'
            ? 'LLM 暂时不可用，去「设置」检查 baseURL / apiKey / model。'
            : `出错了：${error instanceof Error ? error.message : '未知错误'}`;
      set((s) => ({
        sending: false,
        activeId: null,
        // 保留已流式收到的部分文本，把错误作为附加状态
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
      const id = get().activeId;
      if (!id) return;
      set((s) => ({
        messages: patch(s.messages, id, (m) =>
          chunk.kind === 'text'
            ? { ...m, text: m.text + chunk.delta }
            : { ...m, toolTrace: [...(m.toolTrace ?? []), chunk.item] }
        ),
      }));
    },

    send: async (raw) => {
      const text = raw.trim();
      if (!text || get().sending) return;
      const assistantId = newId();
      set((s) => ({
        messages: [
          ...s.messages,
          { id: newId(), role: 'user', text },
          { id: assistantId, role: 'assistant', text: '', pending: true, toolTrace: [], sourceText: text },
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
          text: '',
          toolTrace: [],
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
