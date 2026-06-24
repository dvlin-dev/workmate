# Workmate（工作搭子）设计文档

> 状态：设计已确认（与产品负责人逐节通过），是**桌面端产品的唯一真相源**。
> 本文聚焦"要做什么"。实现层"怎么做"的精确契约见 `docs/reference/*`：
> - 精确 IPC 通道签名 → [`reference/ipc-contract.md`](../reference/ipc-contract.md)
> - 各 Tool 的 JSON Schema、Provider 接口、loop 规格 → [`reference/agent-runtime.md`](../reference/agent-runtime.md)
> - system prompt / 周报 prompt 完整文案 → [`reference/prompts.md`](../reference/prompts.md)
> - 提醒事项 osascript 桥与权限/降级 → [`reference/reminders-bridge.md`](../reference/reminders-bridge.md)
> - 设计 token / 组件约定 → [`reference/design-system.md`](../reference/design-system.md)
> - 目录结构与构建配置 → [`reference/project-structure.md`](../reference/project-structure.md)

---

## 1. 背景与目标

### 1.1 背景
个人在一周/一天的工作中，往往有清晰的目标，但缺少一个低摩擦的工具把"计划 → 执行 → 复盘"串成闭环：

- 计划散落在脑子里、便利贴、各种文档里，不结构化；
- 干活过程中的进展没有被持续记录，到周五写周报时全靠回忆；
- 普通 todo / 看板软件需要手动维护，录入成本高，很快就荒废。

我们要做的不是"又一个 todo list"，而是一个 **AI-native 的工作搭子**：用户用自然语言随手说，agent 负责把它结构化、归因、提醒、复盘。结构化看板是 agent 替用户维护的**产物**，而非用户手动拖拽的对象——这是它与普通效率软件的根本区别。

### 1.2 目标（一句话需求）
一个 macOS 桌面"工作搭子"。用户用自然语言随手录入本周/当天的计划和进展，agent 通过一组目标管理 tool 把它结构化成"周目标树"，右侧看板实时反映；干活途中继续口语化同步进度，agent 负责归因到对应目标；拆出来的待办单向写入 macOS 提醒事项做系统提醒；周五一键生成叙事性周报。

### 1.3 设计原则
- **AI-native**：纯 tool-calling loop，agent 自主决策调哪些 tool，不写规则硬解析。
- **低摩擦**：唯一的输入方式是"说话"，看板自动生成。
- **闭环**：录入 → 归因 → 提醒 → 周报，每一步的数据都为下一步服务。
- **主动**：搭子会在合适时机主动推送，而非被动等待。
- **通用可开源**：LLM provider 层抽象，默认内置OpenAI 兼容服务，换 baseURL 即可接入其他兼容服务。绝不硬编码任何密钥。

---

## 2. 范围

### 2.1 MVP 范围（本次必做）
1. **目标录入 + 进度归因**（核心闭环）：自然语言录入周/日目标，agent 结构化成目标树；干活时口语化同步进展，agent 归因到对应目标并更新进度。
2. **一键生成周报**：基于一周进度流，生成叙事性周报（完成 / 亮点 / 卡点 / 下周计划），markdown 格式，一键复制。
3. **写入 macOS 提醒事项**：agent 拆出的待办（含可选 deadline）单向写入"提醒事项"App，由系统负责提醒。
4. **搭子主动推送**：长时间无进展或傍晚时，搭子主动发系统通知关心一句。

### 2.2 非目标（本次明确不做）
- 不做多人 / 团队协作，仅单机单用户。
- 不做双向同步提醒事项（不读回勾选状态），仅单向写入。
- 不做云端存储 / 账号体系，数据全部本地。
- 不做移动端 / Windows / Linux，仅 macOS。
- 不引入 LangChain 等重型 agent 框架。
- 不做历史多周的复杂报表 / 数据分析。

---

## 3. 技术选型

