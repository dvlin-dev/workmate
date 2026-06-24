/**
 * Agent 构建：new Agent({name,instructions,model,tools})（agents-core 标准范式）。
 * 工具集 = 目标管理工具 + skill 加载工具 + 执行工具（文件/检索/bash/web）。
 */

import { Agent } from '@openai/agents-core';
import type { AppConfig } from '@shared/config';
import type { Snapshot } from '@shared/types';
import type { AgentContext } from './context';
import { buildModel } from './model';
import { buildSystemPrompt } from './prompt';
import { createWorkmateTools } from './tools';
import { createFileTools } from './tools/fs';
import { createBashTool } from './tools/bash';
import { createWebTools } from './tools/web';

export function buildAgent(
  config: AppConfig,
  snapshot: Snapshot,
  availableSkillsBlock = '',
  options: { allowMockModel?: boolean } = {}
): Agent<AgentContext> {
  return new Agent<AgentContext>({
    name: 'Workmate',
    instructions: buildSystemPrompt(snapshot, availableSkillsBlock),
    model: buildModel(config, options),
    tools: [
      ...createWorkmateTools(),
      ...createFileTools(),
      ...createBashTool(),
      ...createWebTools(),
    ],
  });
}
