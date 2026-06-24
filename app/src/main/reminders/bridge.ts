/**
 * macOS 提醒事项桥（单向写入）。用 osascript 执行 AppleScript，归集到固定列表 "Workmate"。
 * 硬约束：title/due 作为 argv 传入，脚本本体是常量字符串，绝不拼接用户文本（防注入）。
 *
 * 根因与设计（reminders-bridge.md §2）：agent 一轮里会并行调用多个 write_reminder。
 * 对 Reminders.app 反复 spawn 独立 osascript 在并发/连发下不安全——Apple Events 会被拖住、
 * EventKit 锁库，表现为"第一条成功、后续全部卡到超时"。这里把同一波写入**微批合并为一次
 * osascript**（一次绑定 app、建一次列表、在同一个 run loop 里循环创建全部提醒），从根上绕开。
 * 真相源：docs/reference/reminders-bridge.md。
 */

import { execFile } from 'node:child_process';
import type { ReminderBridge } from '../agent/context';
import { ReminderPermissionError } from './errors';
import type { WorkmateStore } from '../store';

const LIST_NAME = 'Workmate';
/** 一次批量写入的超时（一次调用创建整批提醒，给足时间） */
const OSASCRIPT_TIMEOUT_MS = 20_000;
/** 瞬时失败（非权限）重试次数与基础退避 */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 200;
/** 纯日期 due（无时间）默认提醒时刻：本地 09:00 */
const DATE_ONLY_HOUR = 9;

/**
 * 批量脚本：argv = [listName, 然后每个提醒一段: title, hasDue('0'|'1'), (year,month,day,hours,minutes if hasDue)]。
 * 在单次 `tell application "Reminders"` 里建一次列表、循环创建全部提醒，按创建顺序返回 id（换行分隔）。
 * title 始终是 argv 项（绝不拼进脚本源码）。
 */
