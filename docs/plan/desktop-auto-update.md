# 桌面端自动更新实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or execute inline task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Workmate macOS packaged app 接入基于 GitHub Release 的克制自动更新能力。

**Architecture:** 使用 `electron-updater` 和 `electron-builder` 的 publish 契约，不手写下载逻辑。主进程提供一个小型 updater 服务：packaged macOS 启动后静默检查并下载，菜单手动检查时才显示中文原生提示。release workflow 负责把双架构构建产生的 `latest-mac.yml` 合并并上传到 GitHub Release。

**Tech Stack:** Electron 31、electron-builder 26、electron-updater 6、TypeScript、Vitest、GitHub Actions、GitHub Release。

## Global Constraints

- 只处理桌面端自动更新；不改 agent、业务数据模型、渲染层业务 UI、提醒事项逻辑。
- 只支持 macOS；不添加 Windows/Linux target。
- 不引入 R2、多 channel、多 provider、会员/灰度/复杂设置。
- 开发环境不检查更新；`WORKMATE_RELEASE_SMOKE=1` 不检查更新。
- 无网络、无 release、检查失败时自动路径只记录日志，不打扰用户。
- 用户可通过菜单“检查更新…”手动触发；所有用户可见文案用中文。
- 不执行 `git commit` / `git push` / `git tag`，除非用户明确授权。
- 工作区已有其它 agent 未提交改动时，只修改本计划列出的自动更新相关文件。

---

## 实施进度

- [x] 依赖与 `electron-builder` GitHub publish 契约已接入。
- [x] 主进程 updater 服务已实现：packaged macOS 静默检查，开发环境和 smoke check 跳过，手动检查使用中文原生提示。
- [x] macOS 应用菜单已增加“检查更新…”入口。
- [x] release workflow 已改为合并并上传双架构 `latest-mac.yml`。
- [x] 自动更新相关单测已新增并通过。
- [x] `docs/reference/release.md` 与 `docs/reference/project-structure.md` 已同步稳定契约。
- [x] 已通过 `pnpm run typecheck`、`pnpm test`、`pnpm run build`、`CSC_IDENTITY_AUTO_DISCOVERY=false pnpm run pack`、`CSC_IDENTITY_AUTO_DISCOVERY=false pnpm run dist:mac:arm64`、`pnpm run smoke:packaged`。
- [x] 已确认 arm64 dist 产物生成 `latest-mac.yml`，包内 `app-update.yml` 指向 GitHub provider。
- [x] 实际实现采用 `updater.ts` 依赖注入 + lazy load，测试用 CLI 驱动 `merge-update-yml.mjs`，避免测试环境真实加载 Electron/electron-updater。
- [x] 全量复核补充验证 x64 dist 与真实 arm64/x64 feed 合并，补齐 `app/package.json` 发布元数据以消除 electron-builder author 警告。
- [x] 原工作区存在进入本任务前已有的非自动更新改动；推送分支使用干净 worktree 重新应用自动更新补丁，未夹带这些改动。

---

## File Structure

- Modify: `app/package.json`
  - 加 `electron-updater` 运行时依赖。
  - 如脚本直接解析 YAML，加 `js-yaml` devDependency。
  - 确认 `smoke:packaged` 要求 `electron-updater` 存在于 `app.asar`。
- Modify: `app/pnpm-lock.yaml`
  - 由 `pnpm install` 更新锁文件。
- Modify: `app/electron-builder.yml`
  - 增加 GitHub `publish` 配置。
  - 保持 macOS-only dmg + zip。
- Create: `app/src/main/updater.ts`
  - 封装 `electron-updater` 初始化、自动检查、手动检查、重启安装。
- Modify: `app/src/main/menu.ts`
  - App 菜单加入“检查更新…”，通过注入回调触发。
- Modify: `app/src/main/index.ts`
  - 创建 updater service，传入菜单，窗口创建后启动静默检查。
