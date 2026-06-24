import { describe, it, expect } from 'vitest';
import { addDays, formatLocalYMD, sameLocalDay, weekOf } from '../src/main/date';

describe('date 原语', () => {
  it('formatLocalYMD 月/日补零（钉住 nudge 键漂移修复）', () => {
    expect(formatLocalYMD(new Date(2026, 5, 7, 10, 0))).toBe('2026-06-07');
    expect(formatLocalYMD(new Date(2026, 11, 25))).toBe('2026-12-25');
  });

  it('addDays 跨月/跨年/向前', () => {
    expect(addDays('2026-06-22', 6)).toBe('2026-06-28');
    expect(addDays('2026-06-28', 3)).toBe('2026-07-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('weekOf 锚到周一（周日归上一个周一）', () => {
    expect(new Date(`${weekOf(new Date(2026, 5, 24))}T00:00:00`).getDay()).toBe(1);
    expect(weekOf(new Date(2026, 5, 24))).toBe('2026-06-22');
    expect(weekOf(new Date(2026, 5, 28))).toBe(weekOf(new Date(2026, 5, 22)));
  });

  it('sameLocalDay 比较本地同一天', () => {
    const now = new Date(2026, 5, 24, 12, 0);
    expect(sameLocalDay(new Date(2026, 5, 24, 8, 0).toISOString(), now)).toBe(true);
    expect(sameLocalDay(new Date(2026, 5, 23, 23, 0).toISOString(), now)).toBe(false);
  });
});
