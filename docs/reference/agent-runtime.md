# Agent 运行时：Loop / 模型 / Tools

> **架构**：用 `@openai/agents-core` 跑 agent，底层模型用 Vercel AI SDK（`ai` + `@ai-sdk/openai-compatible`），经 `aisdk()` 适配接入。**不手写 HTTP loop**。本文给 workmate 的契约、tool 目录与实现决策。

## 0. 依赖与版本

| 包 | 版本 | 作用 |
|----|------|------|
| `@openai/agents-core` | `0.5.1` | `Agent` / `run()` / `tool()` / `RunContext`，自带多步工具循环 |
| `@openai/agents-extensions` | `0.5.1` | `aisdk()`：把 AI SDK 模型包成 agents-core 的 model |
| `ai` | `6.0.97` | AI SDK（`generateText`；测试可显式用 `MockLanguageModelV3`） |
| `@ai-sdk/openai-compatible` | `2.0.30` | `createOpenAICompatible`：OpenAI 兼容端点（OpenAI 兼容服务） |
| `zod` | `4.3.6` | tool 入参 schema |

> 不做 membership/thinking/多 provider 注册表，只取主干 `createOpenAICompatible(...)(model)` → `aisdk()` → `Agent`。

## 1. 数据类型（spec）

数据模型（`WorkmateData/WeeklyPlan/Goal/Task/ProgressEvent/AppConfig`）是产品真相，定义见 [`product-design.md`](../design/product-design.md) §5，落在 `src/shared/types.ts`。运行时额外两个类型：

```ts
interface Snapshot { weekOf: string; today: string; weekday: string; goals: Goal[]; todayFocus: Task[] }
interface ToolTraceItem { tool: string; summary: string }
```

`weekOf(date)` = 该日期所在周的**周一**（本地时区）`YYYY-MM-DD`；当前周 = `weekOf===weekOf(today)`；跨周时 Store 自动新建 `WeeklyPlan`。

## 2. 模型构建（`agent/model.ts`）

模型工厂主干 + 显式测试 mock：

- **有 key**：`createOpenAICompatible({ name, apiKey, baseURL })(model)` → `aisdk(chatModel)`。baseURL 末尾不带 `/chat/completions`（SDK 自动补）。
- **无 key（运行时）**：不构建模型、不落原始事件；渲染层发送前打开设置页，主进程 `agent:sendMessage` 兜底返回 `CONFIG_REQUIRED`。
- **显式测试 mock**：单测可通过 `allowMockModel` 使用基于 `MockLanguageModelV3`（`ai/test`）的确定性模型，经 `aisdk()` 包好，按关键词回 tool-call 或友好文本。
- `buildModel(config, { allowMockModel })`：`config.llm.apiKey.trim()` 为空且未显式允许 mock → 抛 `MissingApiKeyError`；有 key → 真实模型；显式测试 mock → mock。
- **默认 baseURL/model** 见 [`product-design.md`](../design/product-design.md) §9（内置默认 baseURL，apiKey 留空引导用户填写，默认 model 为可改占位）。**绝不硬编码 apiKey。**

## 3. `AgentContext`（每次 `run` 注入；tool 经 `runContext.context` 读取）

```ts
interface AgentContext {
  store: Store              // 目标树 CRUD + appendEvent + getSnapshot（落盘）
  reminders: ReminderBridge // writeReminderById(taskId) → reminderId
  report: ReportService     // generate(weekOf?) → markdown
  trace: ToolTraceItem[]    // 本次 run 的工具足迹（tool 内 push）
  now: () => Date           // 便于单测注入固定时间
}
```

## 4. Tool 目录（spec — agent 契约）

用 `tool({ name, description, parameters: zodSchema, execute(input, runContext) })` 定义（agents-core 标准写法），`execute` 经 `runContext.context` 拿 `AgentContext`，返回结构化对象。
**不变量**：`create_goal`/`update_progress`/`complete_task` 在 `execute` 内自动 `store.appendEvent(...)`（落 `goal_created`/`progress_update`/`task_done`）；纯笔记用 `log_event`。每个 `execute` 末尾 `ctx.trace.push({tool,summary})`。

