/**
 * 执行工具 · 文件与检索（read/write/edit/list_dir/glob/grep）。
 * 范式参考成熟实现：tool()+zod，execute 经 runContext.context 取 workspace 定位 cwd。
 * 本期"开放最大权限"：默认锚定工作区，但允许绝对路径（与本机一致），不做硬隔离/审批。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { type RunContext, type Tool } from '@openai/agents-core';
import { z } from 'zod';
import type { AgentContext } from '../context';
import { getWorkspace, resolveInWorkspace } from '../workspace';
import { defineTool } from './define';

const MAX_READ_BYTES = 256 * 1024;
const MAX_LIST_ENTRIES = 500;
const MAX_GREP_MATCHES = 200;

function rootOf(rc?: RunContext<AgentContext>): string {
  return rc?.context?.workspace?.root ?? getWorkspace().root;
}

function trace(rc: RunContext<AgentContext> | undefined, tool: string, summary: string): void {
  rc?.context?.trace.push({ tool, summary });
}

const readFileTool = defineTool({
  name: 'read_file',
  description: '读取工作区内（或绝对路径）文件内容。大文件按行截断。',
  parameters: z.object({
    path: z.string().describe('相对工作区或绝对路径'),
    offset: z.number().int().min(0).optional().describe('起始行（0-based）'),
    limit: z.number().int().min(1).max(2000).optional().describe('读取行数'),
  }),
  execute: async ({ path: target, offset, limit }, rc?: RunContext<AgentContext>) => {
    const abs = resolveInWorkspace(rootOf(rc), target);
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) return { error: `文件不存在：${target}` };
    if (stat.size > MAX_READ_BYTES && offset === undefined && limit === undefined) {
      const head = await fs.readFile(abs, 'utf-8').catch(() => '');
      trace(rc, 'read_file', `读取 ${target}（已截断）`);
      return { path: target, truncated: true, content: head.slice(0, MAX_READ_BYTES) };
    }
    const raw = await fs.readFile(abs, 'utf-8').catch((e) => {
      throw new Error(`读取失败：${e instanceof Error ? e.message : String(e)}`);
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
  description: '写入/覆盖文件（缺失目录自动创建）。用于产出 HTML、文档等。',
  parameters: z.object({
    path: z.string().describe('相对工作区或绝对路径'),
    content: z.string().describe('完整文件内容'),
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
  description: '把文件中的 old 文本替换为 new 文本（old 必须唯一匹配）。',
  parameters: z.object({
    path: z.string().describe('相对工作区或绝对路径'),
    old: z.string().min(1).describe('要替换的原文本（需唯一）'),
    new: z.string().describe('替换后的新文本'),
  }),
  execute: async ({ path: target, old, new: next }, rc?: RunContext<AgentContext>) => {
    const abs = resolveInWorkspace(rootOf(rc), target);
    const raw = await fs.readFile(abs, 'utf-8').catch(() => null);
    if (raw === null) return { error: `文件不存在：${target}` };
    const count = raw.split(old).length - 1;
    if (count === 0) return { error: 'old 文本未匹配' };
    if (count > 1) return { error: `old 文本匹配到 ${count} 处，需唯一` };
    await fs.writeFile(abs, raw.replace(old, next), 'utf-8');
    trace(rc, 'edit_file', `已编辑 ${target}`);
    return { path: target, replaced: 1 };
  },
});

const listDirTool = defineTool({
  name: 'list_dir',
  description: '列出目录内容（相对工作区或绝对路径）。',
  parameters: z.object({ path: z.string().default('.').describe('目录路径') }),
  execute: async ({ path: target }, rc?: RunContext<AgentContext>) => {
    const abs = resolveInWorkspace(rootOf(rc), target);
    const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => null);
    if (!entries) return { error: `目录不存在：${target}` };
    const items = entries
      .slice(0, MAX_LIST_ENTRIES)
      .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));
    trace(rc, 'list_dir', `列出 ${target}（${items.length}）`);
    return { path: target, entries: items, truncated: entries.length > MAX_LIST_ENTRIES };
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
  description: '按 glob 模式匹配工作区文件名（如 **/*.html）。',
  parameters: z.object({
    pattern: z.string().describe('glob 模式'),
    cwd: z.string().optional().describe('相对工作区的起始目录'),
  }),
  execute: async ({ pattern, cwd }, rc?: RunContext<AgentContext>) => {
    const root = rootOf(rc);
    const base = cwd ? resolveInWorkspace(root, cwd) : root;
    const all: string[] = [];
    await walk(base, root, all, 2000);
    const re = globToRegExp(pattern);
    const matches = all.filter((p) => re.test(p)).slice(0, MAX_LIST_ENTRIES);
    trace(rc, 'glob', `glob ${pattern}（${matches.length}）`);
    return { pattern, matches };
  },
});

const grepTool = defineTool({
  name: 'grep',
  description: '在工作区文件内容中检索正则/字符串，返回命中行。',
  parameters: z.object({
    pattern: z.string().describe('正则或字符串'),
    path: z.string().optional().describe('限定目录/文件（相对工作区）'),
  }),
  execute: async ({ pattern, path: target }, rc?: RunContext<AgentContext>) => {
    const root = rootOf(rc);
    const base = target ? resolveInWorkspace(root, target) : root;
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch {
      return { error: '非法正则' };
    }
    const stat = await fs.stat(base).catch(() => null);
    const rels: string[] = [];
    if (stat?.isFile()) rels.push(path.relative(root, base));
    else if (stat?.isDirectory()) await walk(base, root, rels, 2000);
    else return { error: `路径不存在：${target}` };

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
