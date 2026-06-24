import { describe, it, expect } from 'vitest';
import { WorkmateStore, createEmptyData } from '../src/main/store';
import { MockReminderBridge } from '../src/main/reminders/mock';

function setup() {
  const store = new WorkmateStore({
    initial: createEmptyData(),
    now: () => new Date(2026, 5, 24, 10, 0, 0),
  });
  const { goalId } = store.createGoal('登录联调');
  const { taskId } = store.addTask(goalId, '提测', '2026-06-25T10:00:00.000Z');
  return { store, taskId, bridge: new MockReminderBridge(store) };
}

describe('MockReminderBridge · 幂等', () => {
  it('同一 task 连续写两次只创建一次、返回同一 id', async () => {
    const { store, taskId, bridge } = setup();
    const first = await bridge.writeReminderById(taskId);
    const second = await bridge.writeReminderById(taskId);
    expect(first).toBe('mock-reminder-1');
    expect(second).toBe(first);
    expect(store.getTask(taskId)?.reminderId).toBe(first);
  });

  it('已带 reminderId 的 task 直接返回、不再写入', async () => {
    const { store, taskId, bridge } = setup();
    store.setReminderId(taskId, 'pre-existing');
    const result = await bridge.writeReminderById(taskId);
    expect(result).toBe('pre-existing');
  });

  it('task 不存在则抛错', async () => {
    const { bridge } = setup();
    await expect(bridge.writeReminderById('nope')).rejects.toThrow(/NOT_FOUND/);
  });
});
