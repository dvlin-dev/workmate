import { BellRing, FileText, Target, TrendingUp } from 'lucide-react';
import { useScrollRevealGroup } from '../hooks/useScrollReveal';

const FEATURES = [
  {
    icon: Target,
    title: '目标捕获',
    desc: '说一句话，agent 拆成周目标树，看板自动生成。',
  },
  {
    icon: TrendingUp,
    title: '进度归因',
    desc: '干活途中口语化同步，agent 归因到对应目标、更新进度。',
  },
  {
    icon: FileText,
    title: '一键周报',
    desc: '基于一周进度流，生成完成 / 亮点 / 卡点 / 下周计划的叙事周报。',
  },
  {
    icon: BellRing,
    title: 'macOS 提醒同步',
    desc: '拆出的待办单向写入「提醒事项」，由系统按时提醒你。',
  },
];

export function Features() {
  const ref = useScrollRevealGroup<HTMLDivElement>({ stagger: 90 });
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-2xl font-bold sm:text-3xl">一个搭子，覆盖完整闭环</h2>
        <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              data-reveal-item
              className="flex gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-xs"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <f.icon size={20} />
              </div>
              <div>
                <h3 className="mb-1.5 text-base font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