| 维度 | 选型 | 理由 |
|------|------|------|
| 桌面框架 | **Electron + React** | agent 逻辑集中在 Node 主进程，纯 npm 生态、无需 Rust 工具链，一天工时落地最快 |
| 前端 | React + TypeScript + Vite | 团队熟悉，组件化清晰 |
| Agent 编排 | **纯 tool-calling loop** | 最 AI-native，归因最准，无需规则硬解析 |
| LLM 协议 | **OpenAI 兼容 chat completions（带 function calling）** | 生态通用，便于开源后替换 provider |
| 默认 provider | OpenAI 兼容服务（内置 baseURL，key 用户自填） | 内网可用、现场不依赖外网 |
| 本地存储 | **本地 JSON 文件**（Electron `userData` 目录） | 单人一周数据量极小，无需 SQLite |
| 提醒事项集成 | **osascript（AppleScript）单向写入** | macOS 原生、无需额外依赖 |

---

## 4. 整体架构

Electron 双进程，职责严格分离：

```
渲染进程 (React)                    主进程 (Node)
┌─────────────────────┐           ┌──────────────────────────┐
│ 左：搭子对话         │  IPC      │ Agent 编排器 (tool loop)  │
│ 右：周目标看板       │ <───────> │  ├─ LLM Provider (可配置) │
│ 便利贴自由输入框     │           │  ├─ Tools (目标/进度/报告)│
└─────────────────────┘           │  ├─ Store (本地 JSON)     │
                                   │  ├─ ReminderBridge        │
                                   │  │    (osascript 写入)    │
                                   │  └─ Nudge 定时器 (主动推送)│
                                   └──────────────────────────┘
```

- **渲染进程（React）**：只负责展示与输入，不直接访问 LLM / 文件系统 / 提醒事项。所有能力经 IPC 调用主进程。
- **主进程（Node）**：承载全部"重"能力——Agent 编排、LLM 调用、Tool 执行、本地存储、提醒事项桥接、主动推送定时器。

### 4.1 模块清单与职责

| 模块 | 位置 | 职责 | 依赖 |
|------|------|------|------|
| `AgentOrchestrator` | 主进程 | 接收用户消息 + 目标快照，跑 tool-calling loop，产出回复 | LLM Provider、Tools、Store |
| `LLMProvider` | 主进程 | 封装 `chat(messages, tools)`，走 OpenAI 兼容协议；提供显式测试 mock | 无（仅 HTTP） |
| `Tools` | 主进程 | 一组目标管理函数，供 agent 调用（见第 6 节） | Store、ReminderBridge |
| `Store` | 主进程 | 读写本地 JSON，提供目标/事件的 CRUD 与"当前周快照" | 文件系统 |
| `ReminderBridge` | 主进程 | 通过 osascript 写入提醒事项，回填 reminderId 做幂等 | osascript |
| `NudgeScheduler` | 主进程 | 定时检查进度状态，必要时触发系统通知 | Store、AgentOrchestrator |
| `IPC 层` | 主进程↔渲染 | 暴露 `sendMessage`、`getSnapshot`、`generateReport`、`getConfig/setConfig` 等通道 | 上述模块 |
| UI 组件 | 渲染进程 | 对话区、看板区、输入框、设置页、周报弹窗 | IPC |

**隔离原则**：每个模块单一职责、通过明确接口通信、可独立测试。LLM Provider 与 ReminderBridge 都要能被 mock，使得 Agent 逻辑在无外网、无 macOS 权限时也能跑单测。

---

## 5. 数据模型

存储为单个 JSON 文件，路径 `app.getPath('userData')/workmate-data.json`。结构如下（TypeScript 类型描述）：

```typescript
interface WorkmateData {
  version: number;              // schema 版本，便于后续迁移
  weeks: WeeklyPlan[];          // 按周存放，通常只关心当前周
  config: AppConfig;            // 见第 9 节
}

interface WeeklyPlan {
  weekOf: string;               // 该周周一日期 "YYYY-MM-DD"，唯一标识一周
  goals: Goal[];
  events: ProgressEvent[];      // 该周的进度流
}

interface Goal {
  id: string;                   // uuid
  title: string;
  status: 'active' | 'done';
  progress: number;             // 0–100，由 agent 归因更新
  tasks: Task[];
  createdAt: string;            // ISO 时间
}

interface Task {
  id: string;                   // uuid
  title: string;
  done: boolean;
  due?: string;                 // 可选 ISO 截止时间
  reminderId?: string;          // 写入提醒事项后回填，用于幂等去重
}

// 进度流：所有输入与归因都进这条流，是周报的唯一原料
interface ProgressEvent {
  id: string;                   // uuid
  timestamp: string;            // ISO 时间
  rawText: string;              // 用户原话（便利贴或对话）
  kind: 'note' | 'progress_update' | 'goal_created' | 'task_done';
  relatedGoalId?: string;       // 归因到的目标
  summary: string;              // agent 归一化后的简述，供周报使用
}
```

