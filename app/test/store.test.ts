import { describe, it, expect, beforeEach } from 'vitest';
import { WorkmateStore, createEmptyData, type WorkmateData } from '../src/main/store';

function makeStore(clock: Date) {
  let now = clock;
  const data = createEmptyData();
  let persisted = 0;
  const store = new WorkmateStore({
    initial: data,
    persist: () => {
      persisted += 1;
    },
    now: () => now,
  });
  return {
    store,
    data,
    setNow: (d: Date) => {
      now = d;
    },
    persistedCount: () => persisted,
  };
}

describe('WorkmateStore · weekOf 周一锚', () => {
  it('returns a Monday within the same week', () => {
    const { store } = makeStore(new Date(2026, 5, 24)); // 2026-06-24
    const key = store.weekOf(new Date(2026, 5, 24));
    const monday = new Date(`${key}T00:00:00`);
    expect(monday.getDay()).toBe(1); // 周一
    const diffDays = (new Date(2026, 5, 24).getTime() - monday.getTime()) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(0);
    expect(diffDays).toBeLessThan(7);
  });

  it('maps Sunday back to the previous Monday', () => {
    const { store } = makeStore(new Date(2026, 5, 28)); // 2026-06-28 周日
    const key = store.weekOf(new Date(2026, 5, 28));
    expect(new Date(`${key}T00:00:00`).getDay()).toBe(1);
    expect(key).toBe(store.weekOf(new Date(2026, 5, 22))); // 同周的周一
  });
});

describe('WorkmateStore · 目标 CRUD 与进度流不变量', () => {
  let ctx: ReturnType<typeof makeStore>;
  beforeEach(() => {
    ctx = makeStore(new Date(2026, 5, 24, 10, 0, 0));
  });

  it('createGoal 出现在快照并落 goal_created 事件', () => {
    const { goalId } = ctx.store.createGoal('做完登录联调');
    const snap = ctx.store.getSnapshot();
    expect(snap.goals).toHaveLength(1);
    expect(snap.goals[0].title).toBe('做完登录联调');
    const week = ctx.store.getCurrentWeekData();
    const created = week.events.filter((e) => e.kind === 'goal_created');
    expect(created).toHaveLength(1);
    expect(created[0].relatedGoalId).toBe(goalId);
  });

  it('进度按完成待办比例派生，全完成自动置 status=done，取消勾选回退', () => {
    const { goalId } = ctx.store.createGoal('订单服务 v2 重构');
    const t1 = ctx.store.addTask(goalId, '拆库存耦合').taskId;
    const t2 = ctx.store.addTask(goalId, 'code review').taskId;
    const t3 = ctx.store.addTask(goalId, '灰度 10%').taskId;
    const t4 = ctx.store.addTask(goalId, '全量上线').taskId;
    expect(ctx.store.getSnapshot().goals[0].progress).toBe(0);

    ctx.store.completeTask(t2);
    expect(ctx.store.getSnapshot().goals[0].progress).toBe(25);

    ctx.store.completeTask(t1);
    ctx.store.completeTask(t3);
    expect(ctx.store.getSnapshot().goals[0].progress).toBe(75);

    ctx.store.completeTask(t4);
    const done = ctx.store.getSnapshot().goals[0];
    expect(done.progress).toBe(100);
    expect(done.status).toBe('done');

    ctx.store.toggleTask(t4); // 取消勾选最后一个 → 回退
    const back = ctx.store.getSnapshot().goals[0];
    expect(back.progress).toBe(75);
    expect(back.status).toBe('active');
  });

  it('completeGoal 勾全待办、进度置 100/done 并落 progress_update', () => {
    const { goalId } = ctx.store.createGoal('写设计文档');
    ctx.store.addTask(goalId, '列大纲');
    ctx.store.addTask(goalId, '写初稿');
    const res = ctx.store.completeGoal(goalId);
    expect(res.progress).toBe(100);
    const goal = ctx.store.getSnapshot().goals[0];
    expect(goal.status).toBe('done');
    expect(goal.tasks.every((t) => t.done)).toBe(true);
    const events = ctx.store.getCurrentWeekData().events.filter((e) => e.kind === 'progress_update');
    expect(events).toHaveLength(1);
    expect(events[0].summary).toContain('完成目标');
  });

  it('completeTask 标记完成并落 task_done', () => {
    const { goalId } = ctx.store.createGoal('登录联调');
    const { taskId } = ctx.store.addTask(goalId, '联调接口');
    ctx.store.completeTask(taskId);
    expect(ctx.store.getTask(taskId)?.done).toBe(true);
    const events = ctx.store.getCurrentWeekData().events.filter((e) => e.kind === 'task_done');
    expect(events).toHaveLength(1);
  });

  it('appendEvent 不变量：goal_created/completeGoal 各落一条，add_task 不落', () => {
    const { goalId } = ctx.store.createGoal('目标A'); // goal_created x1
    ctx.store.addTask(goalId, '子任务'); // 不落事件
    ctx.store.completeGoal(goalId); // progress_update x1（完成目标）
    const week = ctx.store.getCurrentWeekData();
    expect(week.events.filter((e) => e.kind === 'goal_created')).toHaveLength(1);
    expect(week.events.filter((e) => e.kind === 'progress_update')).toHaveLength(1);
    expect(week.events).toHaveLength(2); // add_task 未落事件
  });

  it('findGoals 标题包含命中', () => {
    ctx.store.createGoal('登录联调');
    ctx.store.createGoal('设计文档');
    expect(ctx.store.findGoals('登录')).toHaveLength(1);
    expect(ctx.store.findGoals('不存在的')).toHaveLength(0);
  });
});

