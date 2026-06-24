/**
 * 周报「确定性模板」：纯函数（ReportMaterial in → markdown out 与 WeeklyPlan → ReportMaterial），
 * 无 LLM、无 Store、无 electron——既是无 key/失败时的降级模板，也是周报里最密集、可直接单测的业务逻辑。
 * 真相源：docs/reference/prompts.md §2。
 */

import type { Goal, ProgressEvent, WeeklyPlan } from '@shared/types';
import { addDays } from '../date';

export interface ReportMaterial {
  weekOf: string;
  rangeLabel: string;
  goals: Array<{
    title: string;
    status: Goal['status'];
    progress: number;
    tasks: Array<{ title: string; done: boolean; due?: string }>;
  }>;
  events: Array<{ time: string; kind: ProgressEvent['kind']; summary: string; goalTitle?: string }>;
}

/** 把一周的目标树 + 进度流整理成喂给 LLM / 模板的只读材料 */
export function assembleMaterial(week: WeeklyPlan): ReportMaterial {
  const titleById = new Map(week.goals.map((g) => [g.id, g.title]));
  return {
    weekOf: week.weekOf,
    rangeLabel: `${week.weekOf} ~ ${addDays(week.weekOf, 6)}`,
    goals: week.goals.map((g) => ({
      title: g.title,
      status: g.status,
      progress: g.progress,
      tasks: g.tasks.map((t) => ({ title: t.title, done: t.done, due: t.due })),
    })),
    events: week.events.map((e) => ({
      time: e.timestamp,
      kind: e.kind,
      summary: e.summary,
      goalTitle: e.relatedGoalId ? titleById.get(e.relatedGoalId) : undefined,
    })),
  };
}

/** 无 key / 失败时的确定性四段 markdown（不使用对话 mock，保证单测稳定） */
export function deterministicReport(material: ReportMaterial): string {
  const lines: string[] = [`# 本周周报（${material.rangeLabel}）`, ''];

  // 只有"进展类"事件才算推进过；goal_created/note 不计入，否则卡点永远为空
  const progressedGoals = new Set(
    material.events
      .filter((e) => e.kind === 'progress_update' || e.kind === 'task_done')
      .map((e) => e.goalTitle)
      .filter((t): t is string => Boolean(t))
  );

  const completed: string[] = [];
  for (const g of material.goals) {
    if (g.status === 'done') completed.push(`「${g.title}」已完成`);
    for (const t of g.tasks) {
      if (t.done) completed.push(`完成待办：${t.title}（${g.title}）`);
    }
  }
  lines.push('## 本周完成');
  lines.push(completed.length ? completed.map((c) => `- ${c}`).join('\n') : '- 本周暂无已标记完成的目标或待办。');
  lines.push('');

  const highlights = material.goals
    .filter((g) => g.progress >= 50 && g.status !== 'done')
    .map((g) => `- 「${g.title}」推进到 ${g.progress}%`);
  lines.push('## 进展亮点');
  lines.push(highlights.length ? highlights.join('\n') : '- 本周进度记录较少，可多同步进展。');
  lines.push('');

  const blockers = material.goals
    .filter((g) => g.status === 'active' && !progressedGoals.has(g.title))
    .map((g) => `- 「${g.title}」本周暂无进展记录`);
  lines.push('## 风险与卡点');
  lines.push(blockers.length ? blockers.join('\n') : '- 暂无明显卡点。');
  lines.push('');

  const nextWeek: string[] = [];
  for (const g of material.goals) {
    if (g.status !== 'done') nextWeek.push(`- 继续推进「${g.title}」（当前 ${g.progress}%）`);
    for (const t of g.tasks) {
      if (!t.done) nextWeek.push(`- 待办：${t.title}（${g.title}）`);
    }
  }
  lines.push('## 下周计划');
  lines.push(nextWeek.length ? nextWeek.join('\n') : '- 下周计划待补充。');

  return lines.join('\n');
}