### 5.1 关键决策
- **便利贴与对话是同一输入入口的两种皮肤**：两者都写入 `ProgressEvent.rawText`，再交给 agent 解析。便利贴形式更自由随手，对话形式更交互，但底层是同一条进度流。
- **进度流（`ProgressEvent`）是周报的唯一原料**：每一次归因、每一条录入都要落一条事件。周报生成时只读这一周的 `events`，不依赖任何外部状态。
- **`weekOf` 以周一为锚**：跨周时自动新建 `WeeklyPlan`。"当前周"= `weekOf` 等于本周周一的那一份。
- **`reminderId` 用于幂等**：同一个 task 重复写入提醒事项时，凭 `reminderId` 判断是否已存在，避免重复创建。

---

## 6. Agent 设计

### 6.1 编排方式：纯 tool-calling loop

每次用户发消息时，编排器执行如下循环：

```
1. 组装 messages：
   - system prompt（搭子人设 + 当前日期/周信息 + 行为准则）
   - 当前周目标快照（结构化 JSON，作为 context 注入）
   - 历史对话（本会话）
   - 用户最新消息
2. 调 LLM.chat(messages, tools)
3. 若 LLM 返回 tool_calls：
   - 依次执行每个 tool，得到结果
   - 把 tool 结果作为 tool message 追加进 messages
   - 回到第 2 步（继续循环）
4. 若 LLM 返回普通文本：作为搭子回复返回给渲染进程，循环结束
5. 循环设上限（如 8 轮）防止失控
```

每轮 loop 结束后，主进程把最新目标快照通过 IPC 推给渲染进程，右侧看板实时刷新。

### 6.2 System Prompt 要点
- 人设：一个简洁、主动、靠谱的"工作搭子"，目标是帮用户追踪并达成目标。
- 注入当前日期、本周周一日期、今天星期几。
- 行为准则：
  - 用户说计划/目标 → 调 `create_goal` / `add_task` 结构化。
  - 用户说进展（"联调通了""文档写完了"）→ 调 `find_goal` 定位 + `update_progress` 归因，并 `log_event` 落进度流。
  - 拆出的待办若带时间或值得提醒 → 调 `write_reminder`。
  - 归因不确定时，先反问一句再落库，不要乱归因。
  - 回复简短口语化，避免长篇大论。

### 6.3 Tool 集合

| Tool | 入参 | 作用 | 备注 |
|------|------|------|------|
| `create_goal` | `title` | 新建周目标 | 返回 goalId |
| `add_task` | `goalId, title, due?` | 给目标加待办 | |
| `update_progress` | `goalId, progress, note` | 更新目标进度并记一条进度事件 | progress 0–100 |
| `complete_task` | `taskId` | 标记待办完成 | 同时落 `task_done` 事件 |
| `find_goal` | `query` | 按语义/关键词找最匹配的目标 | 供归因前定位；找不到返回空让 agent 反问 |
| `log_event` | `rawText, kind, summary, relatedGoalId?` | 往进度流写一条事件 | 所有录入/归因都应落事件 |
| `write_reminder` | `taskId` | 把指定 task 写入 macOS 提醒事项 | 经 ReminderBridge；回填 reminderId |
| `generate_report` | `weekOf?` | 基于该周进度流生成叙事性周报 | 默认当前周；见 6.5 |
| `get_snapshot` | — | 返回当前周目标树 + 今日聚焦 | 供 agent 自查上下文 |

> 实现 agent 可在不偏离职责的前提下微调 tool 粒度（如把 `log_event` 合进其他 tool 的副作用），但必须保证"每次归因都落一条 ProgressEvent"这一不变量。

