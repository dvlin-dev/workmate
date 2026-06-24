# 发布与签名

> Workmate 只发布 macOS 桌面端。发布链路参考 moryflow 的签名/公证方式，产物与自动更新 feed 都发布到 GitHub Release；不引入 R2、Windows/Linux 目标。

## 1. 产物

- App 目录：`app/`
- 版本源：`app/package.json` 的 `version`
- Tag 规则：`vX.Y.Z`，必须与 `app/package.json` 的版本一致
- 构建产物：`Workmate-${version}-${arch}.dmg`、`Workmate-${version}-${arch}.zip` 与对应 `blockmap`
- 自动更新元数据：`latest-mac.yml`（由 arm64/x64 两份 feed 合并而来）
- 输出目录：`app/release/${version}/`

## 2. GitHub Actions

`.github/workflows/release-app.yml` 支持两种触发：

- push `v*.*.*` tag：正式发布
- `workflow_dispatch` 输入已有 tag：重跑某次发布

Workflow 会：

1. 校验 tag 与 `app/package.json` 版本一致。
2. 在 `macos-14` 构建 arm64，在 `macos-15-intel` 构建 x64。
3. 注入 `CSC_*` 与 `APPLE_*` secrets，交给 electron-builder 签名和公证。
4. 运行 `typecheck`、`test`、对应架构的 `dist:mac:*`。
5. 用 `scripts/smoke-check-packaged-app.mjs` 校验 `.app`、`app.asar`、关键运行时包并短暂启动主进程。
6. 合并 dmg/zip/blockmap/latest-mac.yml，发布到 GitHub Release。

## 3. 自动更新契约

- 机制：使用 `electron-updater` + `electron-builder` 的 GitHub `publish` 配置；运行时代码不手写下载逻辑、不手写 feed URL。
- Feed：GitHub Release 必须包含 `latest-mac.yml`，且该文件的 `files` 同时包含 arm64/x64 的 zip/dmg 条目。
- 行为：packaged macOS app 启动后延迟静默检查；开发环境与 `WORKMATE_RELEASE_SMOKE=1` 不检查。
- 失败处理：无网络、无 release、检查失败时自动路径只记录日志，不弹窗打扰用户。
- 手动入口：macOS 应用菜单提供“检查更新…”。手动检查可用中文原生弹窗提示“已是最新”“检查失败”或“新版本已下载，是否重启安装”。
- 安装：自动下载后默认在退出时安装；用户手动检查并选择“重启安装”时调用 `quitAndInstall(false, true)`。
- 兼容性：已发布的 `v0.1.0` 没有 `latest-mac.yml` 和包内 updater 配置；自动更新从包含本契约的后续版本开始生效。

## 4. GitHub Secrets

在 `Settings -> Secrets and variables -> Actions` 添加：

| Secret | 来源 |
|--------|------|
| `CSC_LINK` | `.p12` 的 base64 内容；本机可复用 iCloud `moryflow/moryflow-csc-link.base64` |
| `CSC_KEY_PASSWORD` | 导出 `.p12` 时设置的密码 |
| `APPLE_API_KEY` | App Store Connect `.p8` 内容；可直接粘贴 PEM，或粘贴 base64 |
| `APPLE_API_KEY_ID` | API Key ID；本机 iCloud 文件名 `AuthKey_SW47P2RC23.p8` 对应 `SW47P2RC23` |
| `APPLE_API_ISSUER` | App Store Connect Issuer ID（UUID） |

不要把上述值写入仓库。`APPLE_API_ISSUER` 无法从 `.p8` 文件内容可靠推导，需从 App Store Connect 或既有 secrets 中确认。

## 5. 本地预检

```bash
cd app
pnpm run typecheck
pnpm test
pnpm run build
```

如涉及打包/自动更新配置，额外跑：

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm run pack
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm run dist:mac:arm64
find release -name latest-mac.yml -print
find release -name app-update.yml -print
```

本地签名/公证打包需要先在 shell 中设置 secrets 对应的环境变量：

```bash
export CSC_LINK="$(cat "$HOME/Library/Mobile Documents/com~apple~CloudDocs/moryflow/moryflow-csc-link.base64")"
export CSC_KEY_PASSWORD="..."
export APPLE_API_KEY="$HOME/Library/Mobile Documents/com~apple~CloudDocs/moryflow/AuthKey_SW47P2RC23.p8"
export APPLE_API_KEY_ID="SW47P2RC23"
export APPLE_API_ISSUER="..."

pnpm run dist:mac:arm64
pnpm run smoke:packaged
```

## 6. 发布步骤

AI agent 不在未授权时执行 `git commit`、`git push`、`git tag`。人工发布时：

```bash
cd /Users/zhangbaolin/code/workmate
git status --short
git add app/package.json app/pnpm-lock.yaml app/electron-builder.yml app/scripts/merge-update-yml.mjs app/scripts/smoke-check-packaged-app.mjs app/src/main/index.ts app/src/main/menu.ts app/src/main/updater.ts app/test/update-feed.test.ts app/test/updater.test.ts .github/workflows/release-app.yml docs/reference/release.md docs/reference/project-structure.md
git commit -m "feat(app): add mac auto updates"
git tag -a "v$(node -p "JSON.parse(require('node:fs').readFileSync('app/package.json', 'utf8')).version")" -m "Release v$(node -p "JSON.parse(require('node:fs').readFileSync('app/package.json', 'utf8')).version")"
git push origin main
git push origin "v$(node -p "JSON.parse(require('node:fs').readFileSync('app/package.json', 'utf8')).version")"
```

push tag 后，GitHub Actions 会创建或更新对应 GitHub Release。
