/**
 * defineTool：工具定义的统一入口。在 agents-core 的 tool() 之上包一层执行埋点——
 * 计时、入参、成功/失败一律落到 ctx.toolLogger（本地 JSONL 留存）。
 *
 * 约定：所有工具都必须用 defineTool 定义。新增工具即自动获得日志，无需各自接线。
 * 软失败约定：工具不抛错、改为返回带 { error } 字段的对象时，也会被记为 status='error'
 *（如 write_reminder 权限不足、skill 未找到）。
 */

import { tool, type RunContext, type Tool } from '@openai/agents-core';
import type { z } from 'zod';
import type { AgentContext } from '../context';

/** 约定的"软失败"：返回对象里带非空 error 字段时取出其文案 */
function softErrorOf(result: unknown): string | undefined {
  if (result && typeof result === 'object' && 'error' in result) {
    const value = (result as Record<string, unknown>).error;
    return value == null ? undefined : String(value);
  }
  return undefined;
}

export interface ToolDef<S extends z.ZodObject<z.ZodRawShape>> {
  name: string;
  description: string;
  parameters: S;
  execute: (input: z.infer<S>, rc?: RunContext<AgentContext>) => unknown | Promise<unknown>;
}

export function defineTool<S extends z.ZodObject<z.ZodRawShape>>(def: ToolDef<S>): Tool<AgentContext> {
  const instrumented = async (
    input: z.infer<S>,
    rc?: RunContext<AgentContext>
  ): Promise<unknown> => {
    const start = Date.now();
    const logger = rc?.context?.toolLogger;
    try {
      const result = await def.execute(input, rc);
      if (logger) {
        const softError = softErrorOf(result);
        logger.record({
          ts: new Date().toISOString(),
          tool: def.name,
          status: softError ? 'error' : 'ok',
          durationMs: Date.now() - start,
          input,
          error: softError,
        });
      }
      return result;
    } catch (error) {
      logger?.record({
        ts: new Date().toISOString(),
        tool: def.name,
        status: 'error',
        durationMs: Date.now() - start,
        input,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      throw error;
    }
  };

  // agents-core 的 ToolOptions 用条件类型，遇到未解析的泛型 S 会卡住；此处在内部收敛掉
  // parameters/execute 的类型即可，对外类型安全仍由 ToolDef<S> 的入参签名保证。
  return tool({
    name: def.name,
    description: def.description,
    parameters: def.parameters as z.ZodObject<z.ZodRawShape>,
    execute: instrumented as (input: unknown, rc?: RunContext<AgentContext>) => Promise<unknown>,
  }) as Tool<AgentContext>;
}
