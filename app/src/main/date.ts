/**
 * 本地时区日期 / 周锚的纯原语（无 electron、无副作用）——main 进程各处共享、可单测。
 * 收口前这套逻辑被 store / report / nudge 各自重写，且 nudge 一处未补零导致键格式漂移。
 * 真相源：CLAUDE.md 硬约束 #4（weekOf 以周一为锚）。
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 本地时区 YYYY-MM-DD（月/日补零） */
export function formatLocalYMD(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 在纯日期 YYYY-MM-DD 上加减 n 天，返回本地 YYYY-MM-DD */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatLocalYMD(d);
}

/** 该日期所在周的周一（本地时区）YYYY-MM-DD */
export function weekOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=周日..6=周六
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return formatLocalYMD(d);
}

/** iso 时间戳是否落在 now 的本地同一天 */
export function sameLocalDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
