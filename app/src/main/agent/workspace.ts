/**
 * 工作区：agent 文件/bash 工具的产物根目录。
 * 默认 userData/workspace；首启确保存在。文件工具的相对路径锚定于此。
 * 注：本期"开放最大权限"——默认 cwd=工作区，但不强制硬隔离（允许绝对路径，与本机 shell 等价）。
 */

import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { RunContext } from '@openai/agents-core';
import type { AgentContext, Workspace } from './context';

let cached: Workspace | null = null;

export function getWorkspace(): Workspace {
  if (cached) return cached;
  const root = path.join(app.getPath('userData'), 'workspace');
  mkdirSync(root, { recursive: true });
  cached = { root };
  return cached;
}

/** 把相对路径解析到工作区根；绝对路径原样返回（开放权限） */
export function resolveInWorkspace(root: string, target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(root, target);
}

/** 执行工具的 cwd 锚点：优先用本次 run 注入的 workspace，缺省回退单例 */
export function rootOf(rc?: RunContext<AgentContext>): string {
  return rc?.context?.workspace?.root ?? getWorkspace().root;
}