### 6.4 一次对话的完整数据流（示例）

```
用户在输入框说："登录联调跟前端搞通了"
  → 渲染进程 IPC.sendMessage(text)
  → 主进程 AgentOrchestrator 收到
  → 组装 messages（含当前目标快照：有个"登录联调"目标 active 30%）
  → LLM 返回 tool_calls:
       find_goal("登录联调") → 命中 goal#1
       update_progress(goal#1, 60, "前端联调打通") → 写库 + 落 progress_update 事件
  → tool 结果回灌 LLM
  → LLM 返回文本："搞定 👍 登录联调更新到 60% 了，剩下就差异常态了吧？"
  → 主进程把文本 + 最新快照 IPC 推回渲染进程
  → 左侧显示回复，右侧看板"登录联调"进度条跳到 60%
```

### 6.5 周报生成
- 触发：用户点"一键生成周报"按钮，或对话里说"生成周报"。
- 实现：读取当前周（或指定 `weekOf`）的全部 `events` 与 `goals`，交给 LLM 用固定结构生成 markdown：
  - **本周完成**：已完成目标 / 待办，结合事件 summary 叙述。
  - **进展亮点**：进度推进明显的目标。
  - **风险与卡点**：长期无进展或显式提到受阻的目标。
  - **下周计划**：未完成的目标 / 待办，简要展望。
- 输出 markdown，渲染进程弹窗展示，提供"一键复制"。

---

## 7. macOS 提醒事项集成

### 7.1 方式：单向写入
通过 `osascript` 执行 AppleScript 把 task 写入"提醒事项"App。**只写不读**，不读回勾选状态。

写入脚本逻辑（示意）：
```applescript
tell application "Reminders"
  set newReminder to make new reminder with properties {name:"<task.title>", due date:<task.due>}
  -- 可指定到某个列表，如 "Workmate"
  return id of newReminder
end tell
```

### 7.2 要点
- **列表归集**：写入到一个固定列表（如 "Workmate"），若不存在则先创建，避免污染用户默认列表。
- **幂等**：写入成功后把返回的 reminder id 存进 `Task.reminderId`；同一 task 再次请求写入时，若已有 `reminderId` 则跳过。
- **权限**：首次写入会触发 macOS 自动化权限弹窗（允许控制"提醒事项"）。文档需提示用户授权；ReminderBridge 对权限失败要优雅降级（提示用户而非崩溃）。
- **due 缺省**：task 无 due 时创建无截止日期的提醒。

### 7.3 桥接接口
```typescript
interface ReminderBridge {
  // 返回 reminderId；失败抛错并附人类可读原因
  writeReminder(task: { title: string; due?: string }): Promise<string>;
}
// 提供 MockReminderBridge：返回假 id，供非 macOS / 无权限环境单测
```

---

## 8. 主动推送（Nudge）

`NudgeScheduler` 在主进程用定时器（如每 30 分钟 tick 一次）做轻量检查：

- **傍晚提醒**（如 18:00 前后）：若今天有 active 目标但进度流无今日事件 → 触发系统通知："今天还没记录进展，有什么要同步的吗？"
- **停滞提醒**：某 active 目标超过 N 小时（如工作时段内 4 小时）无相关事件 → 通知关心一句。
- **周五周报提醒**（周五下午）：提示"该生成本周周报啦"。

实现要点：
- 用 Electron `Notification` API 发系统通知，点击可唤起主窗口。
- 推送频率要克制，同一类提醒一天最多一次，避免打扰。
- 判断逻辑读 Store 的进度流即可，无需调 LLM（保持轻量、省 token）；通知文案可走固定模板。
- 属于 MVP，但优先级最低；现场时间不足时在核心闭环跑通后再接。

---

## 9. 配置与 Provider 抽象（开源关键）

### 9.1 配置项
```typescript
interface AppConfig {
  llm: {
    baseURL: string;   // 默认内置OpenAI 兼容服务 的 baseURL
    apiKey: string;    // 用户自填，引导去 token 页面获取
    model: string;     // 默认一个服务商可用模型名
  };
  nudge: {
    enabled: boolean;
    eveningHour: number;     // 傍晚提醒触发小时，默认 18
    stallHours: number;      // 停滞阈值小时，默认 4
  };
}
```

