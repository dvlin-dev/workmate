import { describe, it, expect } from 'vitest';
import { pickNudge } from '../src/main/nudge/decide';
import { DEFAULT_CONFIG } from '../src/shared/config';
import type { Goal, ProgressEvent, WeeklyPlan } from '../src/shared/types';

function goal(partial: Partial<Goal> & { id: string; createdAt: string }): Goal {
  return { title: '登录联调', status: 'active', progress: 0, tasks: [], ...partial };
}

function week(goals: Goal[], events: ProgressEvent[] = []): WeeklyPlan {
  return { weekOf: '2026-06-22', goals, events };
}

const neverSent = () => false;

describe('pickNudge', () => {
  it('周五下午 → friday', () => {
    const now = new Date(2026, 5, 26, 15, 0, 0); // 周五 15:00
    const w = week([goal({ id: 'g1', createdAt: now.toISOString() })]);
    const res = pickNudge({ week: w, config: DEFAULT_CONFIG, now, alreadySentToday: neverSent });
    expect(res?.kind).toBe('friday');
  });

  it('friday 已发过今天 → 不再发（其它条件不满足时 null）', () => {
    const now = new Date(2026, 5, 26, 15, 0, 0); // 周五，目标刚建（不停滞），15:00 不到傍晚
    const w = week([goal({ id: 'g1', createdAt: now.toISOString() })]);
    const res = pickNudge({
      week: w,
      config: DEFAULT_CONFIG,
      now,
      alreadySentToday: (k) => k === 'friday',
    });
    expect(res).toBeNull();
  });

  it('工作时段某 active 目标超过 stallHours 无事件 → stall（含目标名）', () => {
    const now = new Date(2026, 5, 24, 11, 0, 0); // 周三 11:00
    const createdAt = new Date(now.getTime() - 5 * 3600 * 1000).toISOString(); // 5 小时前
    const w = week([goal({ id: 'g1', title: '写设计文档', createdAt })]);
    const res = pickNudge({ week: w, config: DEFAULT_CONFIG, now, alreadySentToday: neverSent });
    expect(res?.kind).toBe('stall');
    expect(res?.message).toContain('写设计文档');
  });

  it('目标 1 小时前才有动静 → 不 stall', () => {
    const now = new Date(2026, 5, 24, 11, 0, 0);
    const createdAt = new Date(now.getTime() - 1 * 3600 * 1000).toISOString();
    const w = week([goal({ id: 'g1', createdAt })]);
    const res = pickNudge({ week: w, config: DEFAULT_CONFIG, now, alreadySentToday: neverSent });
    expect(res).toBeNull();
  });

  it('傍晚有 active 目标但今日无事件 → evening', () => {
    const now = new Date(2026, 5, 24, 20, 0, 0); // 周三 20:00（过工作时段，避开 stall）
    const yesterday = new Date(2026, 5, 23, 10, 0, 0).toISOString();
    const w = week([goal({ id: 'g1', createdAt: yesterday })]);
    const res = pickNudge({ week: w, config: DEFAULT_CONFIG, now, alreadySentToday: neverSent });
    expect(res?.kind).toBe('evening');
  });

  it('傍晚但今天已有事件 → 不打扰', () => {
    const now = new Date(2026, 5, 24, 20, 0, 0);
    const todayEvent: ProgressEvent = {
      id: 'e1',
      timestamp: new Date(2026, 5, 24, 15, 0, 0).toISOString(),
      rawText: '推进了',
      kind: 'progress_update',
      relatedGoalId: 'g1',
      summary: '推进了',
    };
    const w = week([goal({ id: 'g1', createdAt: new Date(2026, 5, 23).toISOString() })], [todayEvent]);
    const res = pickNudge({ week: w, config: DEFAULT_CONFIG, now, alreadySentToday: neverSent });
    expect(res).toBeNull();
  });

  it('没有 active 目标 → 不打扰', () => {
    const now = new Date(2026, 5, 24, 20, 0, 0);
    const w = week([goal({ id: 'g1', status: 'done', progress: 100, createdAt: new Date(2026, 5, 23).toISOString() })]);
    const res = pickNudge({ week: w, config: DEFAULT_CONFIG, now, alreadySentToday: neverSent });
    expect(res).toBeNull();
  });
});
