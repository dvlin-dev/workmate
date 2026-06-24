# 工程规范

> 单 App 适用的工程规范子集 + workmate 特有的错误降级。涵盖状态管理、命名、Zod、测试分级。

## 1. 状态管理：Zustand Store + Methods + 函数式 API client

- 业务态一律走 **Zustand store**，**不用 React Context 管业务态**（主题这类纯 UI 态例外）。
- 业务调用是**函数式导出**（`lib/api.ts` 里的 `sendMessage`/`getSnapshot`/...），**不是 class client**。组件不直接碰 `window.workmateAPI`。
- **Zustand selector 不得返回新对象/数组字面量**（否则每次 render 都触发更新）。用原子 selector 或 `useShallow`；空值回退用模块级常量（如 `EMPTY`）。

workmate 三个 store（`store/`）：
- `useSnapshotStore`：`snapshot` + `hydrate()`（启动调 `getSnapshot()`）+ `subscribe()`（订阅 `snapshot:changed` 广播）。`App.tsx` 挂载时 `hydrate()` 一次并 `subscribe()`，卸载时退订。
- `useChatStore`：对话消息流（append 用户/搭子气泡 + toolTrace）。
- `useConfigStore`：设置（baseURL/apiKey/model + nudge），读写走 `lib/api.ts` 的 `getConfig/setConfig`。

## 2. Zod / DTO / 类型

- `config`、tool 入参、IPC payload 都用 **Zod** 定义，类型用 `z.infer<>` 派生，**不另写平行 interface**。
- `electron-store` 的 settings 用 zod schema 校验 + 设默认值。
- tool 入参 schema 即 `tool({ parameters: zodSchema })`（见 agent-runtime.md），同一份 schema 既校验又生成 function-calling JSON Schema。

## 3. 命名约定

| 种类 | 约定 |
|------|------|
| 组件 / 类型 | `PascalCase` |
| 函数 / 变量 | `camelCase` |
| 常量 | `UPPER_SNAKE_CASE` |
| 组件文件夹 | `PascalCase`；工具文件 `camelCase` |
| IPC 通道 | `domain:action` 点分串（见 ipc-contract.md） |

## 4. 代码原则

- 单一职责、纯函数优先、early-return、DRY。
- **根因修复优先，禁止打补丁**。**无向后兼容**：直接删/重构无用代码，不留 `legacyX`/`x_v1`/废弃注释。
- 优先复用已有接口/类型/工具函数；动手前先看仓库内是否已有同款实现。
- 面向用户文案/错误用中文；标识符、commit message 用英文（Conventional Commits）。

## 5. 错误处理与降级（强制；对齐 DESIGN §13 + 实现细化）

所有"重"操作在主进程捕获后转 `AppResult` 错误信封（见 ipc-contract.md），渲染层据 `code` 给**安静的行内降级**，绝不整屏崩溃/弹窗轰炸。

| 场景 | 触发 | code | 处理与降级 |
|------|------|------|-----------|
| LLM 超时 | `AbortSignal.timeout` / 60s | `LLM_TIMEOUT` | 对话区行内提示"搭子有点忙，稍后再试"；保留用户输入；那条录入事件已落流，不丢 |
| LLM 报错 | HTTP 4xx/5xx、网络错 | `LLM_ERROR` | 行内提示"LLM 暂时不可用，检查 设置 里的 baseURL/apiKey/model"；引导去设置页 |
| 无 key | `apiKey` 为空 | —（不报错） | 自动用 mock 模型，UI 闭环可演示；设置页顶部常驻"填入 apiKey 解锁真实归因"提示 |
| 提醒事项权限被拒 | osascript `-1743` | `REMINDER_PERMISSION_DENIED` | agent 口头引导去 系统设置→隐私与安全性→自动化/提醒事项 授权后重试；不崩溃 |
| 提醒事项其他失败 | osascript 非零退出 | `REMINDER_FAILED` | 提示"写入提醒事项失败，稍后重试"；目标/进度照常更新 |
| tool loop 失控 | 反复调 tool 不收敛 | —（兜底） | `maxTurns: 8` 收敛；可选 doom-loop 同参去重；超限返回兜底文案 |
| 跨周边界 | 周一切换周 | —（不变量） | `weekOf` 以周一为锚，Store 自动新建 `WeeklyPlan`，归属不乱 |
| 数据文件损坏 | JSON 解析失败 | `INTERNAL` | 备份坏文件为 `*.bak`，重建空 `WorkmateData`，提示用户；不阻塞启动 |

## 6. 测试分级（L0/L1/L2）

- **L0**（纯样式/文案/布局）：跳过全量套件，手动看一眼。
- **L1**（组件/状态/数据映射）：跑受影响范围的 `typecheck` + 对应 `vitest` 单测。
- **L2**（核心逻辑/跨模块/主进程）：跑相关单测 + 回归；必要时 `npm run build` 全量。
- 新功能配单测；bugfix 配回归测。前端测试用 Vitest（+ Testing Library 按需）。

### 必写单测（对齐 DESIGN §12）

1. **Agent loop**：用 `MockLanguageModelV3` 脚本化"先 tool-call 再文本"，断言 tool 被执行、进度流落事件、`maxTurns` 生效、`finalOutput` 正确。亦可直接 `tool.execute(input, { context })` 测每个 tool（更快更稳）。
2. **Store**：JSON 读写、跨周新建 `WeeklyPlan`、当前周快照计算、`appendEvent` 不变量。
3. **周报原料组装**：给定 goals+events，断言 `material` 结构正确；mock 模型下断言确定性 markdown 四段齐全。
4. **ReminderBridge 幂等**：同一 task 连续写两次，只创建一次、返回同一 id（用 `MockReminderBridge`）。

> 每次代码改动后跑 `npm run build` 与相关测试，确保不破坏核心闭环。