> 具体默认值落在 `app/src/shared/config.ts`（zod schema + `z.infer<>` 派生 `AppConfig`，不另写平行 interface）：`baseURL='https://api.openai.com/v1'`、`model='gpt-5.5'`（可改占位）、`apiKey=''`、`nudge={enabled:true,eveningHour:18,stallHours:4}`。

### 9.2 Provider 抽象

> **实现说明**：下面描述的是 provider 抽象的*意图*——可替换、默认 OpenAI 兼容、测试可 mock、绝不硬编码密钥。**具体实现不再手写 `chat()`**，而是采用成熟栈：`@ai-sdk/openai-compatible` 的 `createOpenAICompatible({ baseURL, apiKey })` 构建模型，经 `aisdk()` 接入 `@openai/agents-core`；测试 mock 由 AI SDK 的 `MockLanguageModelV3` 显式启用。权威实现见 [`../reference/agent-runtime.md`](../reference/agent-runtime.md)。下文的 `LLMProvider`/`OpenAICompatProvider`/`MockProvider` 命名仅表达概念意图，不是最终类名。

```typescript
// 概念意图（非最终实现）：一个可替换、OpenAI 兼容、支持 function-calling 的模型层
interface LLMProvider {
  chat(messages: Message[], tools: ToolDef[]): Promise<ChatResult>;
}
```
- 默认走 OpenAI 兼容协议、支持 function calling（由 `@ai-sdk/openai-compatible` 提供）。
- **默认内置OpenAI 兼容服务 的 baseURL**；apiKey 留空时，首次启动与发送消息都会引导用户填写设置，运行时不走 mock。
- 提供显式测试 mock（`MockLanguageModelV3`）：跑通 Agent 单测，不作为用户运行时兜底。
- **绝不硬编码任何密钥**。baseURL 可在设置页修改，开源后换成任意 OpenAI 兼容服务即可。

### 9.3 设置页（UI）
首次启动若无 apiKey，引导进入设置页：填 baseURL（已预填默认）、apiKey、model。发送消息时若仍无 apiKey，直接弹起设置页，不创建对话消息、不调用 agent。

---

## 10. UI 设计

主界面：**左对话 | 右看板** 两栏布局。

```
┌─────────────┬──────────────────┐
│ 💬 搭子对话  │ 📋 本周目标       │
│             │  登录联调 ███ 60% │
│ 我:联调通了 │  设计文档 █   20% │
│ 搭子:✓已更新 │                  │
│             │ ☀️ 今日聚焦       │
│             │  □ 联调接口       │
│             │  □ 提测           │
│ [说点什么 ▸]│ [📝 一键生成周报] │
└─────────────┴──────────────────┘
```

### 10.1 左栏：搭子对话
- 消息流（用户 / 搭子气泡）。
- 底部输入框：即"便利贴"自由输入入口，支持多行自然语言。发送后即时显示在对话流，并触发 agent。
- 搭子的 tool 调用可选地以轻量提示展示（如"✓ 已更新登录联调到 60%"），增强"看得见 agent 在干活"的感觉。

### 10.2 右栏：周目标看板（人机协作，可读可写）
- **本周目标**：每个 Goal 一行，带进度条（progress）和状态；每个目标下可勾选待办、可手动「添加待办」。
- **今日聚焦**：今天相关的 Task 清单，可手动勾选完成/取消。
- **手动新建目标**：看板底部「新建目标」入口，人工也能直接建目标（与对话驱动并存）。
- **一键生成周报**按钮：触发周报生成，弹窗展示 markdown + 复制按钮。
- 看板数据来自主进程快照：agent loop 结束自动刷新；人工操作走 `board:*` IPC（mutate → 落 ProgressEvent → 广播 `snapshot:changed`），与对话同源、同样进周报原料。主路径仍是对话驱动，人工操作是补充（人机共同维护这棵周目标树）。

### 10.3 其他
- 设置页（齿轮入口）：配置 LLM provider 与 nudge 开关。
- 系统通知：主动推送走 macOS 原生通知。

