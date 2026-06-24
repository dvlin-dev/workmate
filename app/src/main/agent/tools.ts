/**
 * Workmate 工具集（9 个）。写法：tool({name,description,parameters:zod,execute})。
 * execute 经 runContext.context 取 AgentContext，返回结构化对象，并 push 一条 trace。
 * 不变量：create_goal/update_progress/complete_task 在 Store 内部自动落事件。
 * 真相源：docs/reference/agent-runtime.md §4。
 */

import { tool, type RunContext, type Tool } from '@openai/agents-core';
import { z } from 'zod';
import type { AgentContext } from './context';
import { ReminderPermissionError } from './context';

function ctxOf(rc?: RunContext<AgentContext>): AgentContext {
  if (!rc?.context) throw new Error('INTERNAL: missing AgentContext');
  return rc.context;
}

export function createWorkmateTools(): Tool<AgentContext>[] {
  const createGoal = tool({
    name: 'create_goal',
    description: '新建一个本周目标。用户表达计划/目标时调用。',
    parameters: z.object({ title: z.string().min(1).describe('目标标题') }),
    execute: ({ title }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.createGoal(title);
      ctx.trace.push({ tool: 'create_goal', summary: `已新建目标「${title}」` });
      return res;
    },
  });

  const addTask = tool({
    name: 'add_task',
    description: '给某个目标添加一个待办。',
    parameters: z.object({
      goalId: z.string().describe('目标 id'),
      title: z.string().min(1).describe('待办标题'),
      due: z.string().optional().describe('可选 ISO 截止时间'),
    }),
    execute: ({ goalId, title, due }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.addTask(goalId, title, due);
      ctx.trace.push({ tool: 'add_task', summary: `已添加待办「${title}」` });
      return res;
    },
  });

  const updateProgress = tool({
    name: 'update_progress',
    description: '更新某个目标的进度（0–100）并归因。用户报告进展时调用。',
    parameters: z.object({
      goalId: z.string().describe('目标 id'),
      progress: z.number().int().min(0).max(100).describe('0–100 的进度估计'),
      note: z.string().describe('一句归一化的进展简述'),
    }),
    execute: ({ goalId, progress, note }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.updateProgress(goalId, progress, note);
      ctx.trace.push({ tool: 'update_progress', summary: `进度更新到 ${res.progress}%` });
      return res;
    },
  });

  const completeTask = tool({
    name: 'complete_task',
    description: '把某个待办标记为完成。',
    parameters: z.object({ taskId: z.string().describe('待办 id') }),
    execute: ({ taskId }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.completeTask(taskId);
      ctx.trace.push({ tool: 'complete_task', summary: '已完成一个待办' });
      return res;
    },
  });

  const findGoal = tool({
    name: 'find_goal',
    description: '按关键词查找当前周目标，用于归因前定位。返回空数组时应反问用户。',
    parameters: z.object({ query: z.string().min(1).describe('查询关键词') }),
    execute: ({ query }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const matches = ctx.store.findGoals(query).map((g) => ({
        goalId: g.id,
        title: g.title,
        progress: g.progress,
        status: g.status,
      }));
      ctx.trace.push({ tool: 'find_goal', summary: `查找「${query}」命中 ${matches.length} 个` });
      return { matches };
    },
  });

  const logEvent = tool({
    name: 'log_event',
    description: '往进度流写一条事件（纯笔记或补充归因）。',
    parameters: z.object({
      rawText: z.string().describe('用户原话'),
      kind: z
        .enum(['note', 'progress_update', 'goal_created', 'task_done'])
        .default('note')
        .describe('事件类型'),
      summary: z.string().describe('归一化简述'),
      relatedGoalId: z.string().optional().describe('归属目标 id，可选'),
    }),
    execute: ({ rawText, kind, summary, relatedGoalId }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.appendEvent({ kind, rawText, summary, relatedGoalId });
      ctx.trace.push({ tool: 'log_event', summary: '已记录一条进度事件' });
      return res;
    },
  });

  const writeReminder = tool({
    name: 'write_reminder',
    description: '把某个待办写入 macOS「提醒事项」（幂等）。失败不抛错，返回 error 让你口头引导授权。',
    parameters: z.object({ taskId: z.string().describe('待办 id') }),
    execute: async ({ taskId }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      try {
        const reminderId = await ctx.reminders.writeReminderById(taskId);
        ctx.trace.push({ tool: 'write_reminder', summary: '已写入提醒事项' });
        return { reminderId };
      } catch (error) {
        const needsPermission = error instanceof ReminderPermissionError;
        ctx.trace.push({
          tool: 'write_reminder',
          summary: needsPermission ? '提醒事项需授权' : '提醒事项写入失败',
        });
        return {
          error: error instanceof Error ? error.message : '写入提醒事项失败',
          needsPermission,
        };
      }
    },
  });

  const generateReport = tool({
    name: 'generate_report',
    description: '基于本周进度流生成叙事性周报 markdown。用户要"周报/总结这周"时调用。',
    parameters: z.object({ weekOf: z.string().optional().describe('可选指定周（周一日期）') }),
    execute: async ({ weekOf }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const markdown = await ctx.report.generate(weekOf);
      ctx.trace.push({ tool: 'generate_report', summary: '已生成周报' });
      return { markdown };
    },
  });

  const getSnapshot = tool({
    name: 'get_snapshot',
    description: '读取当前周目标树与今日聚焦的快照，用于自查上下文。',
    parameters: z.object({}),
    execute: (_input, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      ctx.trace.push({ tool: 'get_snapshot', summary: '已读取当前快照' });
      return ctx.store.getSnapshot();
    },
  });

  return [
    createGoal,
    addTask,
    updateProgress,
    completeTask,
    findGoal,
    logEvent,
    writeReminder,
    generateReport,
    getSnapshot,
  ];
}
