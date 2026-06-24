import { FileText, ListTree, MessageSquare } from 'lucide-react';
import { useScrollReveal, useScrollRevealGroup } from '../hooks/useScrollReveal';

const STEPS = [
  {
    icon: MessageSquare,
    title: '随手说出目标和进展',
    desc: '把本周的安排、刚刚的进展像发消息一样讲给搭子听，不用填表、不用建卡片、不用打标签。一段话就能建出整周看板。',
  },
  {
    icon: ListTree,
    title: '搭子结构化 + 自动归因',
    desc: '搭子用一组工具把内容拆成「周目标树」，看板实时反映；你随口同步一句，它就归因到对应目标、更新进度条。带日期的待办顺手写入「提醒事项」。',
  },
  {
    icon: FileText,
    title: '周五一键生成周报',
    desc: '整周每次录入和归因都记成一条进度事件，成为周报唯一原料。一句「生成周报」，得到「完成 / 亮点 / 卡点 / 下周」四段式叙事周报，一键复制就能发。',
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
            你只需要做一件事：说话
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            唯一的输入方式就是像聊天一样「说」。结构化看板是搭子替你维护的产物，不是你要手动拖拽的对象——这是它和普通效率软件的根本区别。
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
