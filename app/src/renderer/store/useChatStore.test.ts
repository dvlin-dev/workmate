import { describe, it, expect, beforeEach } from 'vitest';
import { messageText, useChatStore, type ChatMessage, type MessagePart } from './useChatStore';

function seedActiveAssistant(id = 'a1') {
  useChatStore.setState({
    messages: [{ id, role: 'assistant', parts: [], pending: true }],
    activeId: id,
    sending: true,
  });
  return id;
}

describe('useChatStore.applyChunk · 有序 parts（修复工具堆顶、文字堆底）', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], activeId: null, sending: false });
  });

  it('文字与工具按到达顺序交错；连续文字合并、连续工具各自成段', () => {
    seedActiveAssistant();
    const ap = useChatStore.getState().applyChunk;
    ap({ kind: 'text', delta: '先看一下，' });
    ap({ kind: 'text', delta: '我去查目标…' });
    ap({ kind: 'tool', item: { tool: 'find_goal', summary: '查找命中 1 个' } });
    ap({ kind: 'text', delta: '勾掉接口那条…' });
    ap({ kind: 'tool', item: { tool: 'complete_task', summary: '已完成一个待办' } });
    ap({ kind: 'tool', item: { tool: 'write_reminder', summary: '已写入提醒事项' } });
    ap({ kind: 'text', delta: '搞定 👍' });

    const parts = useChatStore.getState().messages[0]!.parts;
    expect(parts.map((p) => (p.kind === 'text' ? `T:${p.text}` : `K:${p.item.tool}`))).toEqual([
      'T:先看一下，我去查目标…',
      'K:find_goal',
      'T:勾掉接口那条…',
      'K:complete_task',
      'K:write_reminder',
      'T:搞定 👍',
    ]);
  });

  it('snapshot chunk 不进 parts；无 activeId 时丢弃增量', () => {
    seedActiveAssistant();
    const ap = useChatStore.getState().applyChunk;
    ap({
      kind: 'snapshot',
      snapshot: { weekOf: '2026-06-22', today: '2026-06-24', weekday: '周三', goals: [], todayFocus: [] },
    });
    expect(useChatStore.getState().messages[0]!.parts).toHaveLength(0);

    useChatStore.setState({ activeId: null });
    ap({ kind: 'text', delta: 'x' });
    expect(useChatStore.getState().messages[0]!.parts).toHaveLength(0);
  });

  it('messageText 拼接所有文字段、跳过工具段', () => {
    const msg: ChatMessage = {
      id: 'm',
      role: 'assistant',
      parts: [
        { kind: 'text', text: 'a' },
        { kind: 'tool', item: { tool: 't', summary: 's' } },
        { kind: 'text', text: 'b' },
      ] satisfies MessagePart[],
    };
    expect(messageText(msg)).toBe('ab');
  });
});
