/**
 * Workmate 数据模型 + 运行时类型（主进程与渲染进程共享）
 * 真相源：docs/design/product-design.md §5、docs/reference/agent-runtime.md §1
 */

export const DATA_VERSION = 1;

export type GoalStatus = 'active' | 'done';

export type ProgressEventKind = 'note' | 'progress_update' | 'goal_created' | 'task_done';

export interface Task {
  id: string;
  title: string;
  done: boolean;
  /** 可选 ISO 截止时间 */
  due?: string;
  /** 写入提醒事项后回填，用于幂等去重 */
  reminderId?: string;
}

export interface Goal {
  id: string;
  title: string;
  status: GoalStatus;
  /** 0–100，由 agent 归因更新 */
  progress: number;
  tasks: Task[];
  createdAt: string;
}

/** 进度流：所有输入与归因都进这条流，是周报的唯一原料 */
export interface ProgressEvent {
  id: string;
  timestamp: string;
  /** 用户原话 */
  rawText: string;
  kind: ProgressEventKind;
  /** 归因到的目标 */
  relatedGoalId?: string;
  /** agent 归一化后的简述，供周报使用 */
  summary: string;
}

export interface WeeklyPlan {
  /** 该周周一日期 "YYYY-MM-DD"，唯一标识一周 */
  weekOf: string;
  goals: Goal[];
  events: ProgressEvent[];
}

/** 运行时：当前周目标树 + 今日聚焦的快照（看板据此渲染） */
export interface Snapshot {
  weekOf: string;
  /** 今天 "YYYY-MM-DD" */
  today: string;
  /** 中文星期，如「周一」 */
  weekday: string;
  goals: Goal[];
  todayFocus: Task[];
}

/** 本次 agent run 调用过的 tool 简述（"看得见 agent 在干活"） */
export interface ToolTraceItem {
  tool: string;
  summary: string;
}
