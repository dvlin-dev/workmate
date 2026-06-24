import { describe, it, expect } from 'vitest';
import { WorkmateStore, createEmptyData } from '../src/main/store';
import { WorkmateDataSchema } from '../src/shared/schema';

const now = () => new Date(2026, 5, 24, 10, 0, 0);

describe('WorkmateDataSchema · 加载校验（语义损坏防护）', () => {
  it('拒绝结构损坏（weeks 非数组）', () => {
    const bad = { version: 1, weeks: 'oops', config: {} };
    expect(WorkmateDataSchema.safeParse(bad).success).toBe(false);
  });

  it('空对象被补默认（version/weeks/config）', () => {
    const parsed = WorkmateDataSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.weeks).toEqual([]);
      expect(parsed.data.config.llm.baseURL).toBeTruthy();
    }
  });

  it('剥离未知键、保留合法 week', () => {
    const parsed = WorkmateDataSchema.safeParse({
      version: 1,
      weeks: [{ weekOf: '2026-06-22', goals: [], events: [], extra: 'x' }],
      config: {},
      junk: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.weeks).toHaveLength(1);
      expect('junk' in parsed.data).toBe(false);
    }
  });
});

describe('config schema · 拒绝空 baseURL/model', () => {
  it('setConfig 空 model 抛错（不静默写空串）', () => {
    const store = new WorkmateStore({ initial: createEmptyData(), now });
    expect(() => store.setConfig({ llm: { model: '' } })).toThrow();
    // 抛错后原值不变
    expect(store.getConfig().llm.model.length).toBeGreaterThan(0);
  });

  it('setConfig 允许空 apiKey（走 mock）', () => {
    const store = new WorkmateStore({ initial: createEmptyData(), now });
    const cfg = store.setConfig({ llm: { apiKey: '' } });
    expect(cfg.llm.apiKey).toBe('');
  });
});

describe('nudge 节流状态持久化', () => {
  it('markNudgeSent / getNudgeLastSent 往返', () => {
    let persisted: unknown = null;
    const store = new WorkmateStore({
      initial: createEmptyData(),
      now,
      persist: (d) => {
        persisted = d;
      },
    });
    store.markNudgeSent('friday', '2026-6-26');
    expect(store.getNudgeLastSent().friday).toBe('2026-6-26');
    expect((persisted as { nudgeLastSent?: Record<string, string> })?.nudgeLastSent?.friday).toBe(
      '2026-6-26'
    );
  });
});

describe('findGoals · 严格匹配（不再 2-gram 误命中）', () => {
  it('清洗后的 query 命中，但不相关词不命中', () => {
    const store = new WorkmateStore({ initial: createEmptyData(), now });
    store.createGoal('做完登录联调');
    store.createGoal('写设计文档');
    expect(store.findGoals('登录联调')).toHaveLength(1);
    expect(store.findGoals('设计')).toHaveLength(1);
    // '登录' 与 '设计文档' 无公共词，不应命中后者
    expect(store.findGoals('登录').every((g) => g.title.includes('登录'))).toBe(true);
  });
});
