import { FileText, ListTree, MessageSquare } from 'lucide-react';
import { useScrollReveal, useScrollRevealGroup } from '../hooks/useScrollReveal';

const STEPS = [
  {
    icon: MessageSquare,
    title: '随口说给我听',
    desc: '这周想做啥、刚推进了啥，像发消息一样讲给我就行——不用填表、不用建卡片。一段话，我就把这周的目标给你立起来。',
  },
  {
    icon: ListTree,
    title: '我帮你盯着往前走',
    desc: '我把它们理成一张周目标清单，你随口同步一句，我就知道是哪件事、推到哪了。谁好几天没动静，我会主动来问你一句、推你一把。',
  },
  {
    icon: FileText,
    title: '到点提醒，周五交周报',
    desc: '该记的待办我写进「提醒事项」，到点系统喊你；周五你说一句，我把这周每件事做到哪、卡在哪，写成一份能直接发的周报。',
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
            你只管说，剩下的交给我
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            唯一要做的就是像聊天一样跟我说说。那张目标清单是我替你盯着、替你更新的，不用你一格格手动拖——这就是搭子和普通效率工具的区别。
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
