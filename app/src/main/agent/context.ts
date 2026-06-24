/**
 * Agent 运行时的上下文与端口（hexagonal ports）。
 * tool 经 runContext.context 读取；reminders/report 由各自适配器实现。
 * 真相源：docs/reference/agent-runtime.md §3。
 */

import type { ToolTraceItem } from '@shared/types';
import type { WorkmateStore } from '../store';

/** 提醒事项桥（osascript 实现见 reminders/bridge.ts；测试用 mock） */
export interface ReminderBridge {
  /** 低层：纯写入，返回 reminderId */
  writeReminder(task: { title: string; due?: string }): Promise<string>;
  /** 高层：查 Store → 幂等 → 写入 → 回填落盘，返回 reminderId */
  writeReminderById(taskId: string): Promise<string>;
}

/** 周报服务（实现见 report.ts） */
export interface ReportService {
  generate(weekOf?: string): Promise<string>;
}

/** Skills 端口：agent 的 skill 工具按名加载已启用技能正文 */
export interface SkillsPort {
  /** 仅启用项的 <available_skills> 清单（注入 system prompt） */
  getAvailableSkillsPrompt(): string;
  /** 按名加载已启用 skill 的正文与文件引用；未启用/未找到返回 null */
  loadSkillForTool(name: string): Promise<{ name: string; content: string; location: string; files: string[] } | null>;
}

/** 工作区：agent 文件/bash 工具的产物根目录 */
export interface Workspace {
  root: string;
}

/** 每次 run 注入的上下文。时间统一由 Store 的 now 负责，故此处不再注入 now。 */
export interface AgentContext {
  store: WorkmateStore;
  reminders: ReminderBridge;
  report: ReportService;
  /** 本次 run 的工具足迹（tool 内 push） */
  trace: ToolTraceItem[];
  /** Skills 端口（可选：无 skills 时为 undefined） */
  skills?: SkillsPort;
  /** 工作区（执行工具用；可选） */
  workspace?: Workspace;
}

/** 提醒事项权限被拒错误（bridge 抛出，tool 捕获后口头引导） */
export class ReminderPermissionError extends Error {
  readonly code = 'REMINDER_PERMISSION_DENIED' as const;
  constructor(message = '提醒事项授权被拒绝') {
    super(message);
    this.name = 'ReminderPermissionError';
  }
}
