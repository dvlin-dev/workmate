# Workmate（工作搭子）主仓库

> 本文件是仓库级协作入口，只承载稳定上下文：身份、边界、硬约束、技术栈、文档路由。
> 详细设计在 `docs/`。动工前先按下方「文档路由」选读对应文档。

## 项目概述

Workmate 是一个 **AI-native 的 macOS 桌面"工作搭子"**：用户用自然语言随手录入本周/当天的目标和进展，agent 通过一组 tool 把它结构化成"周目标树"（右侧看板实时反映）；干活途中口语化同步进度，agent 负责归因到对应目标；拆出的待办单向写入 macOS 提醒事项；周五一键生成叙事性周报。

本仓库交付两个产物：

- **桌面端 App**（`app/`）：Electron + React + TypeScript + Vite。核心闭环。
- **官网**（`website/`）：Vite + React 静态站，介绍产品并提供下载。

## 实现原则（复用成熟机制、按需省略功能）

判定一律按这条二分：

- **机制/架构能用成熟范式解决的 → 直接采用，不自造"更轻"的版本。**
  包括：agent 运行时（`@openai/agents-core` + Vercel AI SDK，**不手写 HTTP loop**）、LLM provider（`@ai-sdk/openai-compatible`）、设计 token、shadcn UI 组件、IPC 范式、Zustand 状态管理、Electron 构建配置、存储（`electron-store`）、官网（Vite 静态）。
- **功能 workmate 不需要的 → 直接省略。**
  包括：多语言 i18n、云同步、多 provider/会员/thinking 矩阵、MCP、subagents、SSR 常驻服务、移动端/Windows/Linux。

省略一个*功能*没问题；重造一个已有成熟*机制*要避免——那等于放弃成熟方案去试错。

> 开发期参考的具体代码来源索引在本地文件 `.local/dev-reference.md`（**已 gitignore，不入库**）——本地实现/排错时查它；公开仓库的 `docs/` 只保留 workmate 自己的契约与规格，不内联第三方实现代码。

## 全局边界（非目标，勿做）

- 仅单机单用户；不做多人/团队协作、账号体系、云端存储。
- 仅 macOS；不做 Windows/Linux/移动端。
- 提醒事项**只写不读**（单向），不读回勾选状态、不做双向同步。
- 不引入 LangChain。Agent 用 OpenAI Agents SDK（`@openai/agents-core`）+ Vercel AI SDK（`ai`/`@ai-sdk/openai-compatible`）——纯 tool-calling、不写规则硬解析。
- 不做历史多周复杂报表/数据分析。
- 不引入 monorepo（pnpm **workspace** / turbo）；workmate 是单仓多目录、各目录独立安装的普通项目。包管理器用 **pnpm**（`packageManager` 锁 `pnpm@9.12.2`；`app/`、`website/` 各自独立 `pnpm install`，**不建 workspace、无 `packages:` 清单**）。

## 硬约束（强制，违反即返工）

1. **绝不硬编码任何密钥**。`apiKey` 由用户在设置页填写并落本地。baseURL 默认内置百度 OneAPI，但可改。本项目会开源，须保持通用。
2. **无 key 自动降级到 mock 模型**（基于 AI SDK `MockLanguageModelV3`），使 UI 与单测均可跑通（不依赖外网）。
3. **`ProgressEvent` 进度流是周报的唯一原料**：每一次录入/归因都必须落一条事件。周报只读这一周的 `events`。
4. **`weekOf` 以周一为锚**：跨周自动新建 `WeeklyPlan`；"当前周"= `weekOf` 等于本周周一。
5. **`reminderId` 用于幂等**：已有 `reminderId` 的 task 不重复写入提醒事项。
6. **agent 循环上限 8 轮**（agents-core `run(..., { maxTurns: 8 })`）兜底；可选 doom-loop 同参去重。
7. **进程职责严格分离**：渲染进程只管 UI/输入；LLM/文件/提醒事项等"重"能力全在主进程，经 IPC 调用。渲染进程不得直接访问 Node API。
8. **可测性**：模型（用 `MockLanguageModelV3` / 直接测 tool.execute）与 `ReminderBridge` 都必须可被 mock，使 Agent 逻辑在无外网、无 macOS 权限时也能跑单测。
9. **提醒事项写入用 `execFile('osascript', [...])` 传参**，绝不把用户文本拼进脚本字符串（防注入）。

## 协作规则

