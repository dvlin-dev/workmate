/**
 * 主进程入口：单实例锁 → 构建 Store/Report/Reminder 依赖 → 注册 IPC → 菜单 → 建窗口 → 启动 nudge。
 */

import { app, BrowserWindow, session } from 'electron';
import { createWorkmateStore } from './persistence';
import { createReportService } from './report';
import { MockReminderBridge } from './reminders/mock';
import { OsascriptReminderBridge } from './reminders/bridge';
import type { ReminderBridge } from './agent/context';
import { registerIpc } from './ipc/register';
import { startNudgeScheduler } from './nudge/scheduler';
import { buildAppMenu } from './menu';
import { createMainWindow, focusOrCreateMainWindow } from './window';
import { createUpdateService } from './updater';

function createReminderBridge(store: ReturnType<typeof createWorkmateStore>): ReminderBridge {
  // 仅 macOS 用 osascript 真实写入；其它平台降级 Mock，保证可跑、可测。
  return process.platform === 'darwin'
    ? new OsascriptReminderBridge(store)
    : new MockReminderBridge(store);
}

// 单实例锁：第二个实例直接退出，唤起已有窗口
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    void focusOrCreateMainWindow();
  });

  app.setAboutPanelOptions({
    applicationName: 'Workmate',
    applicationVersion: app.getVersion(),
    copyright: '© 2026 Workmate · 工作搭子',
    credits: 'AI-native 的 macOS 工作搭子',
  });

  app.whenReady().then(async () => {
    // CSP（仅打包时注入，避免影响 dev 的 Vite HMR websocket）；渲染层无远程内容
    if (app.isPackaged) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'",
            ],
          },
        });
      });
    }

    const store = createWorkmateStore();
    const report = createReportService(store);
    const reminders = createReminderBridge(store);
    const updates = createUpdateService();

    registerIpc({ store, reminders, report });
    buildAppMenu({
      checkForUpdates: () => {
        void updates.checkForUpdates({ interactive: true });
      },
    });
    startNudgeScheduler(store);
    await createMainWindow();
    updates.startAutomaticChecks();

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
}
