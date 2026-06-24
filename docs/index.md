# Workmate 文档总入口

> 仅做导航。正文是唯一事实源。三层模型：**design = 要做什么（产品真相）**，**reference = 怎么做（实现真相）**，**plan = 怎么落地（执行清单）**。

## design — 产品真相源

| 文档 | 说明 |
|------|------|
| [design/product-design.md](./design/product-design.md) | 桌面端完整需求：背景/范围/技术选型/架构/数据模型/Agent/提醒事项/Nudge/配置/UI（已与负责人逐节确认） |
| [design/website.md](./design/website.md) | 官网的产品定位、信息架构与落地页内容 |

## reference — 实现真相源（契约）

| 文档 | 说明 |
|------|------|
| [reference/design-system.md](./reference/design-system.md) | Token 取值（颜色/圆角/阴影/动效）+ macOS 质感规范 + 组件约定 |
| [reference/project-structure.md](./reference/project-structure.md) | 目录结构、依赖版本、`electron.vite.config`、`electron-builder.yml`、tsconfig、官网脚手架 |
| [reference/ipc-contract.md](./reference/ipc-contract.md) | `WorkmateApi` 接口、全部 IPC 通道签名、preload/contextBridge、结果信封 |
| [reference/agent-runtime.md](./reference/agent-runtime.md) | agents-core + AI SDK 运行时、模型构建、各 Tool（zod `tool()`）、`run(maxTurns:8)`、无 key mock |
| [reference/prompts.md](./reference/prompts.md) | system prompt 完整草稿、周报 prompt 模板与 markdown 结构、nudge 文案模板 |
| [reference/reminders-bridge.md](./reference/reminders-bridge.md) | 提醒事项 osascript 桥接、AppleScript、Info.plist/权限、幂等、降级 |
| [reference/engineering-standards.md](./reference/engineering-standards.md) | Zustand+函数式 API、命名、错误处理与降级表、Zod、测试分级 |
| [reference/branding.md](./reference/branding.md) | 品牌名/色/Logo、macOS app 图标管线（iconutil）、favicon/manifest |

## plan — 执行清单

| 文档 | 说明 |
|------|------|
| [plan/milestones.md](./plan/milestones.md) | 8 个里程碑 + 验收标准 + 测试映射（先闭环后加分） |
| [plan/task-breakdown.md](./plan/task-breakdown.md) | 面向 goal 模式一次性实现的有序任务清单（含 DoD） |

## 其它

| 文档 | 说明 |
|------|------|
| [demo-script.md](./demo-script.md) | 演示剧本（脱敏的软件工程师一周，多轮对话 + 人机协作 + 周报） |

## 阅读顺序建议

1. 先读 `design/product-design.md` 建立全局认知。
2. 实现某一块时，按根 `CLAUDE.md` 的「文档路由」跳到对应 `reference/*`。
3. 排期与执行看 `plan/*`。
