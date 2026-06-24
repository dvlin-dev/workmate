import { useScrollReveal, useScrollRevealGroup } from '../hooks/useScrollReveal';

const PROBLEMS = [
  {
    emoji: '🧠',
    title: '计划只在脑子里，越想越乱',
    desc: '本周要做的几件事，散在便利贴、群消息和半截文档里，从没被结构化成一张能看清全貌的目标树。想拉个看板，又懒得一张张拖卡片、填字段。',
  },
  {
    emoji: '🌫️',
    title: '进展随手就忘，没人替你记',
    desc: '「连接池那个 bug 今天定位到了」——说完就埋头继续干。一整天推进了一堆，到了晚上却想不起白天到底做成了什么。',
  },
  {
    emoji: '📝',
    title: '周五对着空文档，全靠硬回忆',
    desc: '翻 commit、扒聊天记录、对着空白文档发呆，把一周努力挤成三行流水账。明明做了很多，写出来却像没干活。',
  },
];

export function Problem() {
  const headRef = useScrollReveal<HTMLHeadingElement>({ animation: 'fade-up' });
  const ref = useScrollRevealGroup<HTMLDivElement>({ stagger: 100 });
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <h2 ref={headRef} className="mb-12 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          周报难写，不是因为你这周没干活
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
