/**
 * 执行工具 · 文件与检索（read/write/edit/list_dir/glob/grep）。
 * 范式参考成熟实现：tool()+zod，execute 经 runContext.context 取 workspace 定位 cwd。
 * 本期"开放最大权限"：默认锚定工作区，但允许绝对路径（与本机一致），不做硬隔离/审批。
 *
 * 工具契约 + 模型面 {error}/{note}（用于 agent 自救）一律英文；trace summary 是看板 UI 文案，保持中文。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { type RunContext, type Tool } from '@openai/agents-core';
import { z } from 'zod';
import type { AgentContext } from '../context';
import { resolveInWorkspace, rootOf } from '../workspace';
import { defineTool } from './define';

const MAX_READ_BYTES = 256 * 1024;
const MAX_LIST_ENTRIES = 500;
const MAX_GREP_MATCHES = 200;

function trace(rc: RunContext<AgentContext> | undefined, tool: string, summary: string): void {
  rc?.context?.trace.push({ tool, summary });
}

const readFileTool = defineTool({
  name: 'read_file',
  description:
    "Read a text file in the workspace (or an absolute path). Large files are truncated. To search contents use grep; to list a directory use list_dir.",
  parameters: z.object({
    path: z.string().describe('Path relative to the workspace root (NOT bash cwd), or absolute'),
    offset: z.number().int().min(0).optional().describe('Start line, 0-based'),
    limit: z.number().int().min(1).max(2000).optional().describe('Number of lines to read'),
  }),
  execute: async ({ path: target, offset, limit }, rc?: RunContext<AgentContext>) => {
    const abs = resolveInWorkspace(rootOf(rc), target);
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) return { error: `File not found: ${target}. Use glob or list_dir to locate it.` };
    if (stat.size > MAX_READ_BYTES && offset === undefined && limit === undefined) {
      const head = await fs.readFile(abs, 'utf-8').catch(() => '');
      trace(rc, 'read_file', `读取 ${target}（已截断）`);
      return {
        path: target,
        truncated: true,
        content: head.slice(0, MAX_READ_BYTES),
        note: 'File is large and was truncated; pass offset/limit to read a specific range.',
      };
    }
    const raw = await fs.readFile(abs, 'utf-8').catch((e) => {
      throw new Error(`Read failed: ${e instanceof Error ? e.message : String(e)}`);
    });
    let content = raw;
    if (offset !== undefined || limit !== undefined) {
      const lines = raw.split(/\r?\n/);
      const start = offset ?? 0;
      content = lines.slice(start, limit ? start + limit : undefined).join('\n');
    }
    trace(rc, 'read_file', `读取 ${target}`);
    return { path: target, content };
  },
});

const writeFileTool = defineTool({
  name: 'write_file',
  description:
    'Write or overwrite a file (parent dirs are created). Use for whole new files or full rewrites — to change a small unique snippet use edit_file, to run a command use bash. Good for producing HTML, docs, scripts.',
  parameters: z.object({
    path: z.string().describe('Path relative to the workspace root, or absolute'),
    content: z.string().describe('Full file content'),
  }),
  execute: async ({ path: target, content }, rc?: RunContext<AgentContext>) => {
    const abs = resolveInWorkspace(rootOf(rc), target);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf-8');
    trace(rc, 'write_file', `已写入 ${target}`);
    return { path: target, bytes: Buffer.byteLength(content, 'utf-8') };
  },
});

const editFileTool = defineTool({
  name: 'edit_file',
  description:
    'Replace a unique snippet in a file: old must match exactly once. For whole-file writes use write_file.',
  parameters: z.object({
    path: z.string().describe('Path relative to the workspace root, or absolute'),
    old: z.string().min(1).describe('Exact text to replace; must occur exactly once in the file'),
    new: z.string().describe('Replacement text'),
  }),
  execute: async ({ path: target, old, new: next }, rc?: RunContext<AgentContext>) => {
    const abs = resolveInWorkspace(rootOf(rc), target);
    const raw = await fs.readFile(abs, 'utf-8').catch(() => null);
    if (raw === null) return { error: `File not found: ${target}. Use glob or list_dir to locate it.` };
    const count = raw.split(old).length - 1;
    if (count === 0)
      return { error: 'old text not found — read_file first and copy an exact, unique snippet.' };
    if (count > 1)
      return { error: `old text matched ${count} times — include more surrounding context to make it unique.` };
    await fs.writeFile(abs, raw.replace(old, next), 'utf-8');
    trace(rc, 'edit_file', `已编辑 ${target}`);
    return { path: target, replaced: 1 };
  },
});

const listDirTool = defineTool({
  name: 'list_dir',
  description:
    'List a single directory\'s entries (relative to the workspace root, or absolute). To match paths recursively use glob.',
  parameters: z.object({ path: z.string().default('.').describe('Directory path; defaults to workspace root') }),
  execute: async ({ path: target }, rc?: RunContext<AgentContext>) => {
    const abs = resolveInWorkspace(rootOf(rc), target);
    const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => null);
    if (!entries) return { error: `Directory not found: ${target}. Use glob or list_dir on a parent to locate it.` };
    const items = entries
      .slice(0, MAX_LIST_ENTRIES)
      .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));
    const truncated = entries.length > MAX_LIST_ENTRIES;
    trace(rc, 'list_dir', `列出 ${target}（${items.length}）`);
    return {
      path: target,
      entries: items,
      truncated,
      ...(truncated ? { note: `Only the first ${MAX_LIST_ENTRIES} entries are shown; list a narrower path.` } : {}),
    };
  },
});

async function walk(dir: string, root: string, out: string[], cap: number): Promise<void> {
  if (out.length >= cap) return;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (out.length >= cap) break;
    if (entry.isSymbolicLink() || entry.name === 'node_modules' || entry.name === '.git') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(abs, root, out, cap);
    } else {
      out.push(path.relative(root, abs));
    }
  }
}

function globToRegExp(pattern: string): RegExp {
  const esc = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '@@GS@@')
    .replace(/\*\*/g, '@@G@@')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/@@GS@@/g, '(?:.*/)?')
    .replace(/@@G@@/g, '.*');
  return new RegExp(`^${esc}$`);
}

