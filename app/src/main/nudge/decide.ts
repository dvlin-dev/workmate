/**
 * Nudge 判定（纯函数，不依赖 electron，便于单测）。
 * 真相源：docs/reference/prompts.md §3。
 */

import type { NudgeKind, NudgePayload } from '@shared/ipc';
import type { AppConfig } from '@shared/config';
import type { WeeklyPlan } from '@shared/types';
import { sameLocalDay } from '../date';

const HOUR_MS = 60 * 60 * 1000;

export const NUDGE_MESSAGES: Record<NudgeKind, string> = {
  evening: '今天还没记录进展，有什么要同步给我的吗？',
  friday: '这周快收尾啦，要不要现在一键生成周报？',
  stall: '', // 动态拼目标名
};

export interface NudgeDecisionInput {
  week: WeeklyPlan;
  config: AppConfig;
  now: Date;
  /** 该类提醒今天是否已发过（频率克制：一天最多一次） */
  alreadySentToday: (kind: NudgeKind) => boolean;
}

/** 返回本次 tick 应发的一条提醒（优先级 friday > stall > evening），否则 null */
export function pickNudge(input: NudgeDecisionInput): NudgePayload | null {
  const { week, config, now } = input;
  const hour = now.getHours();
  const day = now.getDay(); // 0=周日..6=周六
  const activeGoals = week.goals.filter((g) => g.status === 'active');

  // 周五下午
  if (day === 5 && hour >= 14 && !input.alreadySentToday('friday')) {
    return { kind: 'friday', message: NUDGE_MESSAGES.friday };
  }

  // 停滞：工作日工作时段，某 active 目标超过 stallHours 无相关事件
  const isWorkHours = day >= 1 && day <= 5 && hour >= 9 && hour < 19;
  if (isWorkHours && !input.alreadySentToday('stall')) {
    const stalled = activeGoals.find((g) => {
      const related = week.events.filter((e) => e.relatedGoalId === g.id);
      const last = related.length
        ? Math.max(...related.map((e) => Date.parse(e.timestamp)))
        : Date.parse(g.createdAt);
      return now.getTime() - last > config.nudge.stallHours * HOUR_MS;
    });
    if (stalled) {
      return { kind: 'stall', message: `「${stalled.title}」有一阵没动静了，卡住了还是在忙别的？` };
    }
  }

  // 傍晚：有 active 目标但今天无任何进度事件
  if (
    hour >= config.nudge.eveningHour &&
    hour < 22 &&
    activeGoals.length > 0 &&
    !input.alreadySentToday('evening')
  ) {
    const hasEventToday = week.events.some((e) => sameLocalDay(e.timestamp, now));
    if (!hasEventToday) {
      return { kind: 'evening', message: NUDGE_MESSAGES.evening };
    }
  }

  return null;
}
