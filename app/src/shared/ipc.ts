/**
 * IPC 契约（主进程 ↔ 渲染进程）
 * 真相源：docs/reference/ipc-contract.md
 */

import type { AppConfig } from './config';
import type { Snapshot, ToolTraceItem } from './types';

/** 通道名集中常量（domain:action 点分串） */
export const CH = {
  ping: 'app:ping',
  agentSendMessage: 'agent:sendMessage',
  agentChunk: 'agent:chunk',
  agentCancel: 'agent:cancel',
  snapshotGet: 'snapshot:get',
  snapshotChanged: 'snapshot:changed',
  reportGenerate: 'report:generate',
  configGet: 'config:get',
  configSet: 'config:set',
  configTestProvider: 'config:testProvider',
  remindersWrite: 'reminders:write',
  nudgeNotify: 'nudge:notify',
  menuOpenSettings: 'menu:open-settings',
  boardToggleTask: 'board:toggleTask',
  boardAddGoal: 'board:addGoal',
  boardAddTask: 'board:addTask',
  boardClearWeek: 'board:clearWeek',
  skillsList: 'skills:list',
  skillsGetDetail: 'skills:getDetail',
  skillsSetEnabled: 'skills:setEnabled',
  skillsOpenDirectory: 'skills:openDirectory',
  logsOpenDirectory: 'logs:openDirectory',
} as const;

export type AppErrorCode =
  | 'LLM_TIMEOUT'
  | 'LLM_ERROR'
  | 'CONFIG_REQUIRED'
  | 'REMINDER_PERMISSION_DENIED'
  | 'REMINDER_FAILED'
  | 'NOT_FOUND'
  | 'BAD_INPUT'
  | 'INTERNAL';

/** 统一结果信封：主进程 handler 返回，渲染层 lib/api 解包 */
export type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode; message: string } };

export interface SendMessageResult {
  /** 搭子最终文本 */
  reply: string;
  /** 该轮后的最新快照（看板据此刷新） */
  snapshot: Snapshot;
  /** 本轮调过的 tool 简述 */
  toolTrace: ToolTraceItem[];
}

/**
 * 流式增量：文本逐字 / 工具足迹逐条 / 看板快照（tool 改写 store 后实时下发，看板即时刷新）。
 * done/error 由 sendMessage 的 invoke 结果承载。
 */
export type AgentChunk =
  | { kind: 'text'; delta: string }
  | { kind: 'tool'; item: ToolTraceItem }
  | { kind: 'snapshot'; snapshot: Snapshot };

/** 测试连接入参（无状态：用表单值而非已存 config） */
export interface TestProviderInput {
  baseURL: string;
  apiKey: string;
  model: string;
}

export type NudgeKind = 'evening' | 'stall' | 'friday';

export interface NudgePayload {
  kind: NudgeKind;
  message: string;
}

/** 技能（skill）摘要（渲染层列表用） */
export interface SkillSummary {
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  location: string;
  updatedAt: number;
}

/** 技能详情（含正文与文件引用） */
export interface SkillDetail extends SkillSummary {
  content: string;
  files: string[];
}

/** 深度可选（config:set 的 patch 入参） */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export interface WorkmateApi {
  ping(): Promise<AppResult<{ pong: true; version: string }>>;
  /** 菜单「设置…」(⌘,) 触发；返回退订函数 */
  onOpenSettings(handler: () => void): () => void;
  agent: {
    sendMessage(text: string): Promise<AppResult<SendMessageResult>>;
    /** 中断当前进行中的一轮（流式停止）；保留已收到的部分回复 */
    cancel(): Promise<AppResult<{ cancelled: boolean }>>;
    /** 订阅本轮流式增量；返回退订函数 */
    onChunk(handler: (chunk: AgentChunk) => void): () => void;
  };
  /** 看板人工操作（人机协作）：每个都返回更新后的快照，并广播 snapshot:changed */
  board: {
    toggleTask(taskId: string): Promise<AppResult<Snapshot>>;
    addGoal(title: string): Promise<AppResult<Snapshot>>;
    addTask(goalId: string, title: string, due?: string): Promise<AppResult<Snapshot>>;
    /** 清空当前周的目标与进度流（保留配置与历史周） */
    clearWeek(): Promise<AppResult<Snapshot>>;
  };
  snapshot: {
    get(): Promise<AppResult<Snapshot>>;
    onChange(handler: (snapshot: Snapshot) => void): () => void;
  };
  report: {
    generate(weekOf?: string): Promise<AppResult<{ markdown: string }>>;
  };
  config: {
    get(): Promise<AppResult<AppConfig>>;
    set(patch: DeepPartial<AppConfig>): Promise<AppResult<AppConfig>>;
    testProvider(input: TestProviderInput): Promise<AppResult<{ message: string }>>;
  };
  reminders: {
    write(taskId: string): Promise<AppResult<{ reminderId: string }>>;
  };
  /** 技能管理（开放平台）：查看 / 启停 / 打开目录 */
  skills: {
    list(): Promise<AppResult<SkillSummary[]>>;
    getDetail(name: string): Promise<AppResult<SkillDetail>>;
    setEnabled(name: string, enabled: boolean): Promise<AppResult<SkillSummary>>;
    openDirectory(name: string): Promise<AppResult<void>>;
  };
  /** 工具执行日志（本地留存）：在访达打开日志目录 */
  logs: {
    openDirectory(): Promise<AppResult<void>>;
  };
  nudge: {
    onNotify(handler: (payload: NudgePayload) => void): () => void;
  };
}
