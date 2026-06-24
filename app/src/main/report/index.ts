/**
 * 周报生成（ReportService 实现，服务壳）。
 * 有 key → generateText（叙事 prompt）；无 key / 失败 → 确定性四段 markdown 降级（见 ./template）。
 * 真相源：docs/reference/prompts.md §2、agent-runtime.md §7。
 */

import { generateText } from 'ai';
import { hasApiKey } from '@shared/config';
import type { ReportService } from '../agent/context';
import type { WorkmateStore } from '../store';
import { buildRawModel } from '../agent/model';
import { assembleMaterial, deterministicReport } from './template';

const REPORT_TIMEOUT_MS = 60_000;

const REPORT_SYSTEM = `你是「Workmate」，基于用户这一周**已记录的工作**（目标、待办、进度事件）写一份**叙事性**周报（不是干巴巴的清单）。
要求：
- 用中文，markdown 格式，分四个二级标题：## 本周完成、## 进展亮点、## 风险与卡点、## 下周计划。
- 本周完成：结合已完成的目标/待办与事件 summary 叙述，突出"做成了什么"——不限于某一个目标，有价值的进展都可纳入。
- 进展亮点：推进明显的目标或关键节点。
- 风险与卡点：长期无进展、或事件里显式提到受阻的；没有就写"暂无明显卡点"。
- 下周计划：未完成的目标/待办，简要展望。
- 只依据给到的材料叙述，不编造未发生或未记录的事；没有数据的段落如实说明。语气平实、第一人称、可直接发给同事或上级。`;

export function createReportService(store: WorkmateStore): ReportService {
  return {
    async generate(weekOf?: string): Promise<string> {
      const week = weekOf ? store.getWeek(weekOf) : store.getCurrentWeekData();
      if (!week) {
        return `# 本周周报\n\n## 本周完成\n- 未找到该周（${weekOf}）的数据。`;
      }
      const material = assembleMaterial(week);
      const config = store.getConfig();
      if (!hasApiKey(config)) {
        return deterministicReport(material);
      }
      // 注意：此处 raw generateText 与 model.ts 的 testProvider 探针形状相似但失败语义不同
      //（这里失败回退确定性周报，testProvider 失败直接抛），刻意不合并。
      try {
        const { text } = await generateText({
          model: buildRawModel(config.llm),
          system: REPORT_SYSTEM,
          prompt: `这是本周（${material.rangeLabel}）的原始材料 JSON，请据此生成周报：\n${JSON.stringify(material)}`,
          abortSignal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
        });
        return text.trim() ? text : deterministicReport(material);
      } catch {
        return deterministicReport(material);
      }
    },
  };
}