---

## 11. 实现里程碑建议（供实现 agent 参考排期）

> **执行权威以 [`../plan/milestones.md`](../plan/milestones.md) 为准**（已对齐 agents-core + AI SDK / electron-store / TanStack Start 的修订栈）。下面是原始排期建议，保留作背景；条目里的 `OpenAICompatProvider`/`MockProvider` 仅为概念命名（见 §9.2 实现说明）。

一天工时下，建议按"先闭环、后加分"推进：

1. **脚手架**：Electron + React + Vite + TS 工程骨架，主/渲染进程 IPC 通道打通。
2. **Store + 数据模型**：本地 JSON 读写，当前周快照。
3. **LLM Provider**：OpenAICompatProvider + MockProvider，配置读写。
4. **Agent 编排 + Tools**：tool-calling loop，目标/进度/事件相关 tool。**（核心闭环第一段）**
5. **UI 主界面**：左对话右看板，IPC 联调，快照实时刷新。**（核心闭环第二段，到此可演示"说话→看板动"）**
6. **周报生成**：generate_report + 弹窗展示复制。**（demo 高潮）**
7. **提醒事项写入**：ReminderBridge + write_reminder tool。
8. **主动推送**：NudgeScheduler。**（MVP 内，但优先级最低，时间紧时最后接）**

> 1–6 是必须最先跑通的最小闭环（含 demo 高潮周报）；7–8 同属 MVP，在闭环稳定后接入，若现场时间不足可作为最后让步项。

---

## 12. 测试策略

- **单元测试**（不依赖外网 / macOS）：
  - Agent 编排 loop：用 `MockProvider` 喂预设 tool_calls，断言 tool 被正确执行、进度流落事件、循环正常终止与上限保护。
  - Store：JSON 读写、跨周新建、快照计算。
  - 周报生成：用 mock LLM 返回固定结构，断言原料组装正确。
  - ReminderBridge：用 `MockReminderBridge`，断言幂等逻辑（已有 reminderId 跳过）。
- **手动验证**（macOS 真机）：
  - 真实 LLM key 下跑通"录入→归因→看板更新→周报"全链路。
  - 提醒事项写入触发权限弹窗、列表归集、幂等。
  - 主动推送通知按时触发、频率克制。
- 每次代码改动后跑 `npm run build` 与相关测试，确保不破坏闭环。

---

## 13. 风险与注意事项

| 风险 | 说明 | 缓解 |
|------|------|------|
| 提醒事项权限 | 首次 osascript 写入触发授权弹窗，拒绝则失败 | 优雅降级 + 文案引导授权 |
| LLM 归因不准 | 进展归错目标 | system prompt 要求不确定时反问；find_goal 返回空时不硬归因 |
| tool loop 失控 | LLM 反复调 tool 不收敛 | 设循环上限（如 8 轮）并兜底返回 |
| 无 key 阻塞 | 现场没配 key 无法使用真实归因 | 首启与发送时引导填写设置；测试 mock 仅用于自动化测试 |
| 内网/外网差异 | 默认OpenAI 兼容服务 仅内网可用 | baseURL 可配置，开源后可换 |
| 跨周边界 | 周一切换周导致数据归属混乱 | weekOf 以周一为锚，统一计算当前周 |

---

## 14. 交付物
- 可在 macOS 上 `npm install && npm run dev` 启动的 Electron 应用。
- 跑通"自然语言录入 → 看板结构化 → 进度归因 → 一键周报"核心闭环。
- 提醒事项写入与主动推送均属 MVP，完整体验的一部分（主动推送优先级最低，现场时间不足时最后接）。
- README：说明如何配置 LLM provider（含OpenAI 兼容服务 token 获取地址）、如何授权提醒事项、如何运行与打包。

---

## 附录 A：名词约定
- **搭子 / Workmate**：本应用，AI 工作伙伴。
- **周目标树**：WeeklyPlan → Goal → Task 的三层结构。
- **进度流**：ProgressEvent 列表，周报的唯一原料。
- **归因**：把用户口语化的进展，关联到对应 Goal 并更新其 progress 的过程。
