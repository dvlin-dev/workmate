import { BellRing, FileText, Target, TrendingUp } from 'lucide-react';
import { useScrollReveal, useScrollRevealGroup } from '../hooks/useScrollReveal';

const FEATURES = [
  {
    icon: Target,
    title: '目标捕获，看板自动生成',
    desc: '说一段话，搭子用工具把它拆成「周目标树」，看板自动长出来。你不用建卡片、不用填字段——目标从此不再只躺在脑子里。',
  },
  {
    icon: TrendingUp,
    title: '进度归因，进度条自己动',
    desc: '干活途中随口说一句「单测补到 60% 了」，搭子自动判断该归到哪个目标、更新进度并落一条进度事件。多目标也归得准，不确定时它会先反问。',
  },
  {
    icon: FileText,
    title: '一键周报，叙事不是清单',
    desc: '以这一周的进度流为唯一原料，生成「完成 / 亮点 / 卡点 / 下周计划」四段式叙事周报，平实第一人称，可直接发同事，一键复制。',
  },
  {
    icon: BellRing,
    title: '提醒事项，系统按时提醒',
    desc: '拆出的带日期待办单向写入 macOS「提醒事项」，交给系统在该提醒时喊你。同一条待办幂等写入，不会重复打扰，也不动你原有的清单。',
  },
];

export function Features() {
  const headRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up' });
  const ref = useScrollRevealGroup<HTMLDivElement>({ animation: 'scale-up', stagger: 90 });
  return (
    <section id="features" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div ref={headRef} className="mb-12 text-center">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
            一条闭环：录入 → 归因 → 提醒 → 周报
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            每张卡都对应桌面端真实在做的事，环环为下一步服务，不是 PPT 上的功能。
          </p>
        </div>
        <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              data-reveal-item
              className="flex gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-xs transition-shadow duration-300 hover:shadow-md"
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
