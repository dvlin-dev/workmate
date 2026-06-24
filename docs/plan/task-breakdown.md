# 任务拆分（goal 模式执行清单）

> 面向"一次性把需求做完"的有序任务。逐条推进，每条带 DoD 与参文档。打勾即过。栈已锁定（见根 `CLAUDE.md`）。**遇文档未覆盖的细节，按既定原则合理决策并就地记录，不反复确认。**

## M1 · 脚手架

- [x] **T1.1** 建 `app/`：`package.json`、`electron.vite.config.ts`、`tsconfig.json`+`tsconfig.node.json`、`vitest.config.ts`、`components.json`、`electron-builder.yml`、`build/entitlements.mac.plist`。`npm install` 通过（724 包）。栈用 `@tailwindcss/vite` 插件（无 postcss.config）。
- [x] **T1.2** 主进程 `src/main/index.ts` + `window.ts`：`createMainWindow`（1280×800、min 960×600、`titleBarStyle:'hiddenInset'`、contextIsolation/sandbox/!nodeIntegration）、生命周期、packaged-vs-`ELECTRON_RENDERER_URL`、`__dirname` 解析 preload/renderer（electron-vite 自动 shim）。
- [x] **T1.3** `src/shared/{ipc,types,config}.ts`（`WorkmateApi`/`CH`/`AppResult`/数据模型/`AppConfig` zod）+ `src/preload/index.ts`（`exposeInMainWorld('workmateAPI', api)`，事件通道返回退订）。ping/snapshot:get 占位已通。
- [x] **T1.4** 渲染层骨架：`index.html`、`main.tsx`（含 `<Toaster/>`）、`App.tsx`（左右两栏空壳 + hiddenInset 拖拽区 + ping 状态）、`styles/globals.css`（基于 `index.css` 去 streamdown + window-drag + `--brand`）、`lib/utils.ts`（`cn()`）。
- [x] **T1.5** 拷入 17 个基础组件到 `components/ui/`（button/card/progress/badge/dialog/input/textarea/label/select/scroll-area/separator/skeleton/tooltip/switch/tabs/avatar/sonner），仅把 `cn` import 改 `../../lib/utils`，sonner 默认 theme 固定 `light`。token 开箱即用。
- [x] **DoD**：`npm run build` 通过（main/preload/renderer 三 bundle）、`npm run typecheck` 全绿。（`npm run dev` 起 GUI 窗口需真机，构建已验证打包链路。）

## M2 · Store + 数据模型

- [x] **T2.1** `src/shared/types.ts`（数据模型 + `Snapshot`/`ToolTraceItem`）+ `src/shared/config.ts`（`AppConfig` zod schema + `z.infer`）。数据模型用 interface（存储 schema），`AppConfig` 用 zod 派生。
- [x] **T2.2** `src/main/store.ts`：`WorkmateStore` 持内存 `WorkmateData{version,weeks,config}`，注入 `persist`/`now`（可测，不依赖 electron）；`weekOf`（周一锚，本地时区）、`getCurrentWeek`（无则建）、`getSnapshot`（goals+todayFocus）、`createGoal/addTask/updateProgress/completeTask/findGoals/appendEvent/getTask/setReminderId/getWeek`、`save`。`createGoal/updateProgress/completeTask` 内部 `pushEvent`（add_task 不落事件）。运行时包装在 `src/main/persistence.ts`（electron-store 单文件 `workmate-data.json`，含 weeks+config，`clearInvalidConfig:true`）。
- [x] **T2.3** `src/main/config.ts`：纯函数 `deepMerge` + `applyConfigPatch`（深合并 + zod 校验）；config 由 Store 拥有（`getConfig/setConfig`），不另起 electron-store。默认值在 `shared/config.ts`。
- [x] **T2.4** 单测 `test/store.test.ts`（13 例）：weekOf 周一锚、CRUD、`appendEvent` 不变量、todayFocus、跨周新建、`setReminderId` 幂等、config 深合并。
- [x] **DoD**：store 13 测全绿；`npm run build` + `typecheck` 通过。

