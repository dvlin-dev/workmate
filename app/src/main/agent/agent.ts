/**
 * Agent 构建：new Agent({name,instructions,model,tools})（agents-core 标准范式）。
 */

import { Agent } from '@openai/agents-core';
import type { AppConfig } from '@shared/config';
import type { Snapshot } from '@shared/types';
import type { AgentContext } from './context';
import { buildModel } from './model';
import { buildSystemPrompt } from './prompt';
import { createWorkmateTools } from './tools';

export function buildAgent(config: AppConfig, snapshot: Snapshot): Agent<AgentContext> {
  return new Agent<AgentContext>({
    name: 'Workmate',
    instructions: buildSystemPrompt(snapshot),
    model: buildModel(config),
    tools: createWorkmateTools(),
  });
}
