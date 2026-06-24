import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RunContext, type Tool } from '@openai/agents-core';
import {
  parseSkillFromDirectory,
  toKebabCase,
  isInsidePath,
} from '../src/main/skills/file-utils';
import { createWorkmateTools } from '../src/main/agent/tools';
import { createFileTools } from '../src/main/agent/tools/fs';
import { createBashTool } from '../src/main/agent/tools/bash';
import type { AgentContext, SkillsPort } from '../src/main/agent/context';
import type { ToolTraceItem } from '../src/shared/types';

let tmp = '';
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-skills-'));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function makeCtx(overrides?: Partial<AgentContext>): AgentContext {
  const trace: ToolTraceItem[] = [];
  return {
    // store/reminders/report 不被文件/bash 工具用到，给最小占位
    store: undefined as never,
    reminders: undefined as never,
    report: undefined as never,
    trace,
    workspace: { root: tmp },
    ...overrides,
  };
}

async function invoke(tools: Tool<AgentContext>[], name: string, input: Record<string, unknown>, ctx: AgentContext) {
  const found = tools.find((t) => t.name === name);
  if (!found || found.type !== 'function') throw new Error(`tool not found: ${name}`);
  const raw = await found.invoke(new RunContext(ctx), JSON.stringify(input));
  return typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : raw;
}

describe('skills/file-utils', () => {
  it('toKebabCase 规范化', () => {
    expect(toKebabCase('Agent Browser')).toBe('agent-browser');
    expect(toKebabCase('  Find_Skills! ')).toBe('find-skills');
  });

  it('isInsidePath 守卫穿越', () => {
    expect(isInsidePath('/a/b', '/a/b/c')).toBe(true);
    expect(isInsidePath('/a/b', '/a/b')).toBe(true);
    expect(isInsidePath('/a/b', '/a/c')).toBe(false);
    expect(isInsidePath('/a/b', '/a/b/../c')).toBe(false);
  });

  it('parseSkillFromDirectory 解析 frontmatter', async () => {
    const dir = path.join(tmp, 'demo-skill');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'SKILL.md'),
      '---\nname: demo-skill\ndescription: A demo.\n---\n# Demo\n\n正文。',
      'utf-8'
    );
    const parsed = await parseSkillFromDirectory(dir);
    expect(parsed?.name).toBe('demo-skill');
    expect(parsed?.description).toBe('A demo.');
    expect(parsed?.content).toContain('正文');
    expect(parsed?.files.length).toBeGreaterThanOrEqual(1);
  });

  it('缺 SKILL.md 返回 null', async () => {
    const dir = path.join(tmp, 'empty');
    await fs.mkdir(dir, { recursive: true });
    expect(await parseSkillFromDirectory(dir)).toBeNull();
  });
});

describe('执行工具 · 文件', () => {
  it('write_file → read_file 往返', async () => {
    const tools = createFileTools();
    const ctx = makeCtx();
    const w = await invoke(tools, 'write_file', { path: 'out/page.html', content: '<h1>hi</h1>' }, ctx);
    expect(w.path).toBe('out/page.html');
    const r = await invoke(tools, 'read_file', { path: 'out/page.html' }, ctx);
    expect(r.content).toBe('<h1>hi</h1>');
    // 真落到工作区
    expect(await fs.readFile(path.join(tmp, 'out/page.html'), 'utf-8')).toBe('<h1>hi</h1>');
  });

  it('glob / grep 命中', async () => {
    const tools = createFileTools();
    const ctx = makeCtx();
    await invoke(tools, 'write_file', { path: 'a.md', content: 'hello world' }, ctx);
    await invoke(tools, 'write_file', { path: 'sub/b.md', content: 'foo bar' }, ctx);
    const g = await invoke(tools, 'glob', { pattern: '**/*.md' }, ctx);
    expect(g.matches.sort()).toEqual(['a.md', 'sub/b.md']);
    const gr = await invoke(tools, 'grep', { pattern: 'foo' }, ctx);
    expect(gr.matches.some((m: { file: string }) => m.file === 'sub/b.md')).toBe(true);
  });

  it('edit_file 唯一替换', async () => {
    const tools = createFileTools();
    const ctx = makeCtx();
    await invoke(tools, 'write_file', { path: 'x.txt', content: 'aaa BBB ccc' }, ctx);
    const e = await invoke(tools, 'edit_file', { path: 'x.txt', old: 'BBB', new: 'ZZZ' }, ctx);
    expect(e.replaced).toBe(1);
    const r = await invoke(tools, 'read_file', { path: 'x.txt' }, ctx);
    expect(r.content).toBe('aaa ZZZ ccc');
  });
});

describe('执行工具 · bash', () => {
  it('执行 echo 并返回 stdout', async () => {
    const tools = createBashTool();
    const ctx = makeCtx();
    const res = await invoke(tools, 'bash', { command: 'echo workmate-ok' }, ctx);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('workmate-ok');
  });

  it('cwd 默认在工作区', async () => {
    const tools = createBashTool();
    const ctx = makeCtx();
    const res = await invoke(tools, 'bash', { command: 'pwd' }, ctx);
    // macOS 上 /tmp 可能是 /private/tmp 软链，用 basename 容错
    expect(res.stdout.trim().endsWith(path.basename(tmp))).toBe(true);
  });
});

describe('skill 工具', () => {
  const fakePort: SkillsPort = {
    getAvailableSkillsPrompt: () => '<available_skills></available_skills>',
    loadSkillForTool: async (name) =>
      name === 'agent-browser'
        ? { name, content: '# Agent Browser\n用法…', location: '/skills/agent-browser', files: [] }
        : null,
  };

  it('命中已启用技能 → 返回正文', async () => {
    const tools = createWorkmateTools();
    const ctx = makeCtx({ skills: fakePort });
    const res = await invoke(tools, 'skill', { name: 'agent-browser' }, ctx);
    expect(res.name).toBe('agent-browser');
    expect(res.content).toContain('Agent Browser');
  });

  it('未启用/未找到 → error', async () => {
    const tools = createWorkmateTools();
    const ctx = makeCtx({ skills: fakePort });
    const res = await invoke(tools, 'skill', { name: 'nope' }, ctx);
    expect(res.error).toBeTruthy();
  });
});