describe('WorkmateStore · 快照 todayFocus', () => {
  it('包含今日/逾期且未完成的待办，排除已完成', () => {
    const ctx = makeStore(new Date(2026, 5, 24, 9, 0, 0));
    const { goalId } = ctx.store.createGoal('登录联调');
    const { taskId: todayTask } = ctx.store.addTask(goalId, '今天联调', '2026-06-24'); // 纯日期，跨时区稳定
    ctx.store.addTask(goalId, '无截止任务');
    const { taskId: doneTask } = ctx.store.addTask(goalId, '已完成任务', '2026-06-24');
    ctx.store.completeTask(doneTask);

    const focus = ctx.store.getSnapshot().todayFocus;
    const ids = focus.map((t) => t.id);
    expect(ids).toContain(todayTask);
    expect(ids).not.toContain(doneTask);
    // 有 due 的排在无 due 之前
    expect(focus[0].id).toBe(todayTask);
  });
});

describe('WorkmateStore · 跨周自动新建 WeeklyPlan', () => {
  it('切到下一周后当前周为空、旧周仍可取', () => {
    const ctx = makeStore(new Date(2026, 5, 24, 10, 0, 0));
    ctx.store.createGoal('本周目标');
    const firstWeekKey = ctx.store.getSnapshot().weekOf;
    expect(ctx.store.getSnapshot().goals).toHaveLength(1);

    ctx.setNow(new Date(2026, 6, 2, 10, 0, 0)); // +8 天，进入下一周
    const snap2 = ctx.store.getSnapshot();
    expect(snap2.weekOf).not.toBe(firstWeekKey);
    expect(snap2.goals).toHaveLength(0); // 新周为空
    expect(ctx.store.getWeek(firstWeekKey)?.goals).toHaveLength(1); // 旧周保留
  });
});

describe('WorkmateStore · toggleTask（人工勾选）', () => {
  it('未完成→完成落 task_done，再切回未完成落 note', () => {
    const ctx = makeStore(new Date(2026, 5, 24, 10, 0, 0));
    const { goalId } = ctx.store.createGoal('登录联调');
    const { taskId } = ctx.store.addTask(goalId, '联调接口');

    const first = ctx.store.toggleTask(taskId);
    expect(first.done).toBe(true);
    expect(ctx.store.getTask(taskId)?.done).toBe(true);
    expect(ctx.store.getCurrentWeekData().events.some((e) => e.kind === 'task_done')).toBe(true);

    const second = ctx.store.toggleTask(taskId);
    expect(second.done).toBe(false);
    expect(ctx.store.getTask(taskId)?.done).toBe(false);
    expect(
      ctx.store.getCurrentWeekData().events.some((e) => e.summary.includes('重新打开待办'))
    ).toBe(true);
  });
});

describe('WorkmateStore · clearCurrentWeek', () => {
  it('清空当前周目标与事件，保留配置', () => {
    const ctx = makeStore(new Date(2026, 5, 24, 10, 0, 0));
    const { goalId } = ctx.store.createGoal('登录联调');
    ctx.store.addTask(goalId, '联调接口');
    ctx.store.setConfig({ llm: { apiKey: 'sk-keep' } });

    ctx.store.clearCurrentWeek();

    expect(ctx.store.getSnapshot().goals).toHaveLength(0);
    expect(ctx.store.getCurrentWeekData().events).toHaveLength(0);
    expect(ctx.store.getConfig().llm.apiKey).toBe('sk-keep'); // 配置不受影响
  });
});

describe('WorkmateStore · setReminderId 幂等', () => {
  it('第二次写入保持首个 reminderId', () => {
    const ctx = makeStore(new Date(2026, 5, 24, 10, 0, 0));
    const { goalId } = ctx.store.createGoal('登录联调');
    const { taskId } = ctx.store.addTask(goalId, '联调接口');
    ctx.store.setReminderId(taskId, 'rid-1');
    ctx.store.setReminderId(taskId, 'rid-2');
    expect(ctx.store.getTask(taskId)?.reminderId).toBe('rid-1');
  });
});

describe('WorkmateStore · config 深合并', () => {
  it('setConfig 局部 patch 不丢其它字段', () => {
    const ctx = makeStore(new Date(2026, 5, 24, 10, 0, 0));
    const before = ctx.store.getConfig();
    const after = ctx.store.setConfig({ llm: { apiKey: 'sk-test' } });
    expect(after.llm.apiKey).toBe('sk-test');
    expect(after.llm.baseURL).toBe(before.llm.baseURL); // 未改字段保留
    expect(after.nudge.eveningHour).toBe(before.nudge.eveningHour);
  });
});

describe('WorkmateData 默认值', () => {
  it('createEmptyData 结构正确', () => {
    const data: WorkmateData = createEmptyData();
    expect(data.weeks).toEqual([]);
    expect(data.config.nudge.enabled).toBe(true);
    expect(data.version).toBeGreaterThanOrEqual(1);
  });
});
