# IPC 契约

> 标准 Electron IPC 范式：`shared/ipc.ts` 定义单一 `WorkmateApi` 接口 → preload `contextBridge.exposeInMainWorld('workmateAPI', api)` → 主进程 `ipcMain.handle` 实现。通道名是**点分串**（`domain:action`）。本文给契约（spec）。

## 1. 结果信封（统一）

每个主进程 handler 返回 `AppResult<T>`；preload 原样透传；渲染层 `lib/api.ts` 解包（`ok` 取 `data`，否则按 `error.code` 处理）。信封与帮助函数为 `asObjectRecord`/`broadcastToAllWindows`/`ok`/`fail`。

```ts
type AppResult<T> = { ok: true; data: T } | { ok: false; error: { code: AppErrorCode; message: string } }
type AppErrorCode =
  | 'LLM_TIMEOUT' | 'LLM_ERROR'
  | 'REMINDER_PERMISSION_DENIED' | 'REMINDER_FAILED'
  | 'NOT_FOUND' | 'BAD_INPUT' | 'INTERNAL'
```

错误语义与降级见 [`engineering-standards.md`](./engineering-standards.md) §5。

## 2. 通道清单（spec）

| 通道 | 类型 | 入参 | 返回 |
|------|------|------|------|
| `app:ping` | invoke | — | `AppResult<{ pong: true; version: string }>`（健康检查） |
| `agent:sendMessage` | invoke | `{ text: string }` | `AppResult<SendMessageResult>`（结束时 resolve；期间流式发 `agent:chunk`） |
| `agent:chunk` | event(主→渲染) | — | `AgentChunk`（逐字 `text` / 工具足迹 `tool` 增量） |
| `board:toggleTask` | invoke | `{ taskId }` | `AppResult<Snapshot>`（人工勾选/取消） |
| `board:addGoal` | invoke | `{ title }` | `AppResult<Snapshot>`（人工新建目标） |
| `board:addTask` | invoke | `{ goalId, title, due? }` | `AppResult<Snapshot>`（人工加待办） |
| `board:setProgress` | invoke | `{ goalId, progress }` | `AppResult<Snapshot>`（人工调进度） |
| `board:clearWeek` | invoke | — | `AppResult<Snapshot>`（清空本周目标+进度流，保留配置/历史周） |
| `snapshot:get` | invoke | — | `AppResult<Snapshot>` |
| `snapshot:changed` | event(主→渲染) | — | `Snapshot`（每轮 agent 结束后广播） |
| `report:generate` | invoke | `{ weekOf?: string }` | `AppResult<{ markdown: string }>` |
| `config:get` | invoke | — | `AppResult<AppConfig>` |
| `config:set` | invoke | `DeepPartial<AppConfig>` | `AppResult<AppConfig>`（合并后全量） |
| `config:testProvider` | invoke | `{ baseURL, apiKey, model }`（无状态：用表单值，不读/写 store） | `AppResult<{ message: string }>` |
| `reminders:write` | invoke | `{ taskId: string }` | `AppResult<{ reminderId: string }>` |
| `nudge:notify` | event(主→渲染) | — | `NudgePayload`（点击通知唤起窗口） |

## 3. `WorkmateApi` 接口（契约，`shared/ipc.ts`）

```ts
interface SendMessageResult {
  reply: string             // 搭子最终文本
  snapshot: Snapshot        // 该轮后的最新快照（看板据此刷新）
  toolTrace: ToolTraceItem[] // 本轮调过的 tool 简述（"看得见 agent 在干活"）
}
interface NudgePayload { kind: 'evening' | 'stall' | 'friday'; message: string }

interface TestProviderInput { baseURL: string; apiKey: string; model: string }

type AgentChunk =
  | { kind: 'text'; delta: string }
  | { kind: 'tool'; item: ToolTraceItem }

interface WorkmateApi {
  ping(): Promise<AppResult<{ pong: true; version: string }>>
  agent:     { sendMessage(text: string): Promise<AppResult<SendMessageResult>>; onChunk(h: (c: AgentChunk) => void): () => void }
  board:     { toggleTask(taskId): Promise<AppResult<Snapshot>>; addGoal(title): Promise<AppResult<Snapshot>>; addTask(goalId, title, due?): Promise<AppResult<Snapshot>>; setProgress(goalId, progress): Promise<AppResult<Snapshot>>; clearWeek(): Promise<AppResult<Snapshot>> }
  snapshot:  { get(): Promise<AppResult<Snapshot>>; onChange(h: (s: Snapshot) => void): () => void }
  report:    { generate(weekOf?: string): Promise<AppResult<{ markdown: string }>> }
  config:    { get(): Promise<AppResult<AppConfig>>; set(patch): Promise<AppResult<AppConfig>>; testProvider(input: TestProviderInput): Promise<AppResult<{ message: string }>> }
  reminders: { write(taskId: string): Promise<AppResult<{ reminderId: string }>> }
  nudge:     { onNotify(h: (n: NudgePayload) => void): () => void }
}
// 渲染层：declare global { interface Window { workmateAPI: WorkmateApi } }
```

通道名集中在 `CH` 常量（`domain:action`）。`Snapshot`/`ToolTraceItem`/`AppConfig` 见 [`agent-runtime.md`](./agent-runtime.md) §1 / [`product-design.md`](../design/product-design.md) §5。

## 4. 实现要点（不在此内联代码）

- **preload**：`invoke` 通道 = `ipcRenderer.invoke(CH.x, payload)`；事件通道 = `ipcRenderer.on(CH.x, listener)` 并**返回退订函数**（`removeListener`）。
- **主进程注册**：每个 `ipcMain.handle` 用 `asObjectRecord` 守卫 payload，成功 `ok(data)`、失败 `fail(code,msg)`。
  - `agent:sendMessage` → 校验非空 → `runTurn(text)`（agents-core `run(maxTurns:8)`，见 agent-runtime.md）→ `broadcast(CH.snapshotChanged, result.snapshot)` → `ok(result)`；异常转 `LLM_*`。
  - `config:testProvider` → 用当前 config 构建模型跑 `generateText({model, prompt:'Say "Test successful"'})`。
  - `reminders:write` → `reminders.writeReminderById(taskId)`；捕获 `-1743/not authorized` → `REMINDER_PERMISSION_DENIED`，其余 → `REMINDER_FAILED`。
- **渲染层 `lib/api.ts`**：把 `window.workmateAPI` 包成**函数式导出**（`sendMessage`/`getSnapshot`/`onSnapshot`/`generateReport`/`getConfig`/`setConfig`/`testProvider`/`writeReminder`），内部 `unwrap(AppResult)`（`!ok` 抛带 `code` 的 Error）。组件不直接碰 `window.workmateAPI`（见 engineering-standards.md §1）。
