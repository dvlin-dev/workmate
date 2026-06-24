/**
 * AppConfig 合并与校验（纯函数，无副作用）。
 * 持久化由 Store 拥有（config 是 WorkmateData 的一部分），这里只负责 deep-merge + zod 校验。
 */

import { AppConfigSchema, type AppConfig } from '@shared/config';
import type { DeepPartial } from '@shared/ipc';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 深合并：对象递归合并，数组/原始值整体替换 */
export function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch as unknown as T) ?? base;
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] = isPlainObject(current) && isPlainObject(value)
      ? deepMerge(current, value as DeepPartial<typeof current>)
      : value;
  }
  return out as T;
}

/** 应用 patch 到当前 config：深合并后用 zod 校验/补全，返回全量配置 */
export function applyConfigPatch(current: AppConfig, patch: DeepPartial<AppConfig>): AppConfig {
  return AppConfigSchema.parse(deepMerge(current, patch));
}
