/**
 * 执行工具 · bash。spawn 直接执行 shell，默认 cwd=工作区。
 * 本期"开放最大权限"：无沙箱、无审批、无白名单门禁。输出做头尾截断防撑爆上下文。
 * 预留 approve 钩子位（默认直通），未来要补审批时在此接入，不必重构。
 */

import { spawn } from 'node:child_process';
import { type RunContext, type Tool } from '@openai/agents-core';
import { z } from 'zod';
import type { AgentContext } from '../context';
import { getWorkspace, resolveInWorkspace } from '../workspace';
import { defineTool } from './define';

const DEFAULT_TIMEOUT = 120_000; // 2min
const MAX_TIMEOUT = 180_000; // 3min
const MAX_OUTPUT = 30_000; // 字符上限，超出头尾保留

function clamp(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  const half = Math.floor(MAX_OUTPUT / 2);
  return `${text.slice(0, half)}\n…(output truncated, ${text.length - MAX_OUTPUT} chars elided — re-run filtered with head/tail/grep or redirect to a file then read_file it)…\n${text.slice(-half)}`;
}

interface RunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function runShell(command: string, cwd: string, timeout: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, env: process.env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);
    child.stdout.on('data', (d) => {
      if (stdout.length < MAX_OUTPUT * 2) stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      if (stderr.length < MAX_OUTPUT * 2) stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ exitCode: null, stdout, stderr: stderr + String(err), timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, timedOut });
    });
  });
}

const bashTool = defineTool({
  name: 'bash',
  description: [
    'Run a shell command in the workspace (full permissions, no sandbox; default cwd = workspace root).',
    'Good for: running commands, builds, git, npx/pnpm, scripts, previewing artifacts.',
    'For reading/searching/editing files, prefer the dedicated tools (read_file/glob/grep/edit_file) — they return structured, capped output.',
    'For long output, filter with head/tail/grep or redirect to a file then read it.',
    'After running, check exitCode/timedOut before reporting done — non-zero or timeout means it failed.',
  ].join('\n'),
  parameters: z.object({
    command: z.string().min(1).describe('Full command line including arguments'),
    cwd: z.string().optional().describe('Working directory relative to the workspace root'),
    timeout: z.number().int().min(1000).max(MAX_TIMEOUT).default(DEFAULT_TIMEOUT).describe('Timeout in milliseconds'),
  }),
  execute: async ({ command, cwd, timeout }, rc?: RunContext<AgentContext>) => {
    const root = rc?.context?.workspace?.root ?? getWorkspace().root;
    const workdir = cwd ? resolveInWorkspace(root, cwd) : root;
    const result = await runShell(command, workdir, timeout);
    rc?.context?.trace.push({
      tool: 'bash',
      summary: `$ ${command.length > 48 ? command.slice(0, 48) + '…' : command}`,
    });
    return {
      command,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: clamp(result.stdout),
      stderr: clamp(result.stderr),
    };
  },
});

export function createBashTool(): Tool<AgentContext>[] {
  return [bashTool];
}