- 对话语言跟随用户（中文）。开发面向的文档/注释用中文。
- **面向用户的文案、错误消息、UI 文本统一用中文**（本产品受众是中文用户）；代码标识符、commit message 用英文。
- Git commit message 用英文 Conventional Commits（`type(scope): ...`）。
- **设计系统（强制）**：任何 UI 变更先读 `docs/reference/design-system.md`，遵循 macOS 原生质感规范（冷灰调、圆润、克制阴影、丝滑动效）。
- 三思而后行：优先复用已有接口/类型/工具函数；根因修复优先，禁止打补丁。
- 无向后兼容包袱：直接重构到最佳实践，不保留废弃代码/注释。
- AI agent 未经用户明确授权不得执行 `git commit` / `git push` / `git tag`。

## 技术栈速查（已锁定，见 `docs/reference/project-structure.md`）

| 维度 | 选型 |
|------|------|
| 桌面框架 | Electron 31 + electron-vite 2 + electron-builder 26 |
| 前端 | React 19 + TypeScript 5.9 + Vite 5 + `@vitejs/plugin-react-swc` |
| 样式 | Tailwind v4（CSS-first）+ shadcn(`radix-lyra`) + lucide-react |
| 状态 | Zustand 5 + 函数式 API client（不用 Context 管业务态） |
| 校验 | Zod 4（DTO/tool 入参/config 均 `z.infer<>`） |
| LLM/Agent | `@openai/agents-core` + Vercel AI SDK（`ai` + `@ai-sdk/openai-compatible`）；无 key 用 `MockLanguageModelV3` |
| 存储 | `electron-store`（userData 下单 JSON 文件 + 原子写） |
| 提醒事项 | `osascript`（AppleScript）单向写入 |
| 官网 | Vite + React + Tailwind v4，出纯静态 |

## 文档路由（按任务选读）

| 任务 | 优先阅读 |
|------|----------|
| 文档总入口 / 导航 | `docs/index.md` |
| 产品需求、范围、数据模型、Agent 设计（真相源） | `docs/design/product-design.md` |
| 官网产品与内容 | `docs/design/website.md` |
| UI 变更、颜色/圆角/阴影/动效、组件约定 | `docs/reference/design-system.md` |
| 工程脚手架、目录结构、构建/打包配置、依赖版本 | `docs/reference/project-structure.md` |
| IPC 通道签名、preload、contextBridge | `docs/reference/ipc-contract.md` |
| Agent 运行时（agents-core+AI SDK）、模型构建、Tool（zod）、无 key mock | `docs/reference/agent-runtime.md` |
| system prompt、周报 prompt 与 markdown 结构、nudge 文案 | `docs/reference/prompts.md` |
| 提醒事项 osascript 桥、权限/Info.plist、降级 | `docs/reference/reminders-bridge.md` |
| 状态管理、命名、错误处理与降级、测试分级 | `docs/reference/engineering-standards.md` |
| 品牌色/Logo、app 图标管线、favicon | `docs/reference/branding.md` |
| 实现里程碑、验收标准、测试映射 | `docs/plan/milestones.md` |
| 一次性 goal 模式实现的任务拆分（执行清单） | `docs/plan/task-breakdown.md` |
| 演示剧本（脱敏的多轮对话脚本） | `docs/demo-script.md` |
| 实现期代码来源索引（**本地，不入库**） | `.local/dev-reference.md` |

## 命名约定（CLAUDE.md ↔ AGENTS.md）

- `CLAUDE.md` 是主文件（真实文件）。
- `AGENTS.md` 是指向 `CLAUDE.md` 的**符号链接**（`ln -s CLAUDE.md AGENTS.md`），用于兼容 agents.md 规范。
- 本仓库当前只在根目录维护一对 `CLAUDE.md` / `AGENTS.md`；目录文件数显著膨胀前不新增子级 `CLAUDE.md`。

## 文档维护协议（轻量）

- `CLAUDE.md` 只放稳定上下文；目录职责/结构/契约/约束失真时才更新。
- 各 `index.md` 只做导航（链接 + 一句话摘要），不写变更日志。
- `docs/plan/*` 是当前任务的工作区；实现采纳后把稳定事实回写到 `docs/design/*` 或 `docs/reference/*`，过程性计划删除/精简，不长期重复维护。
- 禁止在文档/注释里写日期、PR 编号、步骤进度等时间线日志——历史交给 git。
