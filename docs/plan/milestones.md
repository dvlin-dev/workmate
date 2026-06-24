# 实现里程碑

> 取代 `product-design.md` §11 作为**执行权威**（已对齐 agents-core + AI SDK / electron-store / TanStack Start 的修订栈）。原则：**先闭环（M1–M5，含周报 demo 高潮）后加分（M6–M8）**。每个里程碑后 `npm run build` + 跑对应单测。

| # | 里程碑 | 关键产出 | 验收（Done 即可演示/通过） | 测试 | 主参文档 |
|---|--------|----------|---------------------------|------|----------|
| **M1** | 脚手架 | `app/` Electron+electron-vite+TS+Tailwind v4；主/preload/renderer 三 bundle；globals.css + cn() + 拷入的 shadcn 组件；一个 `ping` IPC | `npm run dev` 起 1280×800 窗口，左右两栏空壳渲染，渲染层经 IPC 调主进程往返通；`npm run build` 通过 | build 通过 | project-structure.md、design-system.md |
| **M2** | Store + 数据模型 | `shared/types.ts`；`electron-store` Store：CRUD、`appendEvent`、`weekOf` 周一锚、当前周 `Snapshot`、跨周新建 `WeeklyPlan` | store 单测全绿：读写/跨周/快照/事件不变量/`reminderId` 幂等占位 | `store.test` (L2) | agent-runtime.md §1、product-design.md §5 |
| **M3** | 模型 + Agent + Tools（**核心闭环·上**） | `model.ts`（`createOpenAICompatible`+`aisdk`+无 key mock）；`tools.ts`（9 个 `tool()`+zod）；`agent.ts`（`new Agent`）；`orchestrator.ts`（`run(maxTurns:8)`）；system prompt | 无 key 下 `runTurn("这周要做完登录联调")` → 走 mock → 看板出现该目标；说"联调通了"→ `find_goal`+`update_progress` 改进度 | loop 测（`MockLanguageModelV3`）+ 各 `tool.execute` (L2) | agent-runtime.md、prompts.md |
| **M4** | UI 主界面 + 设置页（**核心闭环·下**） | preload/`register.ts`；renderer stores（snapshot/chat/config）；ChatPanel+KanbanPanel（GoalCard/Progress/TodayFocus）；SettingsDialog（baseURL/apiKey/model + 测试连接）；快照订阅刷新 | **说话 → 看板动**：输入框发消息，左侧出气泡 + 工具提示，右侧进度条实时跳；设置页填 key 后 `testProvider` 成功 | 组件/状态 (L1) | ipc-contract.md、design-system.md §8、engineering-standards.md §1 |
| **M5** | 周报生成（**demo 高潮**） | `report.ts`（原料组装 + `generateText` + 无 key 确定性降级）；`generate_report` tool + `report:generate` IPC；ReportDialog（react-markdown + 一键复制） | 点「一键生成周报」弹出四段式 markdown（完成/亮点/卡点/下周），可复制；无 key 也能出（降级模板） | 原料组装 + 降级模板 (L2) | prompts.md §2、agent-runtime.md §8 |
| **M6** | 提醒事项写入 | `reminders/bridge.ts`（osascript+argv）+ `mock.ts`；`write_reminder` tool；`reminders:write` IPC；Info.plist 用途说明 + entitlements | 带 deadline 的待办经 agent 写入「提醒事项」的 Workmate 列表；二次写入幂等；拒权时优雅降级引导 | 幂等单测（Mock） (L2) | reminders-bridge.md |
| **M7** | 主动推送 Nudge | `nudge/scheduler.ts`（定时 tick + `Notification`）：傍晚/停滞/周五三类，固定文案，一天一次 | 满足条件时弹系统通知；点击唤起窗口；频率克制 | 判定逻辑单测 (L1) | prompts.md §3、product-design.md §8 |
| **M8** | 官网（额外交付物） | `website/` TanStack Start（prerender 静态）：Hero/Problem/HowItWorks/Features/DownloadCTA/Footer；共用 token；SEO + JsonLd | `npm run build` 出静态；落地页完整、品牌一致、含下载 CTA | 构建通过 | design/website.md、project-structure.md §7、branding.md |

## 排期建议（约一天工时）

- **必须跑通**：M1→M5（最小闭环，到周报是 demo 高潮）。
- **MVP 补全**：M6（提醒事项）→ M7（Nudge，优先级最低，时间紧最后接）。
- **加分**：M8 官网，可在闭环稳定后并行或最后做；时间极紧时只做单屏 Hero+下载。

## 跨里程碑硬约束（每步都回看）

绝不硬编码密钥 · 无 key 自动 mock · 每次归因落 `ProgressEvent` · `weekOf` 周一锚 · `reminderId` 幂等 · `maxTurns:8` 兜底 · 进程职责分离 · 模型/Reminder 可 mock。详见根 `CLAUDE.md` 硬约束。
