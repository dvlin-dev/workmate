import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createUpdateService, type DialogLike, type LoggerLike } from '../src/main/updater';

class FakeUpdater extends EventEmitter {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  checkForUpdates = vi.fn(async () => undefined);
  quitAndInstall = vi.fn();
}

type TestDeps = {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  isSmokeCheck: boolean;
  updater: FakeUpdater;
  dialog: DialogLike;
  logger: LoggerLike;
  scheduleTimeout: (callback: () => void) => { unref: ReturnType<typeof vi.fn> };
};

function makeDeps(overrides: Partial<TestDeps> = {}): TestDeps {
  const updater = new FakeUpdater();
  const dialog: DialogLike = {
    showMessageBox: vi.fn(async () => ({ response: 0 })),
  };
  const logger: LoggerLike = {
    info: vi.fn(),
    warn: vi.fn(),
  };

  return {
    platform: 'darwin' as NodeJS.Platform,
    isPackaged: true,
    isSmokeCheck: false,
    updater,
    dialog,
    logger,
    scheduleTimeout: (callback: () => void) => {
      callback();
      return { unref: vi.fn() };
    },
    ...overrides,
  };
}

describe('createUpdateService', () => {
  it('does not check updates outside packaged macOS builds', () => {
    const deps = makeDeps({ isPackaged: false });
    const service = createUpdateService(deps);

    service.startAutomaticChecks();

    expect(deps.updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('does not check updates during packaged smoke checks', () => {
    const deps = makeDeps({ isSmokeCheck: true });
    const service = createUpdateService(deps);

    service.startAutomaticChecks();

    expect(deps.updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('checks for updates on packaged macOS builds', async () => {
    const deps = makeDeps();
    const service = createUpdateService(deps);

    service.startAutomaticChecks();

    await vi.waitFor(() => expect(deps.updater.checkForUpdates).toHaveBeenCalledTimes(1));
    expect(deps.updater.autoDownload).toBe(true);
    expect(deps.updater.autoInstallOnAppQuit).toBe(true);
  });

  it('keeps automatic check failures silent except for logs', async () => {
    const deps = makeDeps();
    deps.updater.checkForUpdates.mockRejectedValueOnce(new Error('network down'));
    const service = createUpdateService(deps);

    await service.checkForUpdates();

    expect(deps.logger.warn).toHaveBeenCalled();
    expect(deps.dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('shows a Chinese failure message for interactive checks', async () => {
    const deps = makeDeps();
    deps.updater.checkForUpdates.mockRejectedValueOnce(new Error('network down'));
    const service = createUpdateService(deps);

    await service.checkForUpdates({ interactive: true });

    expect(deps.dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: '检查更新失败，请稍后再试。' })
    );
  });

  it('shows a Chinese failure message when an interactive check emits an error', async () => {
    const deps = makeDeps();
    const service = createUpdateService(deps);

    await service.checkForUpdates({ interactive: true });
    deps.updater.emit('error', new Error('feed unavailable'));

    await vi.waitFor(() =>
      expect(deps.dialog.showMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({ message: '检查更新失败，请稍后再试。' })
      )
    );
  });

  it('tells the user when an interactive check finds no update', async () => {
    const deps = makeDeps();
    const service = createUpdateService(deps);

    await service.checkForUpdates({ interactive: true });
    deps.updater.emit('update-not-available');

    await vi.waitFor(() =>
      expect(deps.dialog.showMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({ message: '当前已是最新版本。' })
      )
    );
  });

  it('can restart to install after an interactive downloaded update', async () => {
    const deps = makeDeps({
      dialog: {
        showMessageBox: vi.fn(async () => ({ response: 1 })),
      },
    });
    const service = createUpdateService(deps);

    await service.checkForUpdates({ interactive: true });
    deps.updater.emit('update-downloaded');

    await vi.waitFor(() => expect(deps.updater.quitAndInstall).toHaveBeenCalledWith(false, true));
  });
});
