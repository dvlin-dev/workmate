/**
 * SkillsRegistry：本地 skill 的单一事实源。
 * 首启把内置 skill 拷到 ~/.workmate/skills/，扫描解析、缓存、启停。
 * Phase B（本地）：list/getDetail/setEnabled + getAvailableSkillsPrompt/loadSkillForTool（供 agent）。
 * Phase C（远端 curated 安装/更新）留待后续，不在此实现。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  PREINSTALL_SKILLS,
  SKILLS_DIR,
  SKILLS_LOG_PREFIX,
  STATE_FILE,
  WORKMATE_DIR,
  MAX_SKILL_FILE_LIST,
  resolveBundledSkillRoots,
} from './constants';
import {
  copyDirectoryTree,
  directoryExists,
  parseSkillFromDirectory,
  toKebabCase,
  xmlEscape,
} from './file-utils';
import { readSkillState, writeSkillState } from './state';
import type { ParsedSkill, SkillDetail, SkillStateFile, SkillSummary } from './types';
import type { SkillsPort } from '../agent/context';

class SkillsRegistry implements SkillsPort {
  private initialized = false;
  private summaries: SkillSummary[] = [];
  private detailMap = new Map<string, SkillDetail>();

  private async ensureStorage(): Promise<void> {
    await fs.mkdir(WORKMATE_DIR, { recursive: true });
    await fs.mkdir(SKILLS_DIR, { recursive: true });
  }

  /** 在内置根里找某 skill 目录 */
  private async locateBundledSkill(name: string): Promise<string | null> {
    const normalized = toKebabCase(name);
    if (!normalized) return null;
    for (const root of resolveBundledSkillRoots()) {
      const dir = path.join(root, normalized);
      const parsed = await parseSkillFromDirectory(dir);
      if (parsed?.name === normalized) return dir;
    }
    return null;
  }

  /** 首启把未跳过的预装 skill 拷进 skills 目录（已存在则跳过） */
  private async ensurePreinstalled(state: SkillStateFile): Promise<void> {
    const skipped = new Set(state.skippedPreinstall);
    for (const name of PREINSTALL_SKILLS) {
      if (skipped.has(name)) continue;
      const target = path.join(SKILLS_DIR, name);
      if (await directoryExists(target)) continue;
      const source = await this.locateBundledSkill(name);
      if (!source) {
        console.warn(`${SKILLS_LOG_PREFIX} bundled skill not found: ${name}`);
        continue;
      }
      await copyDirectoryTree(source, target);
    }
  }

  private async scanInstalled(): Promise<ParsedSkill[]> {
    await this.ensureStorage();
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    const parsed: ParsedSkill[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const skill = await parseSkillFromDirectory(path.join(SKILLS_DIR, entry.name));
      if (skill) parsed.push(skill);
    }
    parsed.sort((a, b) => a.title.localeCompare(b.title));
    return parsed;
  }

  private hydrate(skills: ParsedSkill[], state: SkillStateFile): void {
    const disabled = new Set(state.disabled);
    this.detailMap.clear();
    this.summaries = skills.map((skill) => {
      const summary: SkillSummary = {
        name: skill.name,
        title: skill.title,
        description: skill.description,
        enabled: !disabled.has(skill.name),
        location: skill.location,
        updatedAt: skill.updatedAt,
      };
      this.detailMap.set(skill.name, { ...summary, content: skill.content, files: skill.files });
      return summary;
    });
  }

  async refresh(): Promise<SkillSummary[]> {
    await this.ensureStorage();
    const state = await readSkillState(STATE_FILE);
    await this.ensurePreinstalled(state);
    const installed = await this.scanInstalled();
    // 清理指向已卸载 skill 的 disabled 项
    const names = new Set(installed.map((s) => s.name));
    const cleaned = { ...state, disabled: state.disabled.filter((n) => names.has(n)) };
    if (cleaned.disabled.length !== state.disabled.length) {
      await writeSkillState(STATE_FILE, cleaned);
    }
    this.hydrate(installed, cleaned);
    this.initialized = true;
    return this.summaries;
  }

  private async ensureReady(): Promise<void> {
    if (!this.initialized) await this.refresh();
  }

  async list(): Promise<SkillSummary[]> {
    await this.ensureReady();
    return this.summaries.map((s) => ({ ...s }));
  }

  async getDetail(name: string): Promise<SkillDetail> {
    await this.ensureReady();
    const detail = this.detailMap.get(toKebabCase(name));
    if (!detail) throw new Error('Skill not found.');
    return { ...detail, files: [...detail.files] };
  }

  async setEnabled(name: string, enabled: boolean): Promise<SkillSummary> {
    await this.ensureReady();
    const normalized = toKebabCase(name);
    if (!this.detailMap.has(normalized)) throw new Error('Skill not found.');

    const state = await readSkillState(STATE_FILE);
    const disabled = new Set(state.disabled);
    if (enabled) disabled.delete(normalized);
    else disabled.add(normalized);
    await writeSkillState(STATE_FILE, { ...state, disabled: Array.from(disabled).sort() });

    await this.refresh();
    const updated = this.summaries.find((s) => s.name === normalized);
    if (!updated) throw new Error('Skill not found after update.');
    return { ...updated };
  }

  /** skill 目录路径（供 openDirectory IPC） */
  resolveLocation(name: string): string | null {
    return this.detailMap.get(toKebabCase(name))?.location ?? null;
  }

  // ── SkillsPort（供 agent） ──────────────────────────────
  getAvailableSkillsPrompt(): string {
    const enabled = this.summaries.filter((s) => s.enabled);
    if (enabled.length === 0) return '';
    const rows = enabled.map(
      (s) =>
        `<skill><name>${xmlEscape(s.name)}</name><title>${xmlEscape(s.title)}</title><description>${xmlEscape(s.description)}</description></skill>`
    );
    return `<available_skills>${rows.join('')}</available_skills>`;
  }

  async loadSkillForTool(
    name: string
  ): Promise<{ name: string; content: string; location: string; files: string[] } | null> {
    await this.ensureReady();
    const detail = this.detailMap.get(toKebabCase(name));
    if (!detail || !detail.enabled) return null;
    return {
      name: detail.name,
      content: detail.content,
      location: detail.location,
      files: detail.files.slice(0, MAX_SKILL_FILE_LIST),
    };
  }
}

let singleton: SkillsRegistry | null = null;

export const getSkillsRegistry = (): SkillsRegistry => {
  if (!singleton) singleton = new SkillsRegistry();
  return singleton;
};

export type { SkillsRegistry };
