/**
 * 主窗口创建 + 外链安全导航 guard。窗口选项采用 Electron 安全基线。
 */

import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';

let mainWindow: BrowserWindow | null = null;

function resolvePreloadPath(): string {
  const jsPath = path.resolve(__dirname, '../preload/index.js');
  return existsSync(jsPath) ? jsPath : path.resolve(__dirname, '../preload/index.mjs');
}

function isExternalHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** 外链一律走系统浏览器、阻止应用内导航（Electron 安全范式） */
function bindNavigationGuards(win: BrowserWindow): void {
  const pageUrl = process.env['ELECTRON_RENDERER_URL'];
  const rendererOrigin = pageUrl ? new URL(pageUrl).origin : null;

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttp(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const internal = url.startsWith('file:') || (rendererOrigin !== null && url.startsWith(rendererOrigin));
    if (!internal) {
      event.preventDefault();
      if (isExternalHttp(url)) void shell.openExternal(url);
    }
  });
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F2F2F7',
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });

  bindNavigationGuards(win);
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  const pageUrl = process.env['ELECTRON_RENDERER_URL'];
  if (app.isPackaged) {
    await win.loadFile(path.resolve(__dirname, '../renderer/index.html'));
  } else if (pageUrl) {
    await win.loadURL(pageUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  }

  return win;
}

/** 唤起主窗口：存在则恢复+聚焦，否则重建（供 nudge 通知点击用） */
export async function focusOrCreateMainWindow(): Promise<BrowserWindow> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }
  return createMainWindow();
}
