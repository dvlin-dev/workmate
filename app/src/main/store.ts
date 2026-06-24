/**
 * WorkmateStore：周目标树的内存状态 + CRUD + 进度流不变量 + 当前周快照。
 * 设计为可测：构造时注入初始数据、persist 回调与 now()（无需 electron-store / 外网）。
 * 运行时由 persistence.ts 用 electron-store 包装。
 */

import { randomUUID } from 'node:crypto';
import type {
  AppConfig,
} from '@shared/config';
import type { DeepPartial } from '@shared/ipc';
import {
  DATA_VERSION,
  type Goal,
  type ProgressEvent,
  type ProgressEventKind,
  type Snapshot,
  type Task,
  type WeeklyPlan,
} from '@shared/types';
import { DEFAULT_CONFIG } from '@shared/config';
import { applyConfigPatch } from './config';

export interface WorkmateData {
  version: number;
  weeks: WeeklyPlan[];
  config: AppConfig;
  /** 各类 nudge 最近发送日期（YYYY-M-D），跨重启去重 */
  nudgeLastSent?: Record<string, string>;
}

export interface WorkmateStoreOptions {
  initial: WorkmateData;
  /** 落盘回调；测试可传 noop */
  persist?: (data: WorkmateData) => void;
  /** 注入时间，便于跨周/快照单测 */
  now?: () => Date;
}

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
const TODAY_FOCUS_LIMIT = 12;

