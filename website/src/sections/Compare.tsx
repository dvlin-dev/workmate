import { Check } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const DIMENSIONS = [
  {
    label: '录入方式',
    legacy: '手动建卡片、填字段、拖动状态，录入成本高，建好没几天就荒废。',
    mate: '只说一句话，看板由搭子替你维护，你根本不用碰卡片。',
  },
  {
    label: '进度记录',
    legacy: '靠自觉手动更新百分比、勾选状态，干到一半的进展常常没人记。',
    mate: '随口同步一句，搭子自动归因到对应目标、更新进度并落一条进度事件。',
  },
  {
    label: '写周报',
    legacy: '周五对着空文档硬回忆，把一周挤成三行流水账。',
    mate: '一句话生成四段式叙事周报，原料是这一周你说过的每条进展。',
  },
];

export function Compare() {
  const headRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up' });
  const gridRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up', delay: 100 });

  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div ref={headRef} className="mb-12 text-center">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
            为什么是工作搭子，而不是又一个 Todo
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            同样是管理一周的事，差别在于「谁来维护那张看板」。
          </p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 传统方式 */}
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-xs sm:p-7">
            <h3 className="mb-5 text-base font-semibold text-muted-foreground">
              传统 Todo / 手写周报
            </h3>
            <ul className="flex flex-col gap-5">
              {DIMENSIONS.map((d) => (
                <li key={d.label}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-tertiary">
                    {d.label}
                  </p>
                  <div className="flex gap-2.5">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border" />
                    <p className="text-sm leading-relaxed text-muted-foreground">{d.legacy}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Workmate */}
          <div className="rounded-2xl border border-brand/20 bg-brand/5 p-6 shadow-sm sm:p-7">
            <h3 className="mb-5 text-base font-semibold">
              <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
                Workmate 工作搭子
              </span>
            </h3>
            <ul className="flex flex-col gap-5">
              {DIMENSIONS.map((d) => (
                <li key={d.label}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-brand">
                    {d.label}
                  </p>
                  <div className="flex gap-2.5">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <p className="text-sm leading-relaxed text-foreground">{d.mate}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-tertiary">
          Workmate 专注单机单用户的个人复盘闭环——仅 macOS、与「提醒事项」为单向写入，不做云同步与多人协作。
          要的是团队看板，它不是替代品；要的是一个替自己记进展、写周报的搭子，它正合适。
        </p>
      </div>
    </section>
  );
}
