import { AlarmClock, FileText, ListChecks, Target, TrendingUp } from 'lucide-react';
import { useScrollReveal, useScrollRevealGroup } from '../hooks/useScrollReveal';

const FEATURES = [
  {
    icon: Target,
    title: '一句话，目标就立住了',
    desc: '说一段话，我帮你拆成一张周目标清单，看板自己长出来。不用建卡片、不用填字段——目标从此不只躺在你脑子里。',
  },
  {
    icon: TrendingUp,
    title: '随口一说，进度我来更',
    desc: '干活间隙撂一句「单测补到 60% 了」，我自己判断是哪件事、更新进度、记上一笔。几件事同时推也认得清，拿不准我会先问你一句。',
  },
  {
    icon: AlarmClock,
    title: '谁停摆了，我比你还急',
    desc: '某个目标一阵没动静，我会主动来问一句、推你一把；傍晚还没记录也轻轻提醒你。目标不会立了就晾在那儿发霉。',
  },
  {
    icon: ListChecks,
    title: '该提醒的，我写进提醒事项',
    desc: '带日期的待办我单向写进 macOS「提醒事项」，到点让系统喊你。同一条只写一次，不重复打扰，也不动你原来的清单。',
  },
  {
    icon: FileText,
    title: '周报？早替你攒好了',
    desc: '这一周你说过的每条进展都是我的素材，到周五自动写成「完成 / 亮点 / 卡点 / 下周计划」四段叙事周报，一键复制就能发。',
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
            从立目标到陪你做完，我全程在
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            立目标 → 更进度 → 催你一把 → 到点提醒 → 写周报，每件都是我在桌面端真实替你干的事，环环把目标往前推。
          </p>
        </div>
        <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
