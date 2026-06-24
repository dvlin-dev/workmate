/**
 * MockReminderBridge：非 macOS / 无权限环境用。实现同一 ReminderBridge 接口。
 * writeReminderById 走 Store 查找 + 幂等 + 回填，新写入返回递增假 id。
 */

import type { WorkmateStore } from '../store';
import type { ReminderBridge } from '../agent/context';

export class MockReminderBridge implements ReminderBridge {
  private counter = 0;

  constructor(private readonly store: WorkmateStore) {}

  async writeReminderById(taskId: string): Promise<string> {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`NOT_FOUND: task ${taskId}`);
    if (task.reminderId) return task.reminderId;
    this.counter += 1;
    const reminderId = `mock-reminder-${this.counter}`;
    this.store.setReminderId(taskId, reminderId);
    return reminderId;
  }
}
