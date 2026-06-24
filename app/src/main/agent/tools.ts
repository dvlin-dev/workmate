/**
 * Workmate 目标管理工具集。写法统一经 defineTool（自带执行日志埋点）+ zod。
 * execute 经 runContext.context 取 AgentContext，返回结构化对象，并 push 一条 trace。
 * 不变量：
 *  - create_goal / complete_task / complete_goal / log_event 在 Store 内部自动落事件。
 *  - 进度是**派生值**：只能通过完成待办（complete_task）或整体收口（complete_goal）推动，
 *    没有"设置百分比"的工具——百分比由 store 按完成比例自动算。
 * 真相源：docs/reference/agent-runtime.md §4。
 */

import { type RunContext, type Tool } from '@openai/agents-core';
import { z } from 'zod';
import type { AgentContext } from './context';
import { ReminderPermissionError } from './context';
import { defineTool } from './tools/define';

function ctxOf(rc?: RunContext<AgentContext>): AgentContext {
  if (!rc?.context) throw new Error('INTERNAL: missing AgentContext');
  return rc.context;
}

export function createWorkmateTools(): Tool<AgentContext>[] {
  const createGoal = defineTool({
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

  const addTask = defineTool({
    name: 'add_task',
    description: '给某个目标添加一个待办。进度会按"完成待办/总待办"自动计算，所以拆得越细进度越准。',
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

  const completeTask = defineTool({
    name: 'complete_task',
    description:
      '把某个待办标记为完成。这是推动目标进度的主要方式——完成一个待办，进度按比例自动上涨。taskId 可从 find_goal 返回的待办清单里取。',
    parameters: z.object({ taskId: z.string().describe('待办 id') }),
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
      '把整个目标标记为完成（会勾全其下待办、进度置 100%）。用于用户说"整个目标做完了/上线了"，又不便逐条勾选时。',
    parameters: z.object({ goalId: z.string().describe('目标 id') }),
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
      '按关键词查找当前周目标，用于归因前定位。返回每个目标的待办清单（含 taskId），便于据此 complete_task。返回空数组时应反问用户。',
    parameters: z.object({ query: z.string().min(1).describe('查询关键词') }),
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
      '往进度流写一条事件（纯笔记或补充归因）。用于"有进展但没有可勾选的具体待办"时记录——注意它不改变进度条。',
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

  const writeReminder = defineTool({
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
    description: '基于本周进度流生成叙事性周报 markdown。用户要"周报/总结这周"时调用。',
    parameters: z.object({ weekOf: z.string().optional().describe('可选指定周（周一日期）') }),
    execute: async ({ weekOf }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const markdown = await ctx.report.generate(weekOf);
      ctx.trace.push({ tool: 'generate_report', summary: '已生成周报' });
      return { markdown };
    },
  });

  const getSnapshot = defineTool({
    name: 'get_snapshot',
    description: '读取当前周目标树与今日聚焦的快照，用于自查上下文。',
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
      '按 name 加载一个已启用的技能（skill）的完整内容与本地文件引用，据此执行任务。当任务匹配某技能的 description 时先调用它。',
    parameters: z.object({ name: z.string().min(1).describe('技能名（kebab-case）') }),
    execute: async ({ name }, rc?: RunContext<AgentContext>) => {
      const ctx = ctxOf(rc);
      const detail = ctx.skills ? await ctx.skills.loadSkillForTool(name) : null;
      if (!detail) {
        ctx.trace.push({ tool: 'skill', summary: `技能「${name}」未找到或未启用`, ok: false });
        return { error: '技能未找到或未启用', name };
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
