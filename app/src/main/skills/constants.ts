/**
 * Skills 路径与阈值常量 + 内置 skill 根目录解析（dev / 打包 / asar 容错）。
 * 移植自成熟实现，路径换为 ~/.workmate。
 */

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const SKILLS_LOG_PREFIX = '[skills-registry]';

export const WORKMATE_DIR = path.join(os.homedir(), '.workmate');
export const SKILLS_DIR = path.join(WORKMATE_DIR, 'skills');
export const STATE_FILE = path.join(WORKMATE_DIR, 'skills-state.json');

export const MAX_SKILL_FILE_LIST = 200;

/** 内置 skill 可能所在的根目录（按优先级，存在哪个用哪个） */
export const resolveBundledSkillRoots = (): string[] => {
  const roots = new Set<string>();
  const add = (candidate: string | null | undefined) => {
    if (!candidate || candidate.trim().length === 0) return;
    roots.add(path.resolve(candidate));
  };

  // 开发态：仓库内置 skill 源
  add(path.join(process.cwd(), 'src/main/skills/builtin'));
  // 构建态：electron-vite 输出目录（copyBuiltinSkills 插件拷到 dist/main/builtin）
  add(path.join(SKILLS_MODULE_DIR, 'builtin'));

  const processWithResourcesPath = process as NodeJS.Process & { resourcesPath?: string };
  const resourcesPath =
    typeof processWithResourcesPath.resourcesPath === 'string' &&
    processWithResourcesPath.resourcesPath.trim().length > 0
      ? processWithResourcesPath.resourcesPath
      : null;

  if (resourcesPath) {
    add(path.join(resourcesPath, 'app.asar', 'dist', 'main', 'builtin'));
    add(path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'main', 'builtin'));
  }

  return Array.from(roots);
};

/** 内置 skill 默认预装清单（首启拷入并启用） */
export const PREINSTALL_SKILLS = ['agent-browser', 'find-skills'] as const;
