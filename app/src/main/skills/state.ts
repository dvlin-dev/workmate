/**
 * skills-state.json 读写 + 校验（坏 JSON 回退默认）。
 */

import { promises as fs } from 'node:fs';
import { readIfExists, toKebabCase } from './file-utils';
import type { SkillStateFile } from './types';

const normalizeNameList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => toKebabCase(item))
        .filter((item) => item.length > 0)
    : [];

export const defaultSkillState = (): SkillStateFile => ({
  disabled: [],
  skippedPreinstall: [],
});

export const readSkillState = async (stateFile: string): Promise<SkillStateFile> => {
  const raw = await readIfExists(stateFile);
  if (!raw) return defaultSkillState();
  try {
    const parsed = JSON.parse(raw) as Partial<SkillStateFile>;
    return {
      disabled: Array.from(new Set(normalizeNameList(parsed.disabled))).sort(),
      skippedPreinstall: Array.from(new Set(normalizeNameList(parsed.skippedPreinstall))).sort(),
    };
  } catch {
    return defaultSkillState();
  }
};

export const writeSkillState = async (stateFile: string, state: SkillStateFile): Promise<void> => {
  const normalized: SkillStateFile = {
    disabled: Array.from(new Set(state.disabled.map(toKebabCase).filter(Boolean))).sort(),
    skippedPreinstall: Array.from(
      new Set(state.skippedPreinstall.map(toKebabCase).filter(Boolean))
    ).sort(),
  };
  await fs.writeFile(stateFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8');
};