## M3 · 模型 + Agent + Tools（核心闭环·上）

- [x] **T3.1** `src/main/agent/model.ts`：`buildModel(config)` 有 key→`aisdk(createOpenAICompatible({name,apiKey,baseURL})(model))`；无 key→`aisdk(createMockChatModel())`。Mock（`mock-model.ts`）用 `MockLanguageModelV3`（`ai/test`）按 prompt 状态驱动闭环（计划→create_goal；进展→find_goal→update_progress；周报→generate_report；tool 结果回来→收尾文案）+ `createScriptedModel` 供测试。
- [x] **T3.2** `src/main/agent/tools.ts`：`createWorkmateTools()` 9 个 `tool()`+zod；`execute(input, rc)` 经 `rc.context`（`AgentContext`）用 Store/Reminder/Report 并 `trace.push`。端口 `AgentContext`/`ReminderBridge`/`ReportService`/`ReminderPermissionError` 定义在 `agent/context.ts`。`write_reminder` 失败不抛、返回 `{error,needsPermission}`。
- [x] **T3.3** `src/main/agent/prompt.ts`：`buildSystemPrompt(snapshot)`（注入 today/weekday/weekOf/snapshotJson）。
- [x] **T3.4** `src/main/agent/{agent,orchestrator}.ts`：`buildAgent(config,snapshot)` + `runTurn(text,deps)` = 落 note 原始事件 → `run(agent,[user(text)],{maxTurns:8,context})` → `{reply:result.finalOutput, snapshot, toolTrace}`。
- [x] **T3.5** 单测：`agent-loop.test.ts`（4 例，heuristic mock 经真实 agents-core 端到端跑闭环）+ `tools.test.ts`（6 例，`tool.invoke` 覆盖全部工具含 write_reminder 权限拒绝）+ `reminders/mock.ts`。`store.findGoals` 改宽松 2-gram 匹配以适配中文口语 query。
- [x] **DoD**：无 key 下 `runTurn` 建目标/归因改 Store ✓；23 测试全绿；typecheck + build 通过。**安装坑**：见 project-structure.md §3 的 `overrides`。

## M4 · UI 主界面 + 设置页（核心闭环·下）

- [x] **T4.1** `src/main/ipc/{register,shared}.ts`：`registerIpc(deps)` 注册 `app:ping`/`agent:sendMessage`（`runTurn` + `broadcast(snapshot:changed)` + 错误转 LLM_TIMEOUT/LLM_ERROR）/`snapshot:get`/`report:generate`/`config:get|set|testProvider`/`reminders:write`（权限→REMINDER_PERMISSION_DENIED）。`index.ts` 构建 store/report/reminders 并 `registerIpc`。
- [x] **T4.2** `lib/api.ts`（函数式 + `unwrap` + `ApiError(code)`）+ stores：`useSnapshotStore`（hydrate+subscribe，原子 selector）、`useChatStore`（乐观气泡 + pending + 错误降级文案）、`useConfigStore`。
- [x] **T4.3** 左栏 `components/chat/`：`ChatPanel`（ScrollArea + Textarea + ⌘/Ctrl+Enter + 自动滚底 + 空态）、`MessageBubble`（用户/搭子气泡自写两个 div，搭子用 `ui/markdown.tsx`=react-markdown+remark-gfm 组件覆盖样式）、`ToolHint`（~20 行 map toolTrace）。**自写聊天输入**（不引入复杂的附件管线，design-system §7 准许自写）。
- [x] **T4.4** 右栏 `components/kanban/`：`KanbanPanel`（订阅 snapshot 实时刷新）/`GoalCard`（Card+Progress[指示器改 `bg-success`]+`StatusBadge`）/`TodayFocus`/`ReportButton`（`report/ReportDialog.tsx`）。
- [x] **T4.5** `components/settings/SettingsDialog.tsx`：baseURL/apiKey/model + 内联三态 **测试连接** 按钮（Loader/CircleCheck/CircleX，走 `config:testProvider`）+ Nudge 开关 + 首启无 key 引导/横幅。**自实现轻量表单**（受控 state，不引入 RHF+model-bank；故移除未用的 `react-hook-form`/`@hookform/resolvers`）。
- [x] **DoD**：IPC 全链路打通、`runTurn`→广播→看板订阅刷新；typecheck + build + 23 测试通过。（GUI「说话→看板动」需真机运行 `npm run dev`，逻辑链路已验证。）

