/**
 * 模型构建：默认只走用户配置的 OpenAI 兼容端点；测试可显式允许确定性 mock。
 * 主干：createOpenAICompatible → aisdk（单 provider、无 thinking 矩阵）。
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { aisdk } from '@openai/agents-extensions';
import { hasApiKey, type AppConfig } from '@shared/config';
import { createMockChatModel } from './mock-model';

export class MissingApiKeyError extends Error {
  constructor() {
    super('请先配置 apiKey');
    this.name = 'MissingApiKeyError';
  }
}

/** 返回 agents-core 可用的模型（aisdk 包装）。apiKey 为空时只允许测试显式启用 mock。 */
export function buildModel(
  config: AppConfig,
  options: { allowMockModel?: boolean } = {}
): ReturnType<typeof aisdk> {
  if (!hasApiKey(config)) {
    if (options.allowMockModel) return aisdk(createMockChatModel());
    throw new MissingApiKeyError();
  }
  return aisdk(buildRawModel(config.llm));
}

/** 原始 AI SDK 模型（用于 generateText 等直调，如周报、测试连接）。接受 llm 三元组，便于无状态测试连接。 */
export function buildRawModel(llm: { baseURL: string; apiKey: string; model: string }) {
  const provider = createOpenAICompatible({
    name: 'workmate',
    apiKey: llm.apiKey,
    baseURL: llm.baseURL,
  });
  return provider(llm.model);
}
