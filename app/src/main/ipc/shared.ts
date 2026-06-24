/**
 * IPC 帮助函数：payload 守卫、广播、结果信封（标准 Electron IPC 范式）。
 */

import { BrowserWindow } from 'electron';
import type { AppErrorCode, AppResult } from '@shared/ipc';

export const asObjectRecord = (payload: unknown): Record<string, unknown> =>
  payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

export const broadcastToAllWindows = <T>(channel: string, payload: T): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
};

export const ok = <T>(data: T): AppResult<T> => ({ ok: true, data });

export const fail = (code: AppErrorCode, message: string): AppResult<never> => ({
  ok: false,
  error: { code, message },
});

export const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim() ? error.message : '';
