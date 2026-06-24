/**
 * 周报生成（ReportService 实现）。
 * 有 key → generateText（叙事 prompt）；无 key / 失败 → 确定性四段 markdown 降级。
 * 真相源：docs/reference/prompts.md §2、agent-runtime.md §7。
 */

import { generateText } from 'ai';
import { hasApiKey } from '@shared/config';
import type { Goal, ProgressEvent, WeeklyPlan } from '@shared/types';
import type { ReportService } from './agent/context';
import type { WorkmateStore } from './store';
import { buildRawModel } from './agent/model';

const REPORT_TIMEOUT_MS = 60_000;

const REPORT_SYSTEM = `你是「Workmate」，现在要基于用户这一周的目标与进度流，写一份**叙事性**周报（不是干巴巴的清单）。
要求：
- 用中文，markdown 格式，分四个二级标题：## 本周完成、## 进展亮点、## 风险与卡点、## 下周计划。
- 本周完成：结合已完成目标/待办与事件 summary 叙述，突出"做成了什么"。
- 进展亮点：进度推进明显的目标，点出关键节点。
- 风险与卡点：长期无进展、或事件里显式提到受阻的目标；没有就写"暂无明显卡点"。
- 下周计划：未完成的目标/待办，简要展望。
- 语气平实、第一人称、可直接发给同事或上级；不编造未发生的事；没有数据的段落如实说明。`;

interface ReportMaterial {
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function assembleMaterial(week: WeeklyPlan): ReportMaterial {
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

/** 无 key / 失败时的确定性 markdown（不使用对话 mock，保证单测稳定） */
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

export function createReportService(store: WorkmateStore): ReportService {
  return {
    async generate(weekOf?: string): Promise<string> {
      const week = weekOf ? store.getWeek(weekOf) : store.getCurrentWeekData();
      if (!week) {
        return `# 本周周报\n\n## 本周完成\n- 未找到该周（${weekOf}）的数据。`;
      }
      const material = assembleMaterial(week);
      const config = store.getConfig();
      if (!hasApiKey(config)) {
        return deterministicReport(material);
      }
      try {
        const { text } = await generateText({
          model: buildRawModel(config.llm),
          system: REPORT_SYSTEM,
          prompt: `这是本周（${material.rangeLabel}）的原始材料 JSON，请据此生成周报：\n${JSON.stringify(material)}`,
          abortSignal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
        });
        return text.trim() ? text : deterministicReport(material);
      } catch {
        return deterministicReport(material);
      }
    },
  };
}
