import { useScrollReveal, useScrollRevealGroup } from '../hooks/useScrollReveal';

const PROBLEMS = [
  {
    emoji: '🎯',
    title: '目标定了，就没人盯了',
    desc: '周一立的几个目标，记在便利贴和文档里，没几天就没人回看。它们从不被结构化，也没人替你跟踪到底推进到哪了。',
  },
  {
    emoji: '🐌',
    title: '进展无人推，目标悄悄停摆',
    desc: '一忙就忘了某个目标好几天没动。等想起来，deadline 已经贴脸——没人在它停滞时提醒你、推你一把。',
  },
  {
    emoji: '📉',
    title: '周五才发现，这周没怎么推进',
    desc: '回看一周，说不清每个目标到底走了多远。写周报时对着空文档硬回忆，把零散努力挤成三行流水账。',
  },
];

export function Problem() {
  const headRef = useScrollReveal<HTMLHeadingElement>({ animation: 'fade-up' });
  const ref = useScrollRevealGroup<HTMLDivElement>({ stagger: 100 });
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 ref={headRef} className="mb-12 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          定目标不难，难的是有人替你盯着它往前走
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
