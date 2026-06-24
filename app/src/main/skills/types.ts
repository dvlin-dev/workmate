/**
 * Skills 模块类型。SkillSummary/SkillDetail 的单一事实源在 @shared/ipc（主进程与渲染层共享），此处转出。
 * Phase B 用 disabled/skippedPreinstall；managedSkills 留给 Phase C 远端同步。
 */

export type { SkillSummary, SkillDetail } from '@shared/ipc';

export interface ParsedSkill {
  name: string;
  title: string;
  description: string;
  content: string;
  location: string;
  updatedAt: number;
  files: string[];
}

export interface SkillStateFile {
  disabled: string[];
  skippedPreinstall: string[];
}
