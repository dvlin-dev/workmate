/**
 * 单测显式启用的确定性 mock 模型（基于 AI SDK MockLanguageModelV3）。
 * 通过读 prompt 消息驱动一个可信的 tool-calling 闭环：
 *   - 计划类输入 → create_goal
 *   - 进展类输入 → find_goal → complete_goal（进度由完成比例派生，无"设百分比"工具）
 *   - 周报      → generate_report
 *   - tool 结果回来后 → 一句口语化收尾
 * 仅用于自动化测试，不作为用户运行时的无 key 兜底。
 */

import { randomUUID } from 'node:crypto';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';

const MOCK_USAGE: LanguageModelV3Usage = {
  inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};

export function mockTextResult(text: string): LanguageModelV3GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: MOCK_USAGE,
    warnings: [],
  };
}

export function mockToolCallResult(
  toolName: string,
  input: Record<string, unknown>
): LanguageModelV3GenerateResult {
  return {
    content: [
      { type: 'tool-call', toolCallId: randomUUID(), toolName, input: JSON.stringify(input) },
    ],
    finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
    usage: MOCK_USAGE,
    warnings: [],
  };
}

function lastUserText(prompt: LanguageModelV3Prompt): string {
  for (let i = prompt.length - 1; i >= 0; i -= 1) {
    const msg = prompt[i];
    if (msg.role === 'user') {
      return msg.content
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('')
        .trim();
    }
  }
  return '';
}

function toolMessages(prompt: LanguageModelV3Prompt) {
  return prompt.filter((m) => m.role === 'tool');
}

function cleanGoalTitle(text: string): string {
  return (
    text
      .replace(/^(这周要|本周要|今天要|我要|我想|准备|打算|计划|想)/, '')
      .trim() || text
  );
}

/** 把口语进展句清洗成更接近目标标题的 query（剥掉句尾完成/进展词），供 find_goal 用 */
function cleanProgressQuery(text: string): string {
  return (
    text
      .replace(
        /(通了|搞定了?|完成了?|做完了?|写完了?|跑通了?|提测了?|弄完了?|结束了?|上线了?|推进了?|有进展|好了|做了一半|做了)$/,
        ''
      )
      .trim() || text
  );
}

function finalTextFor(raw: string): string {
  if (raw.includes('"reminderId"')) return '已经帮你写到「提醒事项」啦 ✅';
  if (raw.includes('"error"') && raw.includes('needsPermission'))
    return '写入提醒事项需要授权，去「系统设置 → 隐私与安全性 → 自动化/提醒事项」允许 Workmate 后再说一次让我写入哈。';
  if (raw.includes('"markdown"')) return '周报生成好了，在右边可以查看～📝';
  if (raw.includes('"progress"')) return '搞定 👍 这个目标我帮你标记完成、进度也拉满了。';
  if (raw.includes('"taskId"')) return '搞定 👍 这条待办我帮你勾掉了，进度自动更新～';
  if (raw.includes('"goalId"')) return '好嘞，已经记到本周看板上了 👍';
  if (raw.includes('"eventId"')) return '记下了，有进展随时同步我～';
  return '好的，已经处理好了 👍';
}

/** mock 的决策核心：根据 prompt 当前状态产出下一步（tool-call 或文本） */
function decide(prompt: LanguageModelV3Prompt): LanguageModelV3GenerateResult {
  const tools = toolMessages(prompt);

  // 已经执行过 tool —— 根据最后一个 tool 结果决定下一步
  if (tools.length > 0) {
    const lastTool = tools[tools.length - 1];
    const raw = JSON.stringify(lastTool).replace(/\\"/g, '"');

    // find_goal 的结果 → 接着 complete_goal（进度由完成比例派生，无"设百分比"工具）
    if (raw.includes('"matches"')) {
      const ids = raw.match(/"goalId":"[^"]+"/g) ?? [];
      if (ids.length === 0) {
        return mockTextResult('我没找到对应的目标，你是想把这条进展归到哪个目标上？😅');
      }
      if (ids.length > 1) {
        return mockTextResult('这条进展我看到有好几个相关的目标，你想归到哪一个？');
      }
      const goalId = ids[0]!.replace(/"goalId":"([^"]+)"/, '$1');
      return mockToolCallResult('complete_goal', { goalId });
    }

    // 其它 tool 结果 → 收尾
    return mockTextResult(finalTextFor(raw));
  }

  // 首轮：按用户输入分类
  const userText = lastUserText(prompt);
  if (!userText) return mockTextResult('嗨，我是你的工作搭子，说说这周要做什么吧～');

  if (/周报|总结这周|这周总结|周总结|生成报告|report/i.test(userText)) {
    return mockToolCallResult('generate_report', {});
  }

  const future = /(要做|要做完|准备|打算|计划|这周要|本周要|今天要|想做|目标是|新目标|想要)/.test(
    userText
  );
  const done = /(通了|搞定|完成|做完|写完|跑通|提测|做了|推进|进展|弄完|结束|好了|上线)/.test(
    userText
  );

  if (done && !future) {
    return mockToolCallResult('find_goal', { query: cleanProgressQuery(userText) });
  }
  return mockToolCallResult('create_goal', { title: cleanGoalTitle(userText) });
}

/** 把一次 decide 的结果转成 V3 流式 part（文本切片成小块模拟打字机） */
function resultToStreamParts(result: LanguageModelV3GenerateResult): LanguageModelV3StreamPart[] {
  const parts: LanguageModelV3StreamPart[] = [{ type: 'stream-start', warnings: [] }];
  for (const content of result.content) {
    if (content.type === 'text') {
      const id = randomUUID();
      parts.push({ type: 'text-start', id });
      const text = content.text;
      for (let i = 0; i < text.length; i += 4) {
        parts.push({ type: 'text-delta', id, delta: text.slice(i, i + 4) });
      }
      parts.push({ type: 'text-end', id });
    } else if (content.type === 'tool-call') {
      parts.push(content);
    }
  }
  parts.push({ type: 'finish', finishReason: result.finishReason, usage: result.usage });
  return parts;
}

/** 创建显式测试用的 mock 模型（doGenerate + doStream，支持流式） */
export function createMockChatModel(): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    modelId: 'workmate-mock',
    provider: 'workmate-mock',
    doGenerate: async (options) => decide(options.prompt),
    doStream: async (options) => ({
      stream: simulateReadableStream({
        chunks: resultToStreamParts(decide(options.prompt)),
        initialDelayInMs: 0,
        chunkDelayInMs: 16,
      }),
    }),
  });
}

/** 测试用：按给定结果序列逐轮返回（脚本化 loop 测） */
export function createScriptedModel(
  results: LanguageModelV3GenerateResult[]
): MockLanguageModelV3 {
  let i = 0;
  return new MockLanguageModelV3({
    modelId: 'workmate-mock-scripted',
    provider: 'workmate-mock',
    doGenerate: async () => {
      const result = results[Math.min(i, results.length - 1)];
      i += 1;
      return result;
    },
  });
}
