import { create } from 'zustand';
import type { AgentChunk } from '@shared/ipc';
import type { ToolTraceItem } from '@shared/types';
import { ApiError, onAgentChunk, sendMessage } from '../lib/api';
import { useSnapshotStore } from './useSnapshotStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolTrace?: ToolTraceItem[];
  pending?: boolean;
  error?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  sending: boolean;
  /** 当前正在流式接收的搭子消息 id */
  activeId: string | null;
  send: (text: string) => Promise<void>;
  /** 清空对话 */
  clear: () => void;
  /** 由全局 onChunk 订阅调用，把流式增量写进当前消息 */
  applyChunk: (chunk: AgentChunk) => void;
  /** App 挂载时调用一次，订阅 agent:chunk */
  subscribeChunks: () => () => void;
}

const newId = () => crypto.randomUUID();

function patchMessage(messages: ChatMessage[], id: string, patch: (m: ChatMessage) => ChatMessage) {
  return messages.map((m) => (m.id === id ? patch(m) : m));
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sending: false,
  activeId: null,

  subscribeChunks: () => onAgentChunk((chunk) => get().applyChunk(chunk)),

  clear: () => set({ messages: [], activeId: null }),

  applyChunk: (chunk) => {
    const id = get().activeId;
    if (!id) return;
    set((s) => ({
      messages: patchMessage(s.messages, id, (m) => {
        if (chunk.kind === 'text') return { ...m, text: m.text + chunk.delta };
        return { ...m, toolTrace: [...(m.toolTrace ?? []), chunk.item] };
      }),
    }));
  },

  send: async (raw) => {
    const text = raw.trim();
    if (!text || get().sending) return;

    const assistantId = newId();
    set((s) => ({
      sending: true,
      activeId: assistantId,
      messages: [
        ...s.messages,
        { id: newId(), role: 'user', text },
        { id: assistantId, role: 'assistant', text: '', pending: true, toolTrace: [] },
      ],
    }));

    try {
      const res = await sendMessage(text);
      useSnapshotStore.getState().setSnapshot(res.snapshot);
      set((s) => ({
        sending: false,
        activeId: null,
        messages: patchMessage(s.messages, assistantId, (m) => ({
          ...m,
          text: res.reply || m.text || '搞定 👍',
          toolTrace: res.toolTrace.length ? res.toolTrace : m.toolTrace,
          pending: false,
        })),
      }));
    } catch (error) {
      const message =
        error instanceof ApiError && error.code === 'LLM_TIMEOUT'
          ? '搭子有点忙，稍后再试～'
          : error instanceof ApiError && error.code === 'LLM_ERROR'
            ? 'LLM 暂时不可用，去「设置」检查 baseURL / apiKey / model 吧。'
            : `出错了：${error instanceof Error ? error.message : '未知错误'}`;
      set((s) => ({
        sending: false,
        activeId: null,
        messages: patchMessage(s.messages, assistantId, (m) => ({
          ...m,
          text: message,
          pending: false,
          error: true,
        })),
      }));
    }
  },
}));