## M5 · 周报生成（demo 高潮）

- [x] **T5.1** `src/main/report.ts`（落点为 `main/report.ts`，非 `agent/`）：`createReportService(store).generate(weekOf?)` 组装 material（goals+tasks+events+goalTitle）→ 有 key `generateText`（report prompt）；无 key/失败/超时 → `deterministicReport` 四段降级。`buildRawModel` 加到 `agent/model.ts`。
- [x] **T5.2** `generate_report` tool（M3）+ `report:generate` IPC（M4）已接。
- [x] **T5.3** `components/report/ReportDialog.tsx`（`ReportButton` 内含 Dialog）：`ui/markdown.tsx` 渲染 + 一键复制（sonner toast）。
- [x] **T5.4** 单测 `test/report.test.ts`（3 例）：四段齐全、完成/亮点/卡点/下周分段正确、空数据不崩。卡点判定只算 `progress_update`/`task_done`（goal_created 不算推进）。
- [x] **DoD**：无 key 出四段式 markdown ✓、可复制；26 测试全绿、typecheck + build 通过。

## M6 · 提醒事项写入

- [x] **T6.1** `src/main/reminders/bridge.ts`（`OsascriptReminderBridge`：`execFile('osascript',['-e',SCRIPT,...argv])`，常量脚本 + argv 传 title/due 防注入；列表 "Workmate" 不存在则建；due 拆分量、先 `set day to 1` 防溢出；10s 超时；`-1743`/not authorized → `ReminderPermissionError`）+ `mock.ts`。`index.ts` 按 `process.platform==='darwin'` 选择。
- [x] **T6.2** `electron-builder.yml` `extendInfo`（两条用途说明）+ `build/entitlements.mac.plist`（apple-events）——M1 已就位。
- [x] **T6.3** `write_reminder` tool（M3，不抛错返回 `{error,needsPermission}`）+ `reminders:write` IPC（M4，映射 `REMINDER_PERMISSION_DENIED`/`REMINDER_FAILED`）。
- [x] **T6.4** 单测 `test/reminders.test.ts`（3 例）：幂等只创建一次、已存 reminderId 直返、task 不存在抛错。
- [x] **DoD**：幂等 + 拒权降级路径已测；29 测试全绿、typecheck + build 通过。（真机写入需打包产物触发 TCC 授权。）

## M7 · 主动推送 Nudge

- [x] **T7.1** `src/main/nudge/`：纯判定 `decide.ts`（`pickNudge`，优先级 friday>stall>evening，一天一次）+ `scheduler.ts`（electron 定时器 30min tick + `Notification` + 点击唤起窗口 + 广播 `nudge:notify`）。**判定与 electron I/O 分文件**（否则测试导入 scheduler 会拉起 electron 二进制失败）。`index.ts` `startNudgeScheduler(store)`。
- [x] **T7.2** 设置页 nudge 开关（M4 已含）；单测 `test/nudge.test.ts`（7 例）：friday/stall/evening 判定 + 节流 + 无 active 目标/今日已有事件不打扰。
- [x] **DoD**：判定逻辑全测、`nudge.enabled` 可关、频率克制；36 测试全绿、typecheck + build 通过。

## M8 · 官网（额外交付物）