- Create: `app/scripts/merge-update-yml.mjs`
  - 合并 arm64/x64 的 `latest-mac.yml`。
- Create: `app/test/update-feed.test.ts`
  - 测试合并 feed 的核心行为。
- Create: `app/test/updater.test.ts`
  - 测试 updater gating、自动静默、手动提示、下载完成安装。
- Modify: `.github/workflows/release-app.yml`
  - publish job 合并并上传 `latest-mac.yml`。
- Modify: `docs/reference/release.md`
  - 更新发布与自动更新契约。
- Modify: `docs/reference/project-structure.md`
  - 更新依赖与打包说明，移除“不做 electron-updater”的过期描述。

不要修改：

- `app/src/main/agent/**`
- `app/src/renderer/**`
- `app/src/shared/config.ts`
- `docs/design/**`
- `website/**`

## Task 1: 依赖与 electron-builder 发布契约

**Files:**
- Modify: `app/package.json`
- Modify: `app/pnpm-lock.yaml`
- Modify: `app/electron-builder.yml`

**Interfaces:**
- Produces: packaged app 内的 `resources/app-update.yml`，由 `electron-updater` 运行时自动读取。
- Produces: macOS zip/dmg 构建时生成 `latest-mac.yml`。

- [ ] **Step 1: 安装依赖**

Run:

```bash
cd app
pnpm add electron-updater@^6.8.9
pnpm add -D js-yaml@^4.1.0
```

Expected:

- `app/package.json` dependencies 包含 `electron-updater`。
- `app/package.json` devDependencies 包含 `js-yaml`。
- `app/pnpm-lock.yaml` 更新。

- [ ] **Step 2: 更新 smoke 检查依赖清单**

在 `app/package.json` 的 `smoke:packaged` 脚本末尾增加：

```json
"--require-package electron-updater"
```

Expected:

- 打包 smoke check 会确认 updater 运行时包进入 `app.asar`。

- [ ] **Step 3: 更新 `electron-builder.yml`**

在顶层 `files` 后加入：

```yaml
electronUpdaterCompatibility: ">= 2.16"
publish:
  - provider: github
    owner: dvlin-dev
    repo: workmate
```

Expected:

- `electron-builder` 生成包内 `app-update.yml`。
- GitHub Release 成为 updater feed 来源。
- 仍只构建 macOS dmg/zip。

- [ ] **Step 4: 验证配置语法**

Run:

```bash
cd app
pnpm run typecheck
```

Expected:

- PASS。

## Task 2: 新增最小 updater 服务

**Files:**
- Create: `app/src/main/updater.ts`
- Test: `app/test/updater.test.ts`

**Interfaces:**
- Produces: `createUpdateService(options?: CreateUpdateServiceOptions): UpdateService`
- Produces: `UpdateService.startAutomaticChecks(): void`
- Produces: `UpdateService.checkForUpdates(options?: { interactive?: boolean }): Promise<void>`

- [ ] **Step 1: 写失败测试：开发环境和 smoke 环境不检查**

Create `app/test/updater.test.ts` with initial cases:

```ts
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createUpdateService } from '../src/main/updater';

class FakeUpdater extends EventEmitter {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  checkForUpdates = vi.fn(async () => undefined);
  quitAndInstall = vi.fn();
}

describe('createUpdateService', () => {
  it('does not check updates outside packaged macOS builds', async () => {
    const updater = new FakeUpdater();
    const service = createUpdateService({
      platform: 'darwin',
      isPackaged: false,
      isSmokeCheck: false,
      updater,
      logger: { warn: vi.fn(), info: vi.fn() },
      dialog: { showMessageBox: vi.fn() },
      scheduleTimeout: (callback) => {
        callback();
        return { unref: vi.fn() };
      },
    });

    service.startAutomaticChecks();

    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('does not check updates during packaged smoke checks', async () => {
    const updater = new FakeUpdater();
    const service = createUpdateService({
      platform: 'darwin',
      isPackaged: true,
      isSmokeCheck: true,
      updater,
      logger: { warn: vi.fn(), info: vi.fn() },
      dialog: { showMessageBox: vi.fn() },
      scheduleTimeout: (callback) => {
        callback();
        return { unref: vi.fn() };
      },
    });

    service.startAutomaticChecks();

    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });
});
```