const BATCH_SCRIPT = `on run argv
  set theListName to item 1 of argv
  set out to {}
  tell application "Reminders"
    if not (exists list theListName) then
      make new list with properties {name:theListName}
    end if
    set theList to list theListName
    set i to 2
    set n to count of argv
    repeat while i is less than or equal to n
      set theTitle to item i of argv
      set hasDue to (item (i + 1) of argv) as integer
      if hasDue is 1 then
        set dueDate to current date
        set day of dueDate to 1
        set year of dueDate to (item (i + 2) of argv as integer)
        set month of dueDate to (item (i + 3) of argv as integer)
        set day of dueDate to (item (i + 4) of argv as integer)
        set hours of dueDate to (item (i + 5) of argv as integer)
        set minutes of dueDate to (item (i + 6) of argv as integer)
        set seconds of dueDate to 0
        set newReminder to make new reminder at end of theList with properties {name:theTitle, due date:dueDate}
        set i to i + 7
      else
        set newReminder to make new reminder at end of theList with properties {name:theTitle}
        set i to i + 2
      end if
      set end of out to (id of newReminder)
    end repeat
  end tell
  set AppleScript's text item delimiters to linefeed
  return out as text
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

/** osascript 执行器：argv 作为参数传入常量批量脚本，返回换行分隔的 id 串。可注入以便单测。 */
export type OsascriptRunner = (argv: string[], timeoutMs: number) => Promise<string>;

const defaultRunner: OsascriptRunner = (argv, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile(
      'osascript',
      ['-e', BATCH_SCRIPT, ...argv],
      { timeout: timeoutMs },
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

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const noop = () => {};

interface PendingWrite {
  taskId: string;
  resolve: (id: string) => void;
  reject: (error: unknown) => void;
}

export interface OsascriptBridgeOptions {
  /** 注入 osascript 执行器（默认真实 execFile）；单测可替换 */
  runner?: OsascriptRunner;
  maxAttempts?: number;
  retryBaseMs?: number;
  timeoutMs?: number;
}

export class OsascriptReminderBridge implements ReminderBridge {
  /** 同一 taskId 的并发/重入写入去重，避免 check-then-act 竞态产生重复提醒 */
  private readonly inflight = new Map<string, Promise<string>>();
  /** 当前累积、等待下一个 tick 合并 flush 的写入 */
  private pending: PendingWrite[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** 串行化 osascript 调用：即使多批 flush 叠加，也保证任意时刻只有一个 osascript 在跑 */
  private tail: Promise<unknown> = Promise.resolve();

  private readonly runner: OsascriptRunner;
  private readonly maxAttempts: number;
  private readonly retryBaseMs: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly store: WorkmateStore,
    options: OsascriptBridgeOptions = {}
  ) {
    this.runner = options.runner ?? defaultRunner;
    this.maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
    this.retryBaseMs = options.retryBaseMs ?? RETRY_BASE_MS;
    this.timeoutMs = options.timeoutMs ?? OSASCRIPT_TIMEOUT_MS;
  }

  /** 高层：查 Store → 幂等 → 合并写入 → 回填落盘。agent 的并发调用在此被合并成一次 osascript。 */
  writeReminderById(taskId: string): Promise<string> {
    const existing = this.inflight.get(taskId);
    if (existing) return existing;
    let resolveFn!: (id: string) => void;
    let rejectFn!: (error: unknown) => void;
    const promise = new Promise<string>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    const cleanup = () => this.inflight.delete(taskId);
    promise.then(cleanup, cleanup);
    this.inflight.set(taskId, promise);
    this.pending.push({ taskId, resolve: resolveFn, reject: rejectFn });
    this.scheduleFlush();
    return promise;
  }

  // ── 内部 ────────────────────────────────────────────────────
  /** 把某任务编码成 argv 片段：title, hasDue('0'|'1'), (year,month,day,hours,minutes if due) */
  private encodeTask(title: string, due?: string): string[] {
    const seg = [title];
    const d = due ? parseDue(due) : null;
    if (d) {
      seg.push(
        '1',
        String(d.getFullYear()),
        String(d.getMonth() + 1),
        String(d.getDate()),
        String(d.getHours()),
        String(d.getMinutes())
      );
    } else {
      if (due) console.warn(`[reminders] 无法解析 due="${due}"，将创建无截止日期的提醒`);
      seg.push('0');
    }
    return seg;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    // setTimeout(0)：等同步派发的整波 write_reminder 都入队后再合并，确保批量最大化
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 0);
  }

  private async flush(): Promise<void> {
    const batch = this.pending;
    this.pending = [];
    if (batch.length === 0) return;

    // 1) 幂等/校验：缺失任务 reject；已有 reminderId 直接 resolve（不进 osascript）
    const toWrite: { pending: PendingWrite; title: string; due?: string }[] = [];
    for (const item of batch) {
      const task = this.store.getTask(item.taskId);
      if (!task) {
        item.reject(new Error(`NOT_FOUND: task ${item.taskId}`));
        continue;
      }
      if (task.reminderId) {
        item.resolve(task.reminderId);
        continue;
      }
      toWrite.push({ pending: item, title: task.title, due: task.due });
    }
    if (toWrite.length === 0) return;

    // 2) 构建一次性 argv，串行 + 重试地跑一次 osascript
    const argv = [LIST_NAME];
    for (const item of toWrite) argv.push(...this.encodeTask(item.title, item.due));

    try {
      const out = await this.enqueue(() => this.runWithRetry(argv));
      const ids = out.split('\n').map((s) => s.trim()).filter(Boolean);
      toWrite.forEach((item, idx) => {
        const id = ids[idx];
        if (id) {
          this.store.setReminderId(item.pending.taskId, id);
          item.pending.resolve(id);
        } else {
          item.pending.reject(new Error('未能获取提醒事项 id'));
        }
      });
    } catch (error) {
      for (const item of toWrite) item.pending.reject(error);
    }
  }

  /** 接到串行队列尾部：前一个不论成败都继续；链上的 rejection 不互相影响（结果仍回传调用方） */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.then(noop, noop);
    return result;
  }

  /** 在一个串行槽内带重试地执行；权限错误不重试（重试无意义） */
  private async runWithRetry(argv: string[]): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.runner(argv, this.timeoutMs);
      } catch (error) {
        if (error instanceof ReminderPermissionError) throw error;
        lastError = error;
        if (attempt < this.maxAttempts) await delay(this.retryBaseMs * attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('写入提醒事项失败');
  }
}