| Tool | 入参（zod） | 返回 | 行为/副作用 |
|------|-------------|------|-------------|
| `create_goal` | `title:string` | `{ goalId }` | 建周目标；落 `goal_created` |
| `add_task` | `goalId:string, title:string, due?:string(ISO)` | `{ taskId }` | 给目标加待办 |
| `update_progress` | `goalId:string, progress:int 0–100, note:string` | `{ goalId, progress }` | 更新进度；落 `progress_update`(summary=note) |
| `complete_task` | `taskId:string` | `{ taskId }` | 标记完成；落 `task_done` |
| `find_goal` | `query:string` | `{ matches: {goalId,title,progress,status}[] }` | 标题包含/分词命中（不调 LLM）；空数组→agent 反问 |
| `log_event` | `rawText, kind('note'|...), summary, relatedGoalId?` | `{ eventId }` | 写一条进度流事件 |
| `write_reminder` | `taskId:string` | `{ reminderId } \| { error, needsPermission }` | 写入提醒事项（幂等）；失败不抛，返回 error 让 agent 口头引导授权 |
| `generate_report` | `weekOf?:string` | `{ markdown }` | 见 §7 |
| `get_snapshot` | — | `Snapshot` | 自查上下文 |

## 5. Agent + Loop（`agent/agent.ts` + `orchestrator.ts`）

agents-core 标准范式（`new Agent({ name:'Workmate', instructions: buildSystemPrompt(snapshot), model: buildModel(config), tools })`）+ `run()` 调用：

- `runTurn(text, deps)`：先检查 `apiKey`（除非单测显式 `allowMockModel`）；无 key 抛 `MissingApiKeyError` 且不落事件 → 有 key 后 `store.appendEvent({kind:'note', rawText:text, summary:text})`（录入即落原始事件）→ 构建 agent + `AgentContext{trace:[]}` → `run(agent, [user(text)], { maxTurns: 8, context })` → 返回 `{ reply: result.finalOutput ?? '', snapshot: store.getSnapshot(), toolTrace: ctx.trace }`。
- `maxTurns: 8` 即循环上限兜底。**doom-loop（可选加分）**：加"同 tool+同参连续 N 次即停"。
- 每轮后 store 已被 tool 改写并落盘；IPC 层负责 `broadcast(snapshot:changed)`（见 ipc-contract.md §4）。
- **流式（已实现）**：`runTurnStream(text, deps, onEvent, signal)` 用 `run(agent, [user], { stream: true, signal, context })`，`for await` 消费：`raw_model_stream_event.data.type==='output_text_delta'` → 逐字 `onEvent({kind:'text',delta})`；工具执行后 `ctx.trace` 增长 → flush `onEvent({kind:'tool',item})`。IPC `agent:sendMessage` 用 `e.sender.send` 把 `agent:chunk` 只回发起窗口。显式测试 mock 也支持流式（`mock-model.ts` 加 `doStream`，用 `simulateReadableStream` 把 `decide()` 结果切成 text-delta / tool-call part）。非流式 `runTurn` 保留给单测。
- **超时与取消（关键）**：agents-core 在 abort 时是**优雅 close 流**（`for await` 正常结束、`stream.completed` resolve、不抛错），所以超时/取消**必须在循环结束后查 `signal.aborted`**：reason 为 `TimeoutError` → 抛出（IPC 映射 `LLM_TIMEOUT`，兑现 §5 降级）；reason 为 `AbortError`（用户点「停止」走 `agent:cancel`）→ 保留已收到的部分文本、静默收尾。IPC 层每轮建一个 `AbortController` + `AGENT_TIMEOUT_MS` 定时器，`agent:cancel` abort 它。

## 6. system prompt

`buildSystemPrompt(snapshot)`（`agent/prompt.ts`）注入 today/weekday/weekOf + 当前周快照 JSON + 人设与行为准则。完整文案见 [`prompts.md`](./prompts.md) §1。

## 7. 周报生成（`agent/report.ts`）

- 读当前周（或指定 `weekOf`）`goals`+`events` 组装原料 → AI SDK `generateText({ model, system: 报告prompt, prompt: 原料JSON })` 出 markdown。
- **无 key / LLM 失败降级**：不调 LLM，按原料拼确定性 markdown（保证演示与单测稳定）。
- 原料结构、报告 prompt、四段 markdown（本周完成/进展亮点/风险与卡点/下周计划）、降级规则见 [`prompts.md`](./prompts.md) §2。

## 8. 测试与无 key

- **tool 单测（首选）**：直接 `await tool.execute(input, { context })`（注入内存 Store + Mock ReminderBridge），断言 Store 改写、事件落流、幂等。无需真实模型。
- **loop 集成测**：用 `MockLanguageModelV3`（`ai/test`）脚本化"先 tool-call 再文本"，通过 `allowMockModel` 显式喂给 `Agent`，断言 tool 执行、`maxTurns` 生效、`finalOutput` 正确。
- **运行时无 key**：渲染层发送前打开设置页；主进程 `agent:sendMessage` 兜底返回 `CONFIG_REQUIRED`；编排器默认抛 `MissingApiKeyError` 且不落 `ProgressEvent`。
