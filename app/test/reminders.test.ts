import { describe, it, expect } from 'vitest';
import { WorkmateStore, createEmptyData } from '../src/main/store';
import { MockReminderBridge } from '../src/main/reminders/mock';
import { OsascriptReminderBridge, type OsascriptRunner } from '../src/main/reminders/bridge';
import { ReminderPermissionError } from '../src/main/reminders/errors';

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

describe('OsascriptReminderBridge · 串行化与重试（根因防回归）', () => {
  function storeWithTasks(n: number) {
    const store = new WorkmateStore({
      initial: createEmptyData(),
      now: () => new Date(2026, 5, 24, 10, 0, 0),
    });
    const { goalId } = store.createGoal('订单服务 v2 重构');
    const taskIds = Array.from({ length: n }, (_, i) => store.addTask(goalId, `待办${i}`).taskId);
    return { store, taskIds };
  }

  it('并发写入被合并为一次批量 osascript 调用（根因修复）', async () => {
    const { store, taskIds } = storeWithTasks(8);
    let calls = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    let batchN = 0;
    const runner: OsascriptRunner = async (argv) => {
      calls += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      batchN = (argv.length - 1) / 2; // 本测试待办均无 due，stride=2
      await new Promise((r) => setTimeout(r, 3));
      inFlight -= 1;
      return Array.from({ length: batchN }, (_, i) => `rid-${i}`).join('\n');
    };
    const bridge = new OsascriptReminderBridge(store, { runner });

    const ids = await Promise.all(taskIds.map((id) => bridge.writeReminderById(id)));
    expect(calls).toBe(1); // 8 个并发写入只触发 1 次 osascript（旧实现是 8 次）
    expect(maxInFlight).toBe(1);
    expect(batchN).toBe(8);
    expect(new Set(ids).size).toBe(8); // 每个任务拿到各自的 id
    expect(store.getTask(taskIds[0]!)?.reminderId).toBe('rid-0'); // 按序回填
  });

  it('瞬时失败整批自动重试后成功', async () => {
    const { store, taskIds } = storeWithTasks(1);
    let calls = 0;
    const runner: OsascriptRunner = async () => {
      calls += 1;
      if (calls === 1) throw new Error('execution error: Reminders got an error (-1728)');
      return 'rid-ok';
    };
    const bridge = new OsascriptReminderBridge(store, { runner, retryBaseMs: 1 });
    const id = await bridge.writeReminderById(taskIds[0]!);
    expect(id).toBe('rid-ok');
    expect(calls).toBe(2);
  });

  it('权限错误不重试，直接抛 ReminderPermissionError', async () => {
    const { store, taskIds } = storeWithTasks(1);
    let calls = 0;
    const runner: OsascriptRunner = async () => {
      calls += 1;
      throw new ReminderPermissionError();
    };
    const bridge = new OsascriptReminderBridge(store, { runner, retryBaseMs: 1 });
    await expect(bridge.writeReminderById(taskIds[0]!)).rejects.toBeInstanceOf(
      ReminderPermissionError
    );
    expect(calls).toBe(1);
  });
});
