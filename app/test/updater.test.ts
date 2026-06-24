import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createUpdateService, type LoggerLike } from '../src/main/updater';
import type { AppUpdateState } from '../src/shared/ipc';

class FakeUpdater extends EventEmitter {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  checkForUpdates = vi.fn(async () => undefined);
  quitAndInstall = vi.fn();
}

type Overrides = Parameters<typeof createUpdateService>[0];

function makeService(overrides: Overrides = {}) {
  const updater = new FakeUpdater();
  const states: AppUpdateState[] = [];
  const logger: LoggerLike = { info: vi.fn(), warn: vi.fn() };
  const service = createUpdateService({
    currentVersion: '0.1.4',
    platform: 'darwin',
    isPackaged: true,
    isSmokeCheck: false,
    updater,
    logger,
    now: () => new Date('2026-06-24T00:00:00.000Z'),
    onChange: (s) => states.push(s),
    scheduleTimeout: (cb) => {
      cb();
      return { unref: vi.fn() };
    },
    scheduleInterval: vi.fn(() => ({ unref: vi.fn() })),
    ...overrides,
  });
  return { updater, states, service, logger };
}

describe('createUpdateService · 支持判定', () => {
  it('非打包构建标记 unsupported，且不检查/不调度', () => {
    const scheduleInterval = vi.fn(() => ({ unref: vi.fn() }));
    const { service, updater } = makeService({ isPackaged: false, scheduleInterval });
    expect(service.getState().status).toBe('unsupported');
    service.startAutomaticChecks();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    expect(scheduleInterval).not.toHaveBeenCalled();
  });

  it('打包烟囱测试（smoke）也视为 unsupported', () => {
    const { service } = makeService({ isSmokeCheck: true });
    expect(service.getState().status).toBe('unsupported');
  });
});

describe('createUpdateService · 自动检查与配置', () => {
  it('打包 macOS：首检 + 周期复检，开启静默下载/退出安装', () => {
    const scheduleInterval = vi.fn(() => ({ unref: vi.fn() }));
    const { service, updater } = makeService({ scheduleInterval });
    service.startAutomaticChecks();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1); // 首检（scheduleTimeout 立即触发）
    expect(scheduleInterval).toHaveBeenCalledTimes(1); // 周期复检已登记
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
  });
});

describe('createUpdateService · 状态机（事件驱动 + 广播）', () => {
  it('checking → available → downloading → downloaded', () => {
    const { service, updater, states } = makeService();

    updater.emit('checking-for-update');
    expect(service.getState().status).toBe('checking');

    updater.emit('update-available', { version: '0.2.0' });
    expect(service.getState().status).toBe('available');
    expect(service.getState().availableVersion).toBe('0.2.0');
    expect(service.getState().lastCheckedAt).toBe('2026-06-24T00:00:00.000Z');

    updater.emit('download-progress', { percent: 42.7 });
    expect(service.getState().status).toBe('downloading');
    expect(service.getState().progressPercent).toBeCloseTo(42.7);

    updater.emit('update-downloaded', { version: '0.2.0' });
    expect(service.getState().status).toBe('downloaded');
    expect(service.getState().downloadedVersion).toBe('0.2.0');

    // 每次状态变化都广播
    expect(states.map((s) => s.status)).toEqual([
      'checking',
      'available',
      'downloading',
      'downloaded',
    ]);
  });

  it('update-not-available → idle 且记录检查时间', () => {
    const { service, updater } = makeService();
    updater.emit('update-not-available');
    expect(service.getState().status).toBe('idle');
    expect(service.getState().lastCheckedAt).toBe('2026-06-24T00:00:00.000Z');
  });

  it('error → error 状态；但已就绪时忽略后续报错', () => {
    const { service, updater } = makeService();
    updater.emit('error', new Error('feed unavailable'));
    expect(service.getState().status).toBe('error');
    expect(service.getState().errorMessage).toBe('feed unavailable');

    updater.emit('update-downloaded', { version: '0.2.0' });
    updater.emit('error', new Error('post-download blip'));
    expect(service.getState().status).toBe('downloaded'); // 不被抹掉
  });
});

describe('createUpdateService · checkForUpdates', () => {
  it('检查失败置 error，不抛出', async () => {
    const { service, updater } = makeService();
    updater.checkForUpdates.mockRejectedValueOnce(new Error('network down'));
    const result = await service.checkForUpdates();
    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('network down');
  });

  it('unsupported 时 checkForUpdates 直接返回，不调底层', async () => {
    const { service, updater } = makeService({ isPackaged: false });
    await service.checkForUpdates();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });
});

describe('createUpdateService · restartToInstall', () => {
  it('仅在 downloaded 时重启安装', () => {
    const { service, updater } = makeService();

    service.restartToInstall(); // 非 downloaded：无操作
    expect(updater.quitAndInstall).not.toHaveBeenCalled();

    updater.emit('update-downloaded', { version: '0.2.0' });
    service.restartToInstall();
    expect(service.getState().status).toBe('restarting');
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });
});
