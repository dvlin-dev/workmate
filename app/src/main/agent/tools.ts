/**
 * Workmate 目标管理工具集。写法统一经 defineTool（自带执行日志埋点）+ zod。
 * execute 经 runContext.context 取 AgentContext，返回结构化对象，并 push 一条 trace。
 *
 * 工具契约（name/description/.describe）一律英文——模型面机器契约，跨 provider 对齐更稳；
 * 而 ctx.trace.push({summary}) 是看板 UI 文案、surfaced {error} 是用户面文案，保持中文。
 * 不变量：
 *  - create_goal / complete_task / complete_goal / log_event 在 Store 内部自动落事件。
 *  - 进度是**派生值**：只能通过完成待办（complete_task）或整体收口（complete_goal）推动，
 *    没有"设置百分比"的工具——百分比由 store 按完成比例自动算。
 * 真相源：docs/reference/agent-runtime.md §4。
 */

import { type RunContext, type Tool } from '@openai/agents-core';
import { z } from 'zod';
import type { AgentContext } from './context';
import { ReminderPermissionError } from '../reminders/errors';
import { defineTool } from './tools/define';

function ctxOf(rc?: RunContext<AgentContext>): AgentContext {
  if (!rc?.context) throw new Error('INTERNAL: missing AgentContext');
  return rc.context;
}

