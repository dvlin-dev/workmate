import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export type LoggerLike = Pick<typeof console, 'info' | 'warn'>;

export type DialogLike = {
  showMessageBox: (options: {
    type?: 'none' | 'info' | 'error' | 'question' | 'warning';
    buttons?: string[];
    defaultId?: number;
    cancelId?: number;
    message: string;
    detail?: string;
  }) => Promise<{ response: number }>;
};

type TimerLike = {
  unref?: () => void;
};

type UpdaterEvent =
  | 'update-not-available'
  | 'update-downloaded'
  | 'error'
  | 'update-available'
  | 'download-progress';

type UpdaterLike = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void;
  on: (event: UpdaterEvent, listener: (...args: unknown[]) => void) => unknown;
};

export type UpdateService = {
  startAutomaticChecks: () => void;
  checkForUpdates: (options?: { interactive?: boolean }) => Promise<void>;
};

type CreateUpdateServiceOptions = {
  platform?: NodeJS.Platform;
  isPackaged?: boolean;
  isSmokeCheck?: boolean;
  updater?: UpdaterLike;
  logger?: LoggerLike;
  dialog?: DialogLike;
  scheduleTimeout?: (callback: () => void, delayMs: number) => TimerLike;
};

const STARTUP_CHECK_DELAY_MS = 20_000;

function loadElectronApp(): { isPackaged: boolean } {
  const electron = require('electron') as { app?: { isPackaged?: boolean } };
  return { isPackaged: electron.app?.isPackaged === true };
}

function loadElectronDialog(): DialogLike {
  const electron = require('electron') as { dialog?: DialogLike };
  if (!electron.dialog) {
    throw new Error('electron.dialog is unavailable.');
  }
  return electron.dialog;
}

function loadAutoUpdater(): UpdaterLike {
  const updaterModule = require('electron-updater') as { autoUpdater?: UpdaterLike };
  if (!updaterModule.autoUpdater) {
    throw new Error('electron-updater.autoUpdater is unavailable.');
  }
  return updaterModule.autoUpdater;
}

export function createUpdateService({
  platform = process.platform,
  isPackaged = loadElectronApp().isPackaged,
  isSmokeCheck = process.env['WORKMATE_RELEASE_SMOKE'] === '1',
  updater = loadAutoUpdater(),
  logger = console,
  dialog = loadElectronDialog(),
  scheduleTimeout = (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    timer.unref();
    return timer;
  },
}: CreateUpdateServiceOptions = {}): UpdateService {
  const supported = platform === 'darwin' && isPackaged && !isSmokeCheck;
  let lastCheckWasInteractive = false;

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  updater.on('error', (error) => {
    logger.warn('[updater] update check failed', error);
    if (!lastCheckWasInteractive) return;
    lastCheckWasInteractive = false;
    void dialog.showMessageBox({
      type: 'warning',
      buttons: ['好'],
      message: '检查更新失败，请稍后再试。',
    });
  });

  updater.on('update-not-available', () => {
    if (!lastCheckWasInteractive) return;
    lastCheckWasInteractive = false;
    void dialog.showMessageBox({
      type: 'info',
      buttons: ['好'],
      message: '当前已是最新版本。',
    });
  });

  updater.on('update-downloaded', () => {
    logger.info('[updater] update downloaded; it will be installed on quit');
    if (!lastCheckWasInteractive) return;
    lastCheckWasInteractive = false;

    void dialog
      .showMessageBox({
        type: 'info',
        buttons: ['稍后', '重启安装'],
        defaultId: 1,
        cancelId: 0,
        message: '新版本已下载，重启 Workmate 后即可安装。',
      })
      .then((result) => {
        if (result.response === 1) {
          updater.quitAndInstall(false, true);
        }
      });
  });

  const checkForUpdates = async ({
    interactive = false,
  }: { interactive?: boolean } = {}): Promise<void> => {
    lastCheckWasInteractive = interactive;

    if (!supported) {
      if (interactive) {
        await dialog.showMessageBox({
          type: 'info',
          buttons: ['好'],
          message: '开发环境不会检查更新。',
        });
      }
      return;
    }

    try {
      await updater.checkForUpdates();
    } catch (error) {
      logger.warn('[updater] update check failed', error);
      lastCheckWasInteractive = false;
      if (interactive) {
        await dialog.showMessageBox({
          type: 'warning',
          buttons: ['好'],
          message: '检查更新失败，请稍后再试。',
        });
      }
    }
  };

  return {
    startAutomaticChecks: () => {
      if (!supported) return;
      scheduleTimeout(() => {
        void checkForUpdates();
      }, STARTUP_CHECK_DELAY_MS);
    },
    checkForUpdates,
  };
}
