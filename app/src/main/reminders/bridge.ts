/**
 * macOS 提醒事项桥（单向写入）。用 osascript 执行 AppleScript，归集到固定列表 "Workmate"。
 * 硬约束：title/due 作为 argv 传入，脚本本体是常量字符串，绝不拼接用户文本（防注入）。
 * 真相源：docs/reference/reminders-bridge.md。
 */

import { execFile } from 'node:child_process';
import { ReminderPermissionError, type ReminderBridge } from '../agent/context';
import type { WorkmateStore } from '../store';

const LIST_NAME = 'Workmate';
const OSASCRIPT_TIMEOUT_MS = 10_000;
/** 纯日期 due（无时间）默认提醒时刻：本地 09:00 */
const DATE_ONLY_HOUR = 9;

/** on run argv: [title, listName, (year, month, day, hours, minutes)?] → 返回 reminder id */
const SCRIPT = `on run argv
  set theTitle to item 1 of argv
  set theListName to item 2 of argv
  tell application "Reminders"
    if not (exists list theListName) then
      make new list with properties {name:theListName}
    end if
    set theList to list theListName
    if (count of argv) is greater than or equal to 7 then
      set dueDate to current date
      set day of dueDate to 1
      set year of dueDate to (item 3 of argv as integer)
      set month of dueDate to (item 4 of argv as integer)
      set day of dueDate to (item 5 of argv as integer)
      set hours of dueDate to (item 6 of argv as integer)
      set minutes of dueDate to (item 7 of argv as integer)
      set seconds of dueDate to 0
      set newReminder to make new reminder at end of theList with properties {name:theTitle, due date:dueDate}
    else
      set newReminder to make new reminder at end of theList with properties {name:theTitle}
    end if
    return id of newReminder
  end tell
end run`;

/** 解析 due：纯日期按本地默认时刻，带时间按其本地分量；非法返回 null */
function parseDue(due: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    const [y, m, d] = due.split('-').map(Number);
    return new Date(y!, m! - 1, d!, DATE_ONLY_HOUR, 0, 0);
  }
  const dt = new Date(due);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function isPermissionDenied(detail: string): boolean {
  const d = detail.toLowerCase();
  return (
    d.includes('-1743') ||
    d.includes('-10004') ||
    d.includes('not authorized') ||
    d.includes('not allowed') ||
    d.includes('not permitted') ||
    d.includes('permission') ||
    d.includes('privacy')
  );
}

function runOsascript(argv: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'osascript',
      ['-e', SCRIPT, ...argv],
      { timeout: OSASCRIPT_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error) {
          const detail = `${stderr || ''} ${error.message || ''}`;
          if (isPermissionDenied(detail)) {
            reject(new ReminderPermissionError('提醒事项授权被拒绝，请在系统设置中允许 Workmate'));
            return;
          }
          reject(new Error(stderr.trim() || error.message || '写入提醒事项失败'));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

export class OsascriptReminderBridge implements ReminderBridge {
  /** 同一 taskId 的并发/重入写入去重，避免 check-then-act 竞态产生重复提醒 */
  private readonly inflight = new Map<string, Promise<string>>();

  constructor(private readonly store: WorkmateStore) {}

  async writeReminder(task: { title: string; due?: string }): Promise<string> {
    const argv = [task.title, LIST_NAME];
    if (task.due) {
      const d = parseDue(task.due);
      if (d) {
        argv.push(
          String(d.getFullYear()),
          String(d.getMonth() + 1),
          String(d.getDate()),
          String(d.getHours()),
          String(d.getMinutes())
        );
      } else {
        console.warn(`[reminders] 无法解析 due="${task.due}"，将创建无截止日期的提醒`);
      }
    }
    const id = await runOsascript(argv);
    if (!id) throw new Error('未能获取提醒事项 id');
    return id;
  }

  async writeReminderById(taskId: string): Promise<string> {
    const existing = this.inflight.get(taskId);
    if (existing) return existing;
    const pending = this.doWriteById(taskId).finally(() => this.inflight.delete(taskId));
    this.inflight.set(taskId, pending);
    return pending;
  }

  private async doWriteById(taskId: string): Promise<string> {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`NOT_FOUND: task ${taskId}`);
    if (task.reminderId) return task.reminderId;
    const reminderId = await this.writeReminder({ title: task.title, due: task.due });
    this.store.setReminderId(taskId, reminderId);
    return reminderId;
  }
}
