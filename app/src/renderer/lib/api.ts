/**
 * 渲染层 API client（函数式封装 + unwrap）。组件不直接碰 window.workmateAPI。
 * 真相源：docs/reference/ipc-contract.md §4。
 */

import type {
  AgentChunk,
  AppResult,
  DeepPartial,
  NudgePayload,
  SendMessageResult,
  TestProviderInput,
} from '@shared/ipc';
import type { Snapshot } from '@shared/types';
import type { AppConfig } from '@shared/config';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function unwrap<T>(res: AppResult<T>): T {
  if (res.ok) return res.data;
  throw new ApiError(res.error.code, res.error.message);
}

const api = () => window.workmateAPI;

export async function sendMessage(text: string): Promise<SendMessageResult> {
  return unwrap(await api().agent.sendMessage(text));
}

export function onAgentChunk(handler: (chunk: AgentChunk) => void): () => void {
  return api().agent.onChunk(handler);
}

export async function cancelAgent(): Promise<boolean> {
  return unwrap(await api().agent.cancel()).cancelled;
}

export async function toggleTask(taskId: string): Promise<Snapshot> {
  return unwrap(await api().board.toggleTask(taskId));
}

export async function addGoal(title: string): Promise<Snapshot> {
  return unwrap(await api().board.addGoal(title));
}

export async function addTask(goalId: string, title: string, due?: string): Promise<Snapshot> {
  return unwrap(await api().board.addTask(goalId, title, due));
}

export async function setProgress(goalId: string, progress: number): Promise<Snapshot> {
  return unwrap(await api().board.setProgress(goalId, progress));
}

export async function clearWeek(): Promise<Snapshot> {
  return unwrap(await api().board.clearWeek());
}

export async function getSnapshot(): Promise<Snapshot> {
  return unwrap(await api().snapshot.get());
}

export function onSnapshot(handler: (s: Snapshot) => void): () => void {
  return api().snapshot.onChange(handler);
}

export async function generateReport(weekOf?: string): Promise<string> {
  return unwrap(await api().report.generate(weekOf)).markdown;
}

export async function getConfig(): Promise<AppConfig> {
  return unwrap(await api().config.get());
}

export async function setConfig(patch: DeepPartial<AppConfig>): Promise<AppConfig> {
  return unwrap(await api().config.set(patch));
}

export async function testProvider(input: TestProviderInput): Promise<string> {
  return unwrap(await api().config.testProvider(input)).message;
}

export async function writeReminder(taskId: string): Promise<string> {
  return unwrap(await api().reminders.write(taskId)).reminderId;
}

export function onNudge(handler: (n: NudgePayload) => void): () => void {
  return api().nudge.onNotify(handler);
}
