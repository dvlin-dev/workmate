/**
 * 主进程入口：构建 Store/Report/Reminder 依赖 → 注册 IPC → 建窗口 → 启动 nudge。
 */

import { app, BrowserWindow } from 'electron';
import { createWorkmateStore } from './persistence';
import { createReportService } from './report';
import { MockReminderBridge } from './reminders/mock';
import { OsascriptReminderBridge } from './reminders/bridge';
import type { ReminderBridge } from './agent/context';
import { registerIpc } from './ipc/register';
import { startNudgeScheduler } from './nudge/scheduler';
import { createMainWindow } from './window';

function createReminderBridge(store: ReturnType<typeof createWorkmateStore>): ReminderBridge {
  // 仅 macOS 用 osascript 真实写入；其它平台降级 Mock，保证可跑、可测。
  return process.platform === 'darwin'
    ? new OsascriptReminderBridge(store)
    : new MockReminderBridge(store);
}

app.whenReady().then(async () => {
  const store = createWorkmateStore();
  const report = createReportService(store);
  const reminders = createReminderBridge(store);

  registerIpc({ store, reminders, report });
  startNudgeScheduler(store);
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