Run:

```bash
cd app
pnpm test -- updater.test.ts
```

Expected:

- FAIL because `../src/main/updater` does not exist.

- [ ] **Step 2: 实现服务骨架**

Create `app/src/main/updater.ts`:

```ts
import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

type Logger = Pick<typeof console, 'info' | 'warn'>;

type DialogLike = {
  showMessageBox: typeof dialog.showMessageBox;
};

type TimerLike = {
  unref?: () => void;
};

type UpdaterLike = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
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
  logger?: Logger;
  dialog?: DialogLike;
  scheduleTimeout?: (callback: () => void, delayMs: number) => TimerLike;
};

const STARTUP_CHECK_DELAY_MS = 20_000;

export function createUpdateService({
  platform = process.platform,
  isPackaged = app.isPackaged,
  isSmokeCheck = process.env['WORKMATE_RELEASE_SMOKE'] === '1',
  updater = autoUpdater,
  logger = console,
  dialog: dialogApi = dialog,
  scheduleTimeout = (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    timer.unref();
    return timer;
  },
}: CreateUpdateServiceOptions = {}): UpdateService {
  const supported = platform === 'darwin' && isPackaged && !isSmokeCheck;

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  updater.on('error', (error) => {
    logger.warn('[updater] update check failed', error);
  });

  updater.on('update-downloaded', () => {
    logger.info('[updater] update downloaded; it will be installed on quit');
  });

  const checkForUpdates = async ({ interactive = false }: { interactive?: boolean } = {}) => {
    if (!supported) {
      if (interactive) {
        await dialogApi.showMessageBox({
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
      if (interactive) {
        await dialogApi.showMessageBox({
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
```

Run:

```bash
cd app
pnpm test -- updater.test.ts
```

Expected:

- PASS for gating tests.

- [ ] **Step 3: 补充手动检查行为测试**

Extend `app/test/updater.test.ts`:

```ts
it('checks for updates on packaged macOS builds', async () => {
  const updater = new FakeUpdater();
  const service = createUpdateService({
    platform: 'darwin',
    isPackaged: true,
    isSmokeCheck: false,
    updater,
    logger: { warn: vi.fn(), info: vi.fn() },
    dialog: { showMessageBox: vi.fn() },
    scheduleTimeout: (callback) => {
      callback();
      return { unref: vi.fn() };
    },
  });

  service.startAutomaticChecks();

  await vi.waitFor(() => expect(updater.checkForUpdates).toHaveBeenCalledTimes(1));
  expect(updater.autoDownload).toBe(true);
  expect(updater.autoInstallOnAppQuit).toBe(true);
});

it('shows a Chinese failure message only for interactive checks', async () => {
  const updater = new FakeUpdater();
  updater.checkForUpdates.mockRejectedValueOnce(new Error('network down'));
  const showMessageBox = vi.fn();
  const service = createUpdateService({
    platform: 'darwin',
    isPackaged: true,
    isSmokeCheck: false,
    updater,
    logger: { warn: vi.fn(), info: vi.fn() },
    dialog: { showMessageBox },
  });

  await service.checkForUpdates({ interactive: true });

  expect(showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({ message: '检查更新失败，请稍后再试。' })
  );
});
```

Run:

```bash
cd app
pnpm test -- updater.test.ts
```

Expected:

- PASS.

- [ ] **Step 4: 补充下载完成提示与重启安装**

Add a downloaded event handler in `updater.ts` that shows a prompt only after interactive checks:

```ts
let lastCheckWasInteractive = false;

updater.on('update-downloaded', () => {
  logger.info('[updater] update downloaded; it will be installed on quit');
  if (!lastCheckWasInteractive) return;

  void dialogApi
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
```

