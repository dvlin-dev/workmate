import { useScrollRevealGroup } from '../hooks/useScrollReveal';

const PROBLEMS = [
  { emoji: '🧠', title: '计划散落在脑子里', desc: '便利贴、文档、脑海，到处都是，从不结构化。' },
  { emoji: '🌫️', title: '进展没被记录', desc: '干活时的推进随手就忘，到周五全靠回忆。' },
  { emoji: '😮‍💨', title: '周报写到崩溃', desc: '回想这周做了啥，像挤牙膏一样拼一篇。' },
];

export function Problem() {
  const ref = useScrollRevealGroup<HTMLDivElement>({ stagger: 100 });
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-2xl font-bold sm:text-3xl">
          普通 todo 软件维护成本太高，很快就荒废
        </h2>
        <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div
              key={p.title}
              data-reveal-item
              className="rounded-2xl border border-border/60 bg-card p-6 text-center shadow-xs"
            >
              <div className="mb-3 text-3xl">{p.emoji}</div>
              <h3 className="mb-1.5 text-base font-semibold">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
