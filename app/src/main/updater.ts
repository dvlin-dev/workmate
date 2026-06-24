/**
 * 应用自动更新服务（electron-updater 封装）。
 * 设计：事件驱动的状态机，状态变化经 onChange 广播给渲染层（settings「关于」+ 侧边栏卡片渲染）。
 * 模型：autoDownload=true（静默后台下载，Chrome 式）+ autoInstallOnAppQuit=true（退出即装）；
 * UI 只负责"看得见 + 一键重启安装"，不做 skip 版本 / 下载开关等重型设置（按需省略）。
 * 可测：updater / logger / 定时器 / now / onChange 均可注入，无需打包环境。
 */

import { createRequire } from 'node:module';
import type { AppUpdateState, UpdateStatus } from '@shared/ipc';

const require = createRequire(import.meta.url);

export type LoggerLike = Pick<typeof console, 'info' | 'warn'>;

type TimerLike = { unref?: () => void };

type UpdaterEvent =
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'error';

type UpdaterLike = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void;
  on: (event: UpdaterEvent, listener: (...args: unknown[]) => void) => unknown;
};

export type UpdateService = {
  getState: () => AppUpdateState;
  checkForUpdates: () => Promise<AppUpdateState>;
  restartToInstall: () => void;
  startAutomaticChecks: () => void;
};

type CreateUpdateServiceOptions = {
  currentVersion?: string;
  platform?: NodeJS.Platform;
  isPackaged?: boolean;
  isSmokeCheck?: boolean;
  updater?: UpdaterLike;
  logger?: LoggerLike;
  now?: () => Date;
  /** 状态变化回调（运行时接到 IPC 广播；测试可断言） */
  onChange?: (state: AppUpdateState) => void;
  scheduleTimeout?: (callback: () => void, delayMs: number) => TimerLike;
  scheduleInterval?: (callback: () => void, delayMs: number) => TimerLike;
};

/** 启动后首检延迟（让窗口/IPC 先就绪） */
const STARTUP_CHECK_DELAY_MS = 20_000;
/** 之后每隔多久静默复检——长开的 app 才能在不重启的情况下拿到新版本 */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function loadElectronApp(): { isPackaged: boolean; version: string } {
  const electron = require('electron') as {
    app?: { isPackaged?: boolean; getVersion?: () => string };
  };
  return {
    isPackaged: electron.app?.isPackaged === true,
    version: electron.app?.getVersion?.() ?? '0.0.0',
  };
}

function loadAutoUpdater(): UpdaterLike {
  const updaterModule = require('electron-updater') as { autoUpdater?: UpdaterLike };
  if (!updaterModule.autoUpdater) {
    throw new Error('electron-updater.autoUpdater is unavailable.');
  }
  return updaterModule.autoUpdater;
}

/** 从 electron-updater 事件载荷里安全取版本号 */
function versionOf(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as { version?: unknown }).version;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** 从 download-progress 载荷里安全取百分比 */
function percentOf(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as { percent?: unknown }).percent;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return '更新失败，请稍后再试。';
}

export function createUpdateService({
  currentVersion = loadElectronApp().version,
  platform = process.platform,
  isPackaged = loadElectronApp().isPackaged,
  isSmokeCheck = process.env['WORKMATE_RELEASE_SMOKE'] === '1',
  updater = loadAutoUpdater(),
  logger = console,
  now = () => new Date(),
  onChange,
  scheduleTimeout = (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    timer.unref();
    return timer;
  },
  scheduleInterval = (callback, delayMs) => {
    const timer = setInterval(callback, delayMs);
    timer.unref();
    return timer;
  },
}: CreateUpdateServiceOptions = {}): UpdateService {
  const supported = platform === 'darwin' && isPackaged && !isSmokeCheck;

  let state: AppUpdateState = {
    status: supported ? 'idle' : 'unsupported',
    currentVersion,
    availableVersion: null,
    downloadedVersion: null,
    progressPercent: null,
    errorMessage: null,
    lastCheckedAt: null,
  };

  const setState = (patch: Partial<AppUpdateState>): AppUpdateState => {
    state = { ...state, ...patch };
    onChange?.(state);
    return state;
  };

  const markChecked = (status: UpdateStatus, patch: Partial<AppUpdateState> = {}) =>
    setState({ status, lastCheckedAt: now().toISOString(), errorMessage: null, ...patch });

  if (supported) {
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;

    updater.on('checking-for-update', () => {
      setState({ status: 'checking', errorMessage: null });
    });

    updater.on('update-available', (info) => {
      markChecked('available', {
        availableVersion: versionOf(info),
        downloadedVersion: null,
        progressPercent: null,
      });
    });

    updater.on('update-not-available', () => {
      markChecked('idle', { availableVersion: null, progressPercent: null });
    });

    updater.on('download-progress', (progress) => {
      setState({ status: 'downloading', progressPercent: percentOf(progress), errorMessage: null });
    });

    updater.on('update-downloaded', (info) => {
      const version = versionOf(info) ?? state.availableVersion;
      logger.info('[updater] update downloaded; ready to install on restart/quit');
      setState({
        status: 'downloaded',
        downloadedVersion: version,
        availableVersion: null,
        progressPercent: null,
        errorMessage: null,
      });
    });

    updater.on('error', (error) => {
      logger.warn('[updater] update error', error);
      // 已有就绪版本时报错（多为后续检查抖动）不要抹掉"可重启安装"的状态
      if (state.status === 'downloaded') return;
      setState({ status: 'error', progressPercent: null, errorMessage: messageOf(error) });
    });
  }

  const checkForUpdates = async (): Promise<AppUpdateState> => {
    if (!supported) return state;
    if (state.status === 'restarting' || state.status === 'downloading') return state;

    setState({ status: 'checking', errorMessage: null });
    try {
      await updater.checkForUpdates();
    } catch (error) {
      logger.warn('[updater] update check failed', error);
      setState({
        status: 'error',
        errorMessage: messageOf(error),
        lastCheckedAt: now().toISOString(),
      });
    }
    return state;
  };

  const restartToInstall = (): void => {
    if (state.status !== 'downloaded') return;
    setState({ status: 'restarting' });
    updater.autoInstallOnAppQuit = true;
    try {
      updater.quitAndInstall(false, true);
    } catch (error) {
      logger.warn('[updater] quitAndInstall failed', error);
      setState({ status: 'downloaded', errorMessage: messageOf(error) });
    }
  };

  const startAutomaticChecks = (): void => {
    if (!supported) return;
    // 启动后首检 + 之后周期性静默复检（长开的 app 不重启也能拿到新版本）
    scheduleTimeout(() => {
      void checkForUpdates();
    }, STARTUP_CHECK_DELAY_MS);
    scheduleInterval(() => {
      void checkForUpdates();
    }, RECHECK_INTERVAL_MS);
  };

  return {
    getState: () => state,
    checkForUpdates,
    restartToInstall,
    startAutomaticChecks,
  };
}