- [x] **T8.1** `website/` 脚手架：**改用 Vite + React 静态**（非 TanStack Start——单页静态站不需要 SSR/路由/nitro，避免 nitro-nightly 与 routeTree 的构建脆弱性；详见下方决策说明）。`globals.css` 复用同一套 token + 紫罗兰 `--brand` + scroll-reveal 段；`lib/utils.ts` 的 `cn()`。`vite build` 出 `dist/` 纯静态。
- [x] **T8.2** **复用滚动入场动画**：`hooks/useScrollReveal.ts`（含 group 版）+ scroll-reveal CSS。SEO 改为 `index.html` 内联 meta + JsonLd（单页静态最稳，等价复用 seo.ts 的 meta 形状），不引入 `lib/seo.ts`/`__root.tsx`（TanStack 专属）。
- [x] **T8.3** landing 段落（`src/sections/`）：Hero（渐变标题 + CTA + CSS 拟真两栏 App 预览）、Problem（痛点三连）、HowItWorks（三步）、Features（4 卡）、DownloadCTA、Footer，采用经典 landing 结构、内容换中文（website.md §2–3）。`useScrollReveal(Group)` 驱动入场。
- [x] **T8.4** 品牌资产：`favicon.svg`/`logo.svg`（紫罗兰渐变 W）、`manifest.json`（`theme_color #7C5CFC`）。`.icns` 图标管线属 App 打包（branding.md §3，收尾随 dmg）；`og-image.png`（1200×630 位图）留待补（meta 已引用路径）。
- [x] **DoD**：`npm run build` 出 `dist/` 静态（index.html + css + js）✓、typecheck 通过；落地页完整、品牌一致、含下载 CTA。

> **决策说明（官网栈偏离 docs 的 TanStack Start）**：docs 原选 TanStack Start 作为工程范式。但 workmate 官网是**单页静态营销站**——TanStack Start 的 SSR/文件路由/nitro（需绕开 SSR React 重复实例化、且要 pin nitro-nightly）对单页零收益、徒增构建脆弱性。改用 Vite+React 静态：**设计实质全部复用同一套范式**（token 体系、`useScrollReveal`、scroll-reveal CSS、品牌渐变、SEO meta、landing 结构/内容），只换掉对单页无意义的框架外壳，契合「省略用不到的功能」原则，且 `vite build` 可靠出静态。如需严格对齐可后续平移到 TanStack Start。

## 收尾

- [x] **T9.1** `README.md`：配置 LLM（含 OneAPI token 地址）、授权提醒事项、`cd app && npm install && npm run dev`、`npm test`/`npm run dist:mac`、官网启动。
- [x] **T9.2** 全量验证通过：App `typecheck` + 36 测试 + `build` 三 bundle ✓；Website `typecheck` + `build` 静态 ✓。各里程碑已逐条回写偏差到 design/reference。
- [~] **多 Agent 深度 review 循环**（进行中）：
  - **Round 1**：9 模块各 1 review agent + 逐条对抗式核验 → 35 条确认（0 high / 14 medium / 21 low）。已修全部 medium + 多数 low：主对话 `run()` 加超时信号 + `MaxTurnsExceededError` 降级 + IPC 失败补发快照（LLM_TIMEOUT 契约不再死代码）；`config:testProvider` 改无状态入参（测试不再强制落盘）；`findGoals` 去 2-gram 误命中 + mock 清洗 query；窗口加外链导航 guard；设置页测试/保存解耦 + null 守卫 + timer 清理；config schema 拒空 baseURL/model；持久化 zod 校验（语义损坏重置）；提醒事项纯日期 due 本地化 + in-flight 去重 + 权限判定扩面；nudge 节流持久化 + 启动即评估 + 通知点击 restore/focus；周报弹窗错误态 + 请求序号 + 剪贴板守卫；聊天 sticky-bottom + reduced-motion + a11y。新增 `test/hardening.test.ts`，**43 测试全绿** + typecheck + build。
  - 已记录暂缓的纯外部依赖项（og-image 位图、canonical/og:url 需正式域名、favicon.ico）。
  - **Round 2**：已按用户要求停止。收敛状态：Round 1 全部 medium + 多数 low 已修并验证（App 43 测试 + typecheck + build 绿；官网 typecheck + build 绿）。剩余仅暂缓的外部依赖项（域名/位图资产）与个别低优先纯净度项。
