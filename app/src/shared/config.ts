/**
 * AppConfig 的 zod schema、类型与默认值（主进程与渲染进程共享）
 * 类型经 z.infer 派生，不另写平行 interface（engineering-standards §2）。
 * 真相源：docs/design/product-design.md §9。
 */

import { z } from 'zod';

/** 默认内置百度 OneAPI 的 baseURL；apiKey 留空，引导用户去 token 页获取。绝不硬编码密钥。 */
export const DEFAULT_BASE_URL = 'https://oneapi-comate.baidu-int.com/v1';
/** 可改占位模型名（用户在设置页按其 OneAPI 可用模型调整） */
export const DEFAULT_MODEL = 'ernie-3.5-8k';
export const ONEAPI_TOKEN_URL = 'https://oneapi-comate.baidu-int.com/token';

export const LlmConfigSchema = z.object({
  baseURL: z.string().min(1, 'baseURL 不能为空').default(DEFAULT_BASE_URL),
  apiKey: z.string().default(''), // 允许为空保存；发送对话前会要求用户填写真实 key
  model: z.string().min(1, 'model 不能为空').default(DEFAULT_MODEL),
});

export const NudgeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** 傍晚提醒触发小时 */
  eveningHour: z.number().int().min(0).max(23).default(18),
  /** 停滞阈值小时 */
  stallHours: z.number().int().min(1).max(24).default(4),
});

export const AppConfigSchema = z.object({
  llm: LlmConfigSchema.prefault({}),
  nudge: NudgeConfigSchema.prefault({}),
});

export type LlmConfig = z.infer<typeof LlmConfigSchema>;
export type NudgeConfig = z.infer<typeof NudgeConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

/** 全量默认配置 */
export const DEFAULT_CONFIG: AppConfig = AppConfigSchema.parse({});

/** 是否已配置可用的 apiKey（决定是否允许发起真实 LLM 对话） */
export function hasApiKey(config: AppConfig): boolean {
  return config.llm.apiKey.trim().length > 0;
}