export function createEmptyData(): WorkmateData {
  return { version: DATA_VERSION, weeks: [], config: structuredClone(DEFAULT_CONFIG), nudgeLastSent: {} };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 本地时区 YYYY-MM-DD */
function formatLocalYMD(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 把 due（ISO 或纯日期）规整为本地日期 YYYY-MM-DD；非法/缺省返回 undefined */
function localDueDay(due?: string): string | undefined {
  if (!due) return undefined;
  const d = new Date(due);
  return Number.isNaN(d.getTime()) ? undefined : formatLocalYMD(d);
}

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * 标题匹配（契约：标题包含 / 分词命中，不调 LLM）。
 * 故意不做 2-gram 子串兜底——那会跨目标误命中、把进展归错目标。
 * 口语 query 的清洗由调用方（agent / mock）负责，命中为空时 agent 反问即可。
 */
function matchesGoal(title: string, query: string): boolean {
  if (title.includes(query)) return true;
  if (query.includes(title)) return true;
  for (const token of query.split(/\s+/).filter(Boolean)) {
    if (token.length >= 2 && title.includes(token)) return true;
  }
  return false;
}

export class WorkmateStore {
  private data: WorkmateData;
  private readonly persist: (data: WorkmateData) => void;
  private readonly now: () => Date;

  constructor(options: WorkmateStoreOptions) {
    this.data = options.initial;
    this.persist = options.persist ?? (() => {});
    this.now = options.now ?? (() => new Date());
  }

  // ── 日期 / 周锚 ────────────────────────────────────────────
  /** 该日期所在周的周一（本地时区）YYYY-MM-DD */
  weekOf(date: Date): string {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0=周日..6=周六
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    return formatLocalYMD(d);
  }

  private todayStr(): string {
    return formatLocalYMD(this.now());
  }

  // ── 周计划 ────────────────────────────────────────────────
  /** 取当前周；不存在则按周一锚新建并落盘 */
  getCurrentWeek(): WeeklyPlan {
    const key = this.weekOf(this.now());
    let week = this.data.weeks.find((w) => w.weekOf === key);
    if (!week) {
      week = { weekOf: key, goals: [], events: [] };
      this.data.weeks.push(week);
      this.save();
    }
    return week;
  }

  getSnapshot(): Snapshot {
    const week = this.getCurrentWeek();
    const today = this.todayStr();
    return {
      weekOf: week.weekOf,
      today,
      weekday: WEEKDAY_ZH[this.now().getDay()],
      goals: structuredClone(week.goals),
      todayFocus: this.collectTodayFocus(week, today),
    };
  }

  private collectTodayFocus(week: WeeklyPlan, today: string): Task[] {
    const focus: Task[] = [];
    for (const goal of week.goals) {
      if (goal.status !== 'active') continue;
      for (const task of goal.tasks) {
        if (task.done) continue;
        const dueDay = localDueDay(task.due);
        if (!dueDay || dueDay <= today) {
          focus.push(structuredClone(task));
        }
      }
    }
    // 有 due 的（更紧迫）排前面
    focus.sort((a, b) => {
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return 0;
    });
    return focus.slice(0, TODAY_FOCUS_LIMIT);
  }

  // ── 进度流 ────────────────────────────────────────────────
  private pushEvent(input: {
    kind: ProgressEventKind;
    rawText: string;
    summary: string;
    relatedGoalId?: string;
  }): ProgressEvent {
    const week = this.getCurrentWeek();
    const event: ProgressEvent = {
      id: randomUUID(),
      timestamp: this.now().toISOString(),
      rawText: input.rawText,
      kind: input.kind,
      summary: input.summary,
      relatedGoalId: input.relatedGoalId,
    };
    week.events.push(event);
    return event;
  }

  /** 公共事件写入（log_event / 原始录入用）；落盘 */
  appendEvent(input: {
    kind: ProgressEventKind;
    rawText: string;
    summary: string;
    relatedGoalId?: string;
  }): { eventId: string } {
    const event = this.pushEvent(input);
    this.save();
    return { eventId: event.id };
  }

  // ── 目标 / 待办 CRUD ───────────────────────────────────────
  createGoal(title: string): { goalId: string } {
    const week = this.getCurrentWeek();
    const goal: Goal = {
      id: randomUUID(),
      title,
      status: 'active',
      progress: 0,
      tasks: [],
      createdAt: this.now().toISOString(),
    };
    week.goals.push(goal);
    this.pushEvent({
      kind: 'goal_created',
      rawText: title,
      summary: `新建目标：${title}`,
      relatedGoalId: goal.id,
    });
    this.save();
    return { goalId: goal.id };
  }

  addTask(goalId: string, title: string, due?: string): { taskId: string } {
    const goal = this.findGoalById(goalId);
    if (!goal) throw new Error(`NOT_FOUND: goal ${goalId}`);
    const task: Task = { id: randomUUID(), title, done: false, due };
    goal.tasks.push(task);
    this.save();
    return { taskId: task.id };
  }

  updateProgress(goalId: string, progress: number, note: string): { goalId: string; progress: number } {
    const goal = this.findGoalById(goalId);
    if (!goal) throw new Error(`NOT_FOUND: goal ${goalId}`);
    goal.progress = clampProgress(progress);
    goal.status = goal.progress >= 100 ? 'done' : 'active';
    this.pushEvent({
      kind: 'progress_update',
      rawText: note,
      summary: note,
      relatedGoalId: goalId,
    });
    this.save();
    return { goalId, progress: goal.progress };
  }

  completeTask(taskId: string): { taskId: string } {
    const located = this.locateTask(taskId);
    if (!located) throw new Error(`NOT_FOUND: task ${taskId}`);
    const { goal, task } = located;
    task.done = true;
    this.pushEvent({
      kind: 'task_done',
      rawText: task.title,
      summary: `完成待办：${task.title}`,
      relatedGoalId: goal.id,
    });
    this.save();
    return { taskId };
  }

  /** 重新打开待办（人工取消勾选）；落一条 note 事件 */
  reopenTask(taskId: string): { taskId: string } {
    const located = this.locateTask(taskId);
    if (!located) throw new Error(`NOT_FOUND: task ${taskId}`);
    const { goal, task } = located;
    task.done = false;
    this.pushEvent({
      kind: 'note',
      rawText: task.title,
      summary: `重新打开待办：${task.title}`,
      relatedGoalId: goal.id,
    });
    this.save();
    return { taskId };
  }

  /** 按当前状态切换待办完成（人工勾选） */
  toggleTask(taskId: string): { taskId: string; done: boolean } {
    const located = this.locateTask(taskId);
    if (!located) throw new Error(`NOT_FOUND: task ${taskId}`);
    if (located.task.done) {
      this.reopenTask(taskId);
      return { taskId, done: false };
    }
    this.completeTask(taskId);
    return { taskId, done: true };
  }

  /** 标题包含/分词/2-gram 宽松命中（不调 LLM，兼顾中文口语 query）；返回当前周匹配目标 */
  findGoals(query: string): Goal[] {
    const week = this.getCurrentWeek();
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return week.goals
      .filter((goal) => matchesGoal(goal.title.toLowerCase(), q))
      .map((goal) => structuredClone(goal));
  }

  getTask(taskId: string): Task | undefined {
    const located = this.locateTask(taskId);
    return located ? structuredClone(located.task) : undefined;
  }

  /** 幂等回填 reminderId（已有则不覆盖） */
  setReminderId(taskId: string, reminderId: string): void {
    const located = this.locateTask(taskId);
    if (!located) throw new Error(`NOT_FOUND: task ${taskId}`);
    if (located.task.reminderId) return;
    located.task.reminderId = reminderId;
    this.save();
  }

  /** 清空当前周的目标与进度流（保留 config 与历史周） */
  clearCurrentWeek(): void {
    const week = this.getCurrentWeek();
    week.goals = [];
    week.events = [];
    this.save();
  }

  // ── 配置 ──────────────────────────────────────────────────
  getConfig(): AppConfig {
    return structuredClone(this.data.config);
  }

  setConfig(patch: DeepPartial<AppConfig>): AppConfig {
    this.data.config = applyConfigPatch(this.data.config, patch);
    this.save();
    return structuredClone(this.data.config);
  }

  // ── Nudge 节流状态（持久化，跨重启去重） ──────────────────
  getNudgeLastSent(): Record<string, string> {
    return { ...(this.data.nudgeLastSent ?? {}) };
  }

  markNudgeSent(kind: string, day: string): void {
    this.data.nudgeLastSent = { ...(this.data.nudgeLastSent ?? {}), [kind]: day };
    this.save();
  }

  // ── 内部 ──────────────────────────────────────────────────
  private findGoalById(goalId: string): Goal | undefined {
    return this.getCurrentWeek().goals.find((g) => g.id === goalId);
  }

  private locateTask(taskId: string): { goal: Goal; task: Task } | undefined {
    for (const goal of this.getCurrentWeek().goals) {
      const task = goal.tasks.find((t) => t.id === taskId);
      if (task) return { goal, task };
    }
    return undefined;
  }

  /** 当前周原始数据（周报组装用，只读拷贝） */
  getCurrentWeekData(): WeeklyPlan {
    return structuredClone(this.getCurrentWeek());
  }

  /** 指定周（周报可指定 weekOf），不存在返回 undefined */
  getWeek(weekOf: string): WeeklyPlan | undefined {
    const week = this.data.weeks.find((w) => w.weekOf === weekOf);
    return week ? structuredClone(week) : undefined;
  }

  save(): void {
    this.persist(this.data);
  }
}