Set `lastCheckWasInteractive = interactive` before calling `checkForUpdates()`.

Add test:

```ts
it('can restart to install after an interactive downloaded update', async () => {
  const updater = new FakeUpdater();
  const showMessageBox = vi.fn(async () => ({ response: 1 }));
  const service = createUpdateService({
    platform: 'darwin',
    isPackaged: true,
    isSmokeCheck: false,
    updater,
    logger: { warn: vi.fn(), info: vi.fn() },
    dialog: { showMessageBox },
  });

  await service.checkForUpdates({ interactive: true });
  updater.emit('update-downloaded');
  await vi.waitFor(() => expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true));
});
```

Run:

```bash
cd app
pnpm test -- updater.test.ts
```

Expected:

- PASS.

## Task 3: 接入主进程菜单和启动生命周期

**Files:**
- Modify: `app/src/main/menu.ts`
- Modify: `app/src/main/index.ts`

**Interfaces:**
- Consumes: `UpdateService.checkForUpdates({ interactive: true })`
- Consumes: `UpdateService.startAutomaticChecks()`

- [ ] **Step 1: 修改菜单函数签名**

Change `app/src/main/menu.ts`:

```ts
type AppMenuOptions = {
  checkForUpdates?: () => void;
};

export function buildAppMenu({ checkForUpdates }: AppMenuOptions = {}): void {
```

In the macOS app menu submenu, place after “设置…”:

```ts
{
  label: '检查更新…',
  click: () => checkForUpdates?.(),
},
```

Expected:

- 菜单显示中文“检查更新…”。
- 未传回调时菜单点击无副作用。

- [ ] **Step 2: 接入主进程入口**

Modify `app/src/main/index.ts`:

```ts
import { createUpdateService } from './updater';
```

Inside `app.whenReady().then(async () => { ... })`, before `buildAppMenu()`:

```ts
const updates = createUpdateService();
```

Replace `buildAppMenu();` with:

```ts
buildAppMenu({
  checkForUpdates: () => {
    void updates.checkForUpdates({ interactive: true });
  },
});
```

After `await createMainWindow();`:

```ts
updates.startAutomaticChecks();
```

Run:

```bash
cd app
pnpm run typecheck
```

Expected:

- PASS.

## Task 4: 合并并上传双架构 `latest-mac.yml`

**Files:**
- Create: `app/scripts/merge-update-yml.mjs`
- Create: `app/test/update-feed.test.ts`
- Modify: `.github/workflows/release-app.yml`

**Interfaces:**
- Produces: `.release-assets/latest-mac.yml`
- Consumes: `.artifacts/darwin-arm64/latest-mac.yml`
- Consumes: `.artifacts/darwin-x64/latest-mac.yml`

- [ ] **Step 1: 写 feed 合并测试**

Create `app/test/update-feed.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeUpdateFeeds } from '../scripts/merge-update-yml.mjs';

const releaseDate = new Date(0).toISOString();

const arm64Feed = {
  version: '0.2.0',
  files: [
    { url: 'Workmate-0.2.0-arm64.zip', sha512: 'arm64-zip', size: 100 },
    { url: 'Workmate-0.2.0-arm64.dmg', sha512: 'arm64-dmg', size: 200 },
  ],
  path: 'Workmate-0.2.0-arm64.zip',
  sha512: 'arm64-zip',
  releaseDate,
};

const x64Feed = {
  version: '0.2.0',
  files: [
    { url: 'Workmate-0.2.0-x64.zip', sha512: 'x64-zip', size: 300 },
    { url: 'Workmate-0.2.0-x64.dmg', sha512: 'x64-dmg', size: 400 },
  ],
  path: 'Workmate-0.2.0-x64.zip',
  sha512: 'x64-zip',
  releaseDate,
};

describe('mergeUpdateFeeds', () => {
  it('merges arm64 and x64 files into one latest-mac feed', () => {
    const result = mergeUpdateFeeds({ arm64Feed, x64Feed });

    expect(result.version).toBe('0.2.0');
    expect(result.files.map((file) => file.url)).toEqual([
      'Workmate-0.2.0-arm64.zip',
      'Workmate-0.2.0-arm64.dmg',
      'Workmate-0.2.0-x64.zip',
      'Workmate-0.2.0-x64.dmg',
    ]);
    expect(result.path).toBe('Workmate-0.2.0-arm64.zip');
  });

  it('rejects invalid feeds', () => {
    expect(() =>
      mergeUpdateFeeds({ arm64Feed: { ...arm64Feed, files: undefined }, x64Feed } as never)
    ).toThrow('arm64 feed is missing files array');
  });
});
```

