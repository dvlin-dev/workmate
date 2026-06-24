# 贡献指南

欢迎参与 Workmate · 工作搭子。

## 本地开发

包管理器用 **pnpm**（已用 `packageManager` 锁 `pnpm@9.12.2`）。先启用 corepack：

```bash
corepack enable
# 桌面端
cd app && pnpm install && pnpm dev
# 官网
cd website && pnpm install && pnpm dev
```

提交前请跑（app 目录）：

```bash
pnpm run typecheck
pnpm test
pnpm run build
```

## 约定

- commit message 用英文 [Conventional Commits](https://www.conventionalcommits.org/)（`type(scope): ...`）。
- 面向用户的文案 / 错误消息 / UI 文本用中文；代码标识符用英文。
- UI 变更遵循 macOS 原生质感规范（见 [`docs/reference/design-system.md`](./docs/reference/design-system.md)）。
- 根因修复优先、不打补丁；不保留废弃代码。
- 更完整的协作规则见 [`CLAUDE.md`](./CLAUDE.md)。

## 请不要

- 不要提交任何密钥（`apiKey` 一律由用户在设置页本地填写）。
- 不要引入 native 依赖（如 `better-sqlite3`）或 monorepo workspace。
