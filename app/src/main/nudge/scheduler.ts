/**
 * 主动推送 Nudge：定时 tick 读 Store，按 pickNudge 判定发系统通知。
 * 判定逻辑在 decide.ts（纯函数、可单测）；本文件只管 electron 的定时器与通知 I/O。
 * 真相源：docs/reference/prompts.md §3、product-design.md §8。
 */

import { Notification } from 'electron';
import { CH, type NudgeKind, type NudgePayload } from '@shared/ipc';
import type { WorkmateStore } from '../store';
import { broadcastToAllWindows } from '../ipc/shared';
import { focusOrCreateMainWindow } from '../window';
import { formatLocalYMD } from '../date';
import { pickNudge } from './decide';

const TICK_MS = 30 * 60 * 1000; // 30 分钟

/** 启动定时器；启动即评估一次，返回停止函数。lastSent 跨重启持久化（store） */
export function startNudgeScheduler(store: WorkmateStore): () => void {
  const notify = (payload: NudgePayload): boolean => {
    const notification = new Notification({ title: 'Workmate', body: payload.message });
    notification.on('click', () => {
      void focusOrCreateMainWindow();
      broadcastToAllWindows(CH.nudgeNotify, payload);
    });
    try {
      notification.show();
      return true;
    } catch {
      return false; // 展示失败：不标记已发，留待下个 tick 重试
    }
  };

  const tick = () => {
    const config = store.getConfig();
    if (!config.nudge.enabled) return;
    if (!Notification.isSupported()) return;

    const now = new Date();
    const today = formatLocalYMD(now);
    const lastSent = store.getNudgeLastSent();
    const payload = pickNudge({
      week: store.getCurrentWeekData(),
      config,
      now,
      alreadySentToday: (kind: NudgeKind) => lastSent[kind] === today,
    });
    if (!payload) return;

    if (notify(payload)) {
      store.markNudgeSent(payload.kind, today);
    }
  };

  tick(); // 启动即评估一次，避免首个 tick 延迟 30 分钟
  const timer = setInterval(tick, TICK_MS);
  return () => clearInterval(timer);
}