Run:

```bash
cd app
pnpm test -- update-feed.test.ts
```

Expected:

- FAIL because script does not exist.

- [ ] **Step 2: 实现 merge 脚本**

Create `app/scripts/merge-update-yml.mjs`:

```js
#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const fail = (message) => {
  throw new Error(message);
};

const assertFeed = (name, feed) => {
  if (!feed || typeof feed !== 'object') fail(`${name} feed is not an object`);
  if (!Array.isArray(feed.files)) fail(`${name} feed is missing files array`);
};

export const mergeUpdateFeeds = ({ arm64Feed, x64Feed }) => {
  assertFeed('arm64', arm64Feed);
  assertFeed('x64', x64Feed);

  return {
    version: arm64Feed.version,
    files: [...arm64Feed.files, ...x64Feed.files],
    path: arm64Feed.path,
    sha512: arm64Feed.sha512,
    releaseDate: arm64Feed.releaseDate,
  };
};

const readFeed = async (filePath) => yaml.load(await fs.readFile(filePath, 'utf8'));

const parseArgs = (argv) => {
  const values = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    values.set(argv[i], argv[i + 1]);
  }
  const arm64Dir = values.get('--arm64-dir');
  const x64Dir = values.get('--x64-dir');
  const outputDir = values.get('--output-dir');
  if (!arm64Dir) fail('Missing --arm64-dir');
  if (!x64Dir) fail('Missing --x64-dir');
  if (!outputDir) fail('Missing --output-dir');
  return { arm64Dir, x64Dir, outputDir };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const arm64Feed = await readFeed(path.join(args.arm64Dir, 'latest-mac.yml'));
  const x64Feed = await readFeed(path.join(args.x64Dir, 'latest-mac.yml'));
  const merged = mergeUpdateFeeds({ arm64Feed, x64Feed });

  await fs.mkdir(args.outputDir, { recursive: true });
  await fs.writeFile(
    path.join(args.outputDir, 'latest-mac.yml'),
    yaml.dump(merged, { lineWidth: 120, noRefs: true })
  );

  console.log(
    JSON.stringify(
      { version: merged.version, files: merged.files.length, output: path.join(args.outputDir, 'latest-mac.yml') },
      null,
      2
    )
  );
};

if (process.argv[1]?.endsWith('merge-update-yml.mjs')) {
  await main();
}
```

Run:

```bash
cd app
pnpm test -- update-feed.test.ts
```

Expected:

- PASS.

- [ ] **Step 3: 修改 release workflow 的 publish job**

In `.github/workflows/release-app.yml`, publish job should install app deps before running the script:

```yaml
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: pnpm install --frozen-lockfile --prefer-offline
        working-directory: app
```

Replace “Collect release assets” body with:

```bash
set -euo pipefail
mkdir -p .release-assets

node app/scripts/merge-update-yml.mjs \
  --arm64-dir ".artifacts/darwin-arm64" \
  --x64-dir ".artifacts/darwin-x64" \
  --output-dir ".release-assets"

for arch in darwin-arm64 darwin-x64; do
  find ".artifacts/${arch}" -maxdepth 1 -type f \( \
    -name '*.dmg' -o \
    -name '*.zip' -o \
    -name '*.blockmap' \
  \) -exec cp {} .release-assets/ \;
done

test -f .release-assets/latest-mac.yml

echo "Release assets:"
ls -lh .release-assets/
```

