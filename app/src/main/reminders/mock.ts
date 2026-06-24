/**
 * MockReminderBridge：非 macOS / 无权限环境用。实现同一 ReminderBridge 接口。
 * writeReminder 返回递增假 id；writeReminderById 走 Store 查找 + 幂等 + 回填。
 */

import type { WorkmateStore } from '../store';
import type { ReminderBridge } from '../agent/context';

export class MockReminderBridge implements ReminderBridge {
  private counter = 0;

  constructor(private readonly store: WorkmateStore) {}

  async writeReminder(_task: { title: string; due?: string }): Promise<string> {
    this.counter += 1;
    return `mock-reminder-${this.counter}`;
  }

  async writeReminderById(taskId: string): Promise<string> {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`NOT_FOUND: task ${taskId}`);
    if (task.reminderId) return task.reminderId;
    const reminderId = await this.writeReminder({ title: task.title, due: task.due });
    this.store.setReminderId(taskId, reminderId);
    return reminderId;
  }
}
