/**
 * Skills 文件系统与解析工具：安全路径、frontmatter 解析、目录复制、原子替换。
 * 解析与原子覆盖逐字移植自成熟实现（正确性关键，与"无沙箱"无关，必须保留）。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { MAX_SKILL_FILE_LIST } from './constants';
import type { ParsedSkill } from './types';

export const toKebabCase = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

export const xmlEscape = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

/** target 是否在 base 内（路径穿越守卫，registry 写入用） */
export const isInsidePath = (baseDir: string, targetPath: string): boolean => {
  const rel = path.relative(baseDir, targetPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

export const readIfExists = async (targetPath: string): Promise<string | null> => {
  try {
    return await fs.readFile(targetPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

export const directoryExists = async (targetPath: string): Promise<boolean> => {
  const stat = await fs.stat(targetPath).catch(() => null);
  return Boolean(stat?.isDirectory());
};

const parseFrontmatter = (raw: string): { attrs: Record<string, string>; body: string } => {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { attrs: {}, body: raw };
  const attrs: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key || !value) continue;
    attrs[key] = value.replace(/^['"]|['"]$/g, '');
  }
  return { attrs, body: raw.slice(match[0].length) };
};

const resolveTitleFromBody = (body: string): string | null =>
  body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;

const resolveDescriptionFromBody = (body: string): string | null => {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  return lines[0] ?? null;
};

const collectFiles = async (baseDir: string): Promise<string[]> => {
  const files: string[] = [];
  const walk = async (dir: string) => {
    if (files.length >= MAX_SKILL_FILE_LIST) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= MAX_SKILL_FILE_LIST) break;
      if (entry.isSymbolicLink()) continue;
      const abs = path.join(dir, entry.name);
      if (!isInsidePath(baseDir, abs)) continue;
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) files.push(abs);
    }
  };
  await walk(baseDir);
  return files;
};

/** 解析一个 skill 目录的 SKILL.md；非法/缺失返回 null。拒绝符号链接。 */
export const parseSkillFromDirectory = async (skillDir: string): Promise<ParsedSkill | null> => {
  const stat = await fs.lstat(skillDir).catch(() => null);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) return null;

  const realBase = await fs.realpath(skillDir).catch(() => null);
  if (!realBase) return null;

  const skillFile = path.join(realBase, 'SKILL.md');
  const raw = await readIfExists(skillFile);
  if (!raw) return null;

  const { attrs, body } = parseFrontmatter(raw);
  const trimmedBody = body.trim();
  if (!trimmedBody) return null;

  const directoryName = toKebabCase(path.basename(realBase));
  const frontmatterName = attrs['name'] ? toKebabCase(attrs['name']) : '';
  const name = directoryName || frontmatterName;
  if (!name) return null;

  const title = attrs['title'] ?? resolveTitleFromBody(trimmedBody) ?? name;
  const description =
    attrs['description'] ?? resolveDescriptionFromBody(trimmedBody) ?? 'No description provided.';
  const files = await collectFiles(realBase);
  const mtime = (await fs.stat(skillFile)).mtimeMs;

  return { name, title, description, content: trimmedBody, location: realBase, updatedAt: Math.floor(mtime), files };
};

export const copyDirectoryTree = async (sourceDir: string, targetDir: string): Promise<void> => {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const sourceEntry = path.join(sourceDir, entry.name);
    const targetEntry = path.join(targetDir, entry.name);
    if (!isInsidePath(targetDir, targetEntry)) continue;
    if (entry.isDirectory()) {
      await copyDirectoryTree(sourceEntry, targetEntry);
    } else if (entry.isFile()) {
      await fs.mkdir(path.dirname(targetEntry), { recursive: true });
      await fs.copyFile(sourceEntry, targetEntry);
    }
  }
};
