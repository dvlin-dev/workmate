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

/** 单条工具执行日志（本地 JSONL 留存；失败时 status='error' + error 详情） */
export interface ToolLogRecord {
  /** ISO 时间戳 */
  ts: string;
  /** 工具名 */
  tool: string;
  /** ok=成功；error=抛错或约定的软失败（返回 { error } 字段） */
  status: 'ok' | 'error';
  /** 执行耗时（毫秒） */
  durationMs: number;
  /** 入参（已裁剪，防超长） */
  input?: unknown;
  /** 失败原因（message/stack 或软失败的 error 文案） */
  error?: string;
}

/**
 * 工具执行日志端口：所有工具经 defineTool 自动把每次执行（成功/失败）落到这里。
 * 实现见 tool-logger.ts（写 userData/logs/*.jsonl）；测试可注入内存实现。
 */
export interface ToolLogger {
  /** 日志目录（用于"打开日志目录"） */
  readonly dir: string;
  /** 追加一条记录；实现必须吞掉自身异常，绝不影响主流程 */
  record(rec: ToolLogRecord): void;
  /** 读取最近 N 条（倒序：最新在前），用于排查/展示 */
  readRecent(limit?: number): ToolLogRecord[];
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
  /** 工具执行日志（可选：测试不注入则不落盘） */
  toolLogger?: ToolLogger;
}

/** 提醒事项权限被拒错误（bridge 抛出，tool 捕获后口头引导） */
export class ReminderPermissionError extends Error {
  readonly code = 'REMINDER_PERMISSION_DENIED' as const;
  constructor(message = '提醒事项授权被拒绝') {
    super(message);
    this.name = 'ReminderPermissionError';
  }
}
