/**
 * WorkmateData 的 zod schema —— 仅用于持久化加载时的运行时校验。
 * 与 types.ts 的接口结构一致；语义损坏（非 SyntaxError）的 JSON 在此被拒并重置。
 */

import { z } from 'zod';
import { AppConfigSchema } from './config';
import { DATA_VERSION } from './types';

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  due: z.string().optional(),
  reminderId: z.string().optional(),
});

const GoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'done']),
  progress: z.number(),
  tasks: z.array(TaskSchema),
  createdAt: z.string(),
});

const ProgressEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  rawText: z.string(),
  kind: z.enum(['note', 'progress_update', 'goal_created', 'task_done']),
  relatedGoalId: z.string().optional(),
  summary: z.string(),
});

const WeeklyPlanSchema = z.object({
  weekOf: z.string(),
  goals: z.array(GoalSchema),
  events: z.array(ProgressEventSchema),
});

export const WorkmateDataSchema = z.object({
  version: z.number().default(DATA_VERSION),
  weeks: z.array(WeeklyPlanSchema).default([]),
  config: AppConfigSchema.prefault({}),
  nudgeLastSent: z.record(z.string(), z.string()).optional(),
});
