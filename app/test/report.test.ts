import { describe, it, expect } from 'vitest';
import type { WeeklyPlan } from '../src/shared/types';
import { assembleMaterial, deterministicReport } from '../src/main/report/template';

/** 直接构造一周材料（不再 seed WorkmateStore）：A 60% active、B 无进展、C 已完成 */
function sampleWeek(): WeeklyPlan {
  return {
    weekOf: '2026-06-22',
    goals: [
      {
        id: 'a',
        title: '登录联调',
        status: 'active',
        progress: 60,
        createdAt: '2026-06-22T00:00:00.000Z',
        tasks: [
          { id: 'a1', title: '接口联调', done: true },
          { id: 'a2', title: '前端对接', done: true },
          { id: 'a3', title: '异常处理', done: true },
          { id: 'a4', title: '埋点上报', done: false },
          { id: 'a5', title: '回归测试', done: false },
        ],
      },
      { id: 'b', title: '写设计文档', status: 'active', progress: 0, createdAt: '2026-06-22T00:00:00.000Z', tasks: [] },
      {
        id: 'c',
        title: '提测准备',
        status: 'done',
        progress: 100,
        createdAt: '2026-06-22T00:00:00.000Z',
        tasks: [{ id: 'c1', title: '打包构建', done: true }],
      },
    ],
    events: [
      { id: 'e1', timestamp: '2026-06-24T10:00:00.000Z', rawText: '接口联调', kind: 'task_done', summary: '完成待办：接口联调', relatedGoalId: 'a' },
      { id: 'e2', timestamp: '2026-06-24T11:00:00.000Z', rawText: '打包构建', kind: 'task_done', summary: '完成待办：打包构建', relatedGoalId: 'c' },
    ],
  };
}

describe('周报 · 确定性模板（纯函数，无 Store）', () => {
  const render = () => deterministicReport(assembleMaterial(sampleWeek()));

  it('四段标题齐全', () => {
    const md = render();
    expect(md).toContain('## 本周完成');
    expect(md).toContain('## 进展亮点');
    expect(md).toContain('## 风险与卡点');
    expect(md).toContain('## 下周计划');
  });

  it('完成段含已完成待办；亮点段含 >=50% 目标；卡点段含无进展目标；下周段含未完成', () => {
    const md = render();
    const section = (title: string) => {
      const start = md.indexOf(`## ${title}`);
      const after = md.slice(start + title.length);
      const next = after.indexOf('\n## ');
      return next === -1 ? after : after.slice(0, next);
    };
    expect(section('本周完成')).toContain('打包构建');
    expect(section('进展亮点')).toContain('登录联调');
    expect(section('进展亮点')).toContain('60%');
    expect(section('风险与卡点')).toContain('写设计文档');
    expect(section('下周计划')).toContain('登录联调');
  });

  it('rangeLabel 为周一 ~ 周日', () => {
    expect(assembleMaterial(sampleWeek()).rangeLabel).toBe('2026-06-22 ~ 2026-06-28');
  });

  it('空数据周也能出四段（不崩溃）', () => {
    const empty: WeeklyPlan = { weekOf: '2026-06-22', goals: [], events: [] };
    const md = deterministicReport(assembleMaterial(empty));
    expect(md).toContain('## 风险与卡点');
    expect(md).toContain('暂无明显卡点');
  });
});