export function createWorkmateTools(): Tool<AgentContext>[] {
  const createGoal = defineTool({
    name: 'create_goal',
    description:
      'Create a goal for the current week. Use when the user states a plan or intention for the week. Usually follow up with add_task to split it into checkable steps so progress can be tracked.',
    parameters: z.object({ title: z.string().min(1).describe('Goal title, e.g. 订单服务 v2 重构') }),
    execute: ({ title }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.createGoal(title);
      ctx.trace.push({ tool: 'create_goal', summary: `已新建目标「${title}」` });
      return res;
    },
  });

  const addTask = defineTool({
    name: 'add_task',
    description:
      'Add one checklist task to a goal. Goal progress is derived as done/total tasks, so split goals into small checkable steps for accurate, movable progress.',
    parameters: z.object({
      goalId: z.string().describe('Goal id from find_goal or get_snapshot — never invent one'),
      title: z.string().min(1).describe('Task title, e.g. 拆出库存耦合'),
      due: z
        .string()
        .optional()
        .describe('Optional ISO-8601 datetime with timezone, e.g. 2026-06-27T18:00:00+08:00'),
    }),
    execute: ({ goalId, title, due }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.addTask(goalId, title, due);
      ctx.trace.push({ tool: 'add_task', summary: `已添加待办「${title}」` });
      return res;
    },
  });

  const completeTask = defineTool({
    name: 'complete_task',
    description:
      'Mark one task done — the primary way to advance a goal (progress rises by its share). Get the taskId from find_goal. For "the whole goal is finished" use complete_goal instead.',
    parameters: z.object({
      taskId: z.string().describe('Task id from find_goal — never invent one'),
    }),
    execute: ({ taskId }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.completeTask(taskId);
      ctx.trace.push({ tool: 'complete_task', summary: '已完成一个待办' });
      return res;
    },
  });

  const completeGoal = defineTool({
    name: 'complete_goal',
    description:
      'Mark an entire goal done: bulk-completes every task under it and sets progress to 100%. Hard to undo — to finish just one task use complete_task. Use when the user says the whole goal is done/shipped and ticking each task is impractical.',
    parameters: z.object({
      goalId: z.string().describe('Goal id from find_goal or get_snapshot — never invent one'),
    }),
    execute: ({ goalId }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.completeGoal(goalId);
      ctx.trace.push({ tool: 'complete_goal', summary: `已完成目标「${res.title}」` });
      return res;
    },
  });

  const findGoal = defineTool({
    name: 'find_goal',
    description:
      'Look up current-week goals by keyword before attributing progress. Returns matching goals with their task lists and taskIds — use those taskIds for complete_task. For the full current-week tree (not a keyword search) use get_snapshot. If it returns no match, ask the user which goal to attribute to.',
    parameters: z.object({
      query: z.string().min(1).describe('Keyword matched against goal titles, e.g. 登录联调'),
    }),
    execute: ({ query }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const matches = ctx.store.findGoals(query).map((g) => ({
        goalId: g.id,
        title: g.title,
        progress: g.progress,
        status: g.status,
        tasks: g.tasks.map((t) => ({ taskId: t.id, title: t.title, done: t.done })),
      }));
      ctx.trace.push({ tool: 'find_goal', summary: `查找「${query}」命中 ${matches.length} 个` });
      return { matches };
    },
  });

  const logEvent = defineTool({
    name: 'log_event',
    description:
      'Append one event to the progress stream — a note or supplementary attribution. Use when there is real progress but no specific task to check off. Does NOT advance the progress bar; to move progress, use complete_task.',
    parameters: z.object({
      rawText: z.string().describe("The user's own words"),
      kind: z
        .enum(['note', 'progress_update', 'goal_created', 'task_done'])
        .default('note')
        .describe('Event kind; use "note" for a plain note'),
      summary: z.string().describe('One-line normalized summary'),
      relatedGoalId: z.string().optional().describe('Optional goal id this event relates to'),
    }),
    execute: ({ rawText, kind, summary, relatedGoalId }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const res = ctx.store.appendEvent({ kind, rawText, summary, relatedGoalId });
      ctx.trace.push({ tool: 'log_event', summary: '已记录一条进度事件' });
      return res;
    },
  });

  const writeReminder = defineTool({
    name: 'write_reminder',
    description:
      'Write a task into macOS Reminders. Idempotent: a task that already has a reminderId is not written again. Use when a task has a time or clearly warrants a system reminder. On failure returns { error, needsPermission } instead of throwing.',
    parameters: z.object({
      taskId: z
        .string()
        .describe('Task id from find_goal or get_snapshot — never invent one'),
    }),
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
          ok: false,
        });
        return {
          error: error instanceof Error ? error.message : '写入提醒事项失败',
          needsPermission,
        };
      }
    },
  });

  const generateReport = defineTool({
    name: 'generate_report',
    description:
      "Generate the narrative weekly-report markdown from this week's progress stream. Call when the user asks for a weekly report or to sum up the week.",
    parameters: z.object({
      weekOf: z
        .string()
        .optional()
        .describe('Optional Monday-anchored ISO date, e.g. 2026-06-22; must be a Monday; omit for the current week'),
    }),
    execute: async ({ weekOf }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const markdown = await ctx.report.generate(weekOf);
      ctx.trace.push({ tool: 'generate_report', summary: '已生成周报' });
      return { markdown };
    },
  });

  const getSnapshot = defineTool({
    name: 'get_snapshot',
    description:
      "Read the full current-week goal tree and today's focus (goals, tasks and their ids). Use to self-check context, or to get goal/task ids when you have no keyword to give find_goal.",
    parameters: z.object({}),
    execute: (_input, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      ctx.trace.push({ tool: 'get_snapshot', summary: '已读取当前快照' });
      return ctx.store.getSnapshot();
    },
  });

  const skill = defineTool({
    name: 'skill',
    description:
      "Load an enabled skill's full SKILL.md body and its local file references so you can follow it. Use when the task matches a skill's description in <available_skills> — load it BEFORE using file/bash/web tools to execute. Only enabled skills load; if it returns { error } the skill is missing or disabled — check the <available_skills> list.",
    parameters: z.object({
      name: z
        .string()
        .min(1)
        .describe('Skill name in kebab-case, matching a <name> in <available_skills>; do not invent one'),
    }),
    execute: async ({ name }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const detail = ctx.skills ? await ctx.skills.loadSkillForTool(name) : null;
      if (!detail) {
        ctx.trace.push({ tool: 'skill', summary: `技能「${name}」未找到或未启用`, ok: false });
        return { error: 'Skill not found or not enabled', name };
      }
      ctx.trace.push({ tool: 'skill', summary: `已加载技能「${name}」` });
      return {
        name: detail.name,
        content: detail.content,
        baseDir: detail.location,
        files: detail.files,
      };
    },
  });

  return [
    createGoal,
    addTask,
    completeTask,
    completeGoal,
    findGoal,
    logEvent,
    writeReminder,
    generateReport,
    getSnapshot,
    skill,
  ];
}
