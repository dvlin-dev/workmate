# 提醒事项桥接（macOS Reminders）

> workmate 自建。单向写入（只写不读），用 `osascript` 执行 AppleScript，归集到固定列表 "Workmate"，用 `Task.reminderId` 幂等。本文给契约与设计约束（spec），不内联实现。

## 1. 接口（契约，`reminders/bridge.ts`）

```ts
interface ReminderBridge {
  writeReminder(task: { title: string; due?: string }): Promise<string>  // 低层：纯写入，返回 reminderId
  writeReminderById(taskId: string): Promise<string>                     // 高层：查 Store→幂等→写入→回填落盘
}
```

`writeReminderById` 依赖 `Store`：查 task；若已有 `reminderId` 直接返回（幂等）；否则 `writeReminder({title,due})`，把返回 id 写回 `task.reminderId` 并 `save()`。运行时按平台选择：`process.platform==='darwin'` 用真实实现，否则用 `MockReminderBridge`。

## 2. 写入方式与硬约束

- **用 `child_process.execFile('osascript', ['-e', SCRIPT, ...argv])`**，把 `title`/`due` 作为 **argv** 传入；脚本本体是常量字符串。**绝不把用户文本拼进脚本**（防 AppleScript 注入）——这是红线。
- **列表归集**：写入固定列表 "Workmate"，不存在则先建（避免污染默认列表）。
- **due**：缺省时创建无截止日期的提醒。带 due 时，把 ISO 时间拆成 `年/月/日/时/分` 作为 argv 传入，在 AppleScript 里按分量构造 `date`；**先 `set day to 1` 再设月份**，避免设月时日期溢出（如当前 31 日设到 2 月）。
- 设约 10s 超时，避免 osascript 卡死阻塞主进程。

## 3. AppleScript 需实现的逻辑（行为规格）

脚本以 `on run argv … end run` 接收参数，依次：
1. 取 `title`（argv 第 1 项）、列表名 "Workmate"。
2. `tell application "Reminders"`：若列表不存在则 `make new list`。
3. 若 argv 含日期分量（≥6 项）：用 `current date` 起，按上节顺序设 `year/month/day/hours/minutes`、`seconds=0`，`make new reminder at theList with properties {name:title, due date:dueDate}`；否则只设 `name`。
4. `return id of newReminder`（形如 `x-apple-reminderkit://…`，存为 `reminderId`）。

## 4. 权限（TCC）与 Info.plist

首次写入触发两类 macOS 授权：**自动化**（控制「提醒事项」）+ **提醒事项访问**。必须在打包注入用途说明，否则被直接拒绝且无弹窗。配置见 [`project-structure.md`](./project-structure.md) §5：
- `electron-builder.yml` `mac.extendInfo`：`NSRemindersUsageDescription` + `NSAppleEventsUsageDescription`。
- entitlements 加 `com.apple.security.automation.apple-events`（hardenedRuntime 下必需）。

**dev 模式注意**：`electron-vite dev` 下应用身份是 "Electron"，授权弹窗/系统设置里显示 Electron；打包后才是 "Workmate"。演示授权流程最好用打包产物。

## 5. 降级路径（强制）

- 捕获 `-1743 / not authorized` → 抛带 `code:'REMINDER_PERMISSION_DENIED'` 的错误；IPC 返回该 code；`write_reminder` tool **不抛**，返回 `{ error, needsPermission:true }`，让 agent 口头引导用户："去 系统设置 → 隐私与安全性 → 自动化（及「提醒事项」）里允许 Workmate，然后可以再说一次让我写入。"
- 其他失败 → `REMINDER_FAILED`，提示稍后重试；目标/进度照常更新，**不崩溃**。

## 6. Mock 与单测

`MockReminderBridge`（`reminders/mock.ts`）实现同一接口：`writeReminder` 返回递增假 id；`writeReminderById` 走 Store 查找 + 幂等 + 回填。
**单测要点**（对齐 product-design §12）：对同一 task 连续 `writeReminderById` 两次，断言只创建一次、第二次返回同一 id。