Expected:

- GitHub Release 上传 dmg/zip/blockmap/latest-mac.yml。
- 不改变签名、公证、构建矩阵。

## Task 5: 文档维护

**Files:**
- Modify: `docs/reference/release.md`
- Modify: `docs/reference/project-structure.md`

- [ ] **Step 1: 更新 release 文档**

In `docs/reference/release.md`:

- 将开头改为说明“不引入 R2，自动更新 feed 使用 GitHub Release 资产”。
- 在产物列表加入 `latest-mac.yml`。
- 增加自动更新契约：
  - packaged macOS 启动后静默检查；
  - 开发环境和 smoke check 不检查；
  - GitHub Release 必须包含 `latest-mac.yml`；
  - v0.1.0 未包含更新元数据，自动更新从后续版本开始生效。

- [ ] **Step 2: 更新工程结构文档**

In `docs/reference/project-structure.md`:

- 运行时依赖表加入 `electron-updater`。
- 打包配置要点加入 `publish.provider=github`。
- 明确 `electron-updater` 已成为自动更新机制，不再在“不做”列表中出现。

Run:

```bash
rg -n "electron-updater|latest-mac.yml|自动更新|publish" docs/reference/release.md docs/reference/project-structure.md
```

Expected:

- 文档能搜到新的自动更新契约。
- 不再出现“`electron-updater`”作为非目标。

## Task 6: 本地验证

**Files:**
- No new files.

- [ ] **Step 1: 类型检查**

Run:

```bash
cd app
pnpm run typecheck
```

Expected:

- PASS.

- [ ] **Step 2: 单测**

Run:

```bash
cd app
pnpm test
```

Expected:

- PASS.

- [ ] **Step 3: 构建**

Run:

```bash
cd app
pnpm run build
```

Expected:

- PASS.

- [ ] **Step 4: 本地 pack 验证**

Run:

```bash
cd app
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm run pack
```

Expected:

- PASS.
- `app/release/${version}/mac*/Workmate.app` 存在。
- smoke check 不会因为自动更新触网而失败。

- [ ] **Step 5: 检查生成的更新元数据**

Run:

```bash
cd app
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm run dist:mac:arm64
find release -name latest-mac.yml -print
find release -name app-update.yml -print
```

Expected:

- `latest-mac.yml` 在 mac target 输出中存在；`--dir` pack 不生成该 feed。
- packaged app 内存在 updater 运行所需的 `app-update.yml`；用 mac target 产物验证。

## Task 7: 变更边界检查

**Files:**
- No new files.

- [ ] **Step 1: 检查实际改动文件**

Run:

```bash
git diff --name-only
```

Expected: 本任务新增或修改只包含：

```text
.github/workflows/release-app.yml
app/electron-builder.yml
app/package.json
app/pnpm-lock.yaml
app/scripts/merge-update-yml.mjs
app/src/main/index.ts
app/src/main/menu.ts
app/src/main/updater.ts
app/test/update-feed.test.ts
app/test/updater.test.ts
docs/reference/project-structure.md
docs/reference/release.md
```

允许额外出现本计划文件本身：

```text
docs/plan/desktop-auto-update.md
```

- [ ] **Step 2: 确认没有业务代码夹带**

Run:

```bash
git diff -- app/src/main/agent app/src/renderer app/src/shared/config.ts docs/design website
```

Expected:

- 没有本任务新增 diff。

## Handoff Notes

- `v0.1.0` 已发布且没有 `latest-mac.yml`，不要重建该 tag。
- 自动更新从包含本计划实现后的下一个 release 开始生效。
- GitHub Release provider 足够满足当前目标，不引入 R2。
- 如 implementation 过程中发现 GitHub Release 无法满足，再回到用户处确认，不自行切换 provider。
