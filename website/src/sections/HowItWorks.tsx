import { FileText, ListTree, MessageSquare } from 'lucide-react';
import { useScrollReveal, useScrollRevealGroup } from '../hooks/useScrollReveal';

const STEPS = [
  {
    icon: MessageSquare,
    title: '说出目标和进展',
    desc: '把本周想做成的几件事、刚刚的推进像发消息一样讲给搭子听，不用填表、不用建卡片。一段话就能立起整周的目标。',
  },
  {
    icon: ListTree,
    title: '搭子盯住每个目标的推进',
    desc: '内容被拆成「周目标树」，看板实时反映；你随口同步一句，它就归因到对应目标、更新进度。哪个目标停摆了，它主动来问、推你一把。',
  },
  {
    icon: FileText,
    title: '到点提醒，周五顺手复盘',
    desc: '带日期的待办写进「提醒事项」，由系统按时喊你；周五一句「生成周报」，把这周每个目标推进到哪、卡在哪，写成四段式叙事周报。',
  },
];

export function HowItWorks() {
  const headRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up' });
  const ref = useScrollRevealGroup<HTMLDivElement>({ stagger: 120 });
  return (
    <section id="how" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div ref={headRef} className="mb-12 text-center">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
            你只管说，目标交给搭子盯
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            唯一的输入方式就是像聊天一样「说」。目标看板由搭子替你维护和推进，不是你要手动拖拽的对象——这是它和普通效率软件的根本区别。
          </p>
        </div>
        <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              data-reveal-item
              className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-xs"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-white shadow-sm">
                <s.icon size={20} />
              </div>
              <span className="absolute right-5 top-5 text-3xl font-extrabold text-border">
                {i + 1}
              </span>
              <h3 className="mb-2 text-base font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