const globTool = defineTool({
  name: 'glob',
  description:
    'Match workspace file paths by glob pattern (e.g. **/*.html). To search file CONTENTS use grep; to list one directory use list_dir.',
  parameters: z.object({
    pattern: z.string().describe('Glob pattern, e.g. **/*.html or src/**/*.ts'),
    cwd: z.string().optional().describe('Optional start directory relative to the workspace root'),
  }),
  execute: async ({ pattern, cwd }, rc?: RunContext<AgentContext>) => {
    const root = rootOf(rc);
    const base = cwd ? resolveInWorkspace(root, cwd) : root;
    const all: string[] = [];
    await walk(base, root, all, 2000);
    const re = globToRegExp(pattern);
    const matches = all.filter((p) => re.test(p)).slice(0, MAX_LIST_ENTRIES);
    trace(rc, 'glob', `glob ${pattern}（${matches.length}）`);
    return {
      pattern,
      matches,
      ...(matches.length >= MAX_LIST_ENTRIES
        ? { note: `Capped at ${MAX_LIST_ENTRIES} matches; narrow the pattern or cwd.` }
        : {}),
    };
  },
});

const grepTool = defineTool({
  name: 'grep',
  description:
    'Search file CONTENTS by JavaScript regular expression across the workspace and return matching lines. To match file NAMES/paths use glob instead.',
  parameters: z.object({
    pattern: z.string().describe('JS RegExp source, e.g. function\\s+\\w+ (passed to new RegExp)'),
    path: z.string().optional().describe('Optional file or directory to limit the search (relative to workspace root)'),
  }),
  execute: async ({ pattern, path: target }, rc?: RunContext<AgentContext>) => {
    const root = rootOf(rc);
    const base = target ? resolveInWorkspace(root, target) : root;
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch {
      return { error: 'Invalid regular expression. Provide a valid JS RegExp source, e.g. TODO|FIXME.' };
    }
    const stat = await fs.stat(base).catch(() => null);
    const rels: string[] = [];
    if (stat?.isFile()) rels.push(path.relative(root, base));
    else if (stat?.isDirectory()) await walk(base, root, rels, 2000);
    else return { error: `Path not found: ${target}. Use glob or list_dir to locate it.` };

    const hits: { file: string; line: number; text: string }[] = [];
    for (const rel of rels) {
      if (hits.length >= MAX_GREP_MATCHES) break;
      const raw = await fs.readFile(path.join(root, rel), 'utf-8').catch(() => null);
      if (raw === null) continue;
      raw.split(/\r?\n/).forEach((text, i) => {
        if (hits.length < MAX_GREP_MATCHES && re.test(text)) {
          hits.push({ file: rel, line: i + 1, text: text.slice(0, 300) });
        }
      });
    }
    trace(rc, 'grep', `grep ${pattern}（${hits.length}）`);
    return { pattern, matches: hits };
  },
});

export function createFileTools(): Tool<AgentContext>[] {
  return [readFileTool, writeFileTool, editFileTool, listDirTool, globTool, grepTool];
}
