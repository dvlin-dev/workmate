# Workmate · 工作搭子

一个 **AI-native 的 macOS 桌面「工作搭子」**：用自然语言随手录入本周/当天的目标和进展，agent 通过一组 tool 把它结构化成「周目标树」（右侧看板实时反映）；干活途中口语化同步进度，agent 负责归因到对应目标；拆出的待办单向写入 macOS 提醒事项；周五一键生成叙事性周报。

本仓库交付两个产物：

- **桌面端 App**（`app/`）：Electron + React + TypeScript + Vite。核心闭环。
- **官网**（`website/`）：Vite + React 静态站，介绍产品并提供下载。

> 设计与实现细节见 [`docs/`](./docs/index.md)。架构、token 体系、组件、agent 运行时采用成熟的 Electron + agents-core 实践。

## 快速开始（桌面端）

包管理器用 **pnpm**（已通过 `packageManager` 锁定 `pnpm@9.12.2`）。先启用 corepack 让 `pnpm` 自动使用锁定版本：

```bash
corepack enable        # 一次性：让 pnpm 走 packageManager 锁定的 9.12.2
cd app
pnpm install
pnpm dev               # 起开发窗口（1280×800，左对话 / 右看板）
```

> 若不想用 corepack，请确保全局 `pnpm` 为 9.x（pnpm 10+ 不再从 package.json 读 `pnpm.overrides`，会导致 `@openai/agents-core` 版本冲突）。

- 首次启动若未配置 LLM key，会自动打开设置页引导。
- 未配置 `apiKey` 时，发送消息会直接打开设置页；填写真实 LLM 配置后才开始归因和更新看板。

### 配置 LLM

设置页填三项：

| 字段 | 说明 |
|------|------|
| `baseURL` | 默认 `https://api.openai.com/v1`（OpenAI 官方），可改为任意 OpenAI 兼容服务（自建网关 / 第三方） |
| `apiKey` | 你的 key，**仅保存在本地**，绝不上传。在你的 LLM 服务商处获取 |
| `model` | 默认 `gpt-5.5`（占位，按你服务商的可用模型改） |

填好后点「测试连接」验证。**绝不硬编码任何密钥** —— 本项目开源，key 一律由用户自填。

### 授权提醒事项（可选）

agent 拆出的带时间待办会单向写入 macOS「提醒事项」的 `Workmate` 列表。首次写入会触发系统授权弹窗（自动化 + 提醒事项访问）。若被拒，agent 会口头引导你去「系统设置 → 隐私与安全性 → 自动化 / 提醒事项」允许 Workmate。

> dev 模式下应用身份是 “Electron”；要完整演示授权流程，建议用打包产物。

### 测试 / 打包

```bash
cd app
pnpm test           # vitest 单测（store / tools / agent loop / report / reminders / nudge / hardening）
pnpm run typecheck  # tsc 类型检查
pnpm run build      # electron-vite 三 bundle 构建
pnpm run dist:mac   # 打包 dmg + zip（arm64 + x64）
```

## 官网

```bash
cd website
pnpm install
pnpm dev           # 本地预览
pnpm run build     # 出纯静态到 website/dist/
```

`dist/` 是纯静态产物，丢任意静态托管即可。下载链接默认指向 GitHub Releases（改 `website/src/lib/site.ts`）。

## 首次打开（未签名构建）

当前 dmg/zip 未做 Apple 代码签名与公证。下载后首次打开若提示「已损坏」或「无法验证」，任选其一：

- 右键 App →「打开」→ 在弹窗里再次「打开」；或
- 终端执行 `xattr -cr /Applications/Workmate.app` 后再打开。

> 自己打包签名版：申请 Apple Developer ID 后在 `app/electron-builder.yml` 配 `mac.notarize` 与签名证书。

## 边界

仅单机单用户、仅 macOS；提醒事项只写不读（单向）；不做云同步 / 账号 / 多人协作。详见 [`CLAUDE.md`](./CLAUDE.md) 全局边界。

## 许可证与贡献

- 开源协议：[MIT](./LICENSE)。
- 参与开发见 [CONTRIBUTING.md](./CONTRIBUTING.md)；安全问题见 [SECURITY.md](./SECURITY.md)。
