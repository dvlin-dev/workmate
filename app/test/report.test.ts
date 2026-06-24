import { describe, it, expect } from 'vitest';
import { WorkmateStore, createEmptyData } from '../src/main/store';
import { createReportService } from '../src/main/report';

function seededStore() {
  const now = () => new Date(2026, 5, 24, 10, 0, 0);
  const store = new WorkmateStore({ initial: createEmptyData(), now });

  // A：有进展（亮点）
  const { goalId: a } = store.createGoal('登录联调');
  store.updateProgress(a, 60, '前端联调打通');

  // B：只创建、无进展（卡点）
  store.createGoal('写设计文档');

  // C：有一个已完成待办（本周完成），目标本身仍 active（下周计划）
  const { goalId: c } = store.createGoal('提测准备');
  const { taskId } = store.addTask(c, '打包构建');
  store.completeTask(taskId);

  return store;
}

describe('周报 · 无 key 确定性降级模板', () => {
  it('四段标题齐全', async () => {
    const md = await createReportService(seededStore()).generate();
    expect(md).toContain('## 本周完成');
    expect(md).toContain('## 进展亮点');
    expect(md).toContain('## 风险与卡点');
    expect(md).toContain('## 下周计划');
  });

  it('完成段含已完成待办；亮点段含 >=50% 目标；卡点段含无进展目标；下周段含未完成', async () => {
    const md = await createReportService(seededStore()).generate();
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

  it('空数据周也能出四段（不崩溃）', async () => {
    const now = () => new Date(2026, 5, 24, 10, 0, 0);
    const store = new WorkmateStore({ initial: createEmptyData(), now });
    const md = await createReportService(store).generate();
    expect(md).toContain('## 风险与卡点');
    expect(md).toContain('暂无明显卡点');
  });
});
