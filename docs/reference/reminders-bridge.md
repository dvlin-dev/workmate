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
- **必须批量合并为一次 osascript（根因·红线）**：agent 一轮里会并行调用多个 `write_reminder`。对 Reminders.app **反复 spawn 独立 osascript** 在连发下不安全——第一条后 Apple Events 派发被拖住 / EventKit 锁库，表现为"第一条成功、后续全部卡到超时"（非权限错误，`durationMs≈timeout`）。**根治：把同一波写入微批合并成一次 osascript**——一次 `tell application "Reminders"`、建一次列表、在同一个 run loop 里循环创建整批提醒，按创建顺序返回 id（换行分隔）。bridge 用 `setTimeout(0)` 收集同一 tick 内的全部 `writeReminderById`，合并 flush；并保留串行队列防多批叠加。单机本地 app 多进程并发本无收益。
- 批量调用设约 20s 超时（含 Reminders.app 冷启动）；瞬时失败（非权限）整批退避重试（默认 3 次、200ms×attempt），`ReminderPermissionError` 不重试（走降级引导授权）。osascript 执行器（`OsascriptRunner`）可注入，便于对合并/重试做单测。

## 3. AppleScript 需实现的逻辑（行为规格）

批量脚本以 `on run argv … end run` 接收参数：`argv = [listName, 然后每个提醒一段: title, hasDue('0'|'1'), (year,month,day,hours,minutes if hasDue)]`。
1. 取列表名（argv 第 1 项）；`tell application "Reminders"`：若列表不存在则 `make new list`。
2. 从第 2 项起按变长步幅循环（有 due 步幅 7、无 due 步幅 2）：有 due 时用 `current date` 起，**先 `set day to 1`** 再设 `year/month/day/hours/minutes`、`seconds=0`，`make new reminder … {name:title, due date:dueDate}`；否则只设 `name`。
3. 每条把 `id of newReminder` 追加进结果，循环结束 `return out as text`（换行分隔，形如 `x-apple-reminder://…`）。bridge 按行切回 `reminderId[]`，按序回填各 `task.reminderId`。

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
