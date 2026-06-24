import { useScrollReveal, useScrollRevealGroup } from '../hooks/useScrollReveal';

const PROBLEMS = [
  {
    emoji: '🎯',
    title: '周一立的 flag，周中就忘',
    desc: '周一信誓旦旦定下几件事，记在便利贴和文档里，忙起来没几天就没再翻过。没人替你盯着，目标就这么悄悄凉了。',
  },
  {
    emoji: '🌊',
    title: '群里 @ 你的事，划走就没了',
    desc: '开完会消息 99+，@你的关键待办夹在闲聊里，手一划就沉底。等想起来，deadline 已经贴到脸上。',
  },
  {
    emoji: '📄',
    title: '周五对着空文档，硬挤周报',
    desc: '回看一周，说不清每件事到底走到哪了。翻 commit、扒聊天记录，把零散的努力挤成三行流水账——明明做了不少，写出来却像没干活。',
  },
];

export function Problem() {
  const headRef = useScrollReveal<HTMLHeadingElement>({ animation: 'fade-up' });
  const ref = useScrollRevealGroup<HTMLDivElement>({ stagger: 100 });
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 ref={headRef} className="mb-12 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          这些是不是也戳到你了？
        </h2>
        <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div
              key={p.title}
              data-reveal-item
              className="rounded-2xl border border-border/60 bg-card p-6 text-center shadow-xs"
            >
              <div className="mb-3 text-3xl" aria-hidden="true">{p.emoji}</div>
              <h3 className="mb-2 text-base font-semibold">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
