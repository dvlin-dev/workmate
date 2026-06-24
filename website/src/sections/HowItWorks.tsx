import { FileText, ListTree, MessageSquare } from 'lucide-react';
import { useScrollRevealGroup } from '../hooks/useScrollReveal';

const STEPS = [
  {
    icon: MessageSquare,
    title: '自然语言随手说',
    desc: '"这周要做完登录联调""文档写完了"——像聊天一样，唯一的输入方式就是说话。',
  },
  {
    icon: ListTree,
    title: 'AI 结构化成周目标树',
    desc: 'agent 自动建目标、归因进度，右侧看板实时反映。看板是 AI 替你维护的产物，不用手动拖。',
  },
  {
    icon: FileText,
    title: '一键周报 + 写入提醒',
    desc: '周五一键生成叙事性周报；拆出的待办单向写进 macOS「提醒事项」，由系统按时提醒。',
  },
];

export function HowItWorks() {
  const ref = useScrollRevealGroup<HTMLDivElement>({ stagger: 120 });
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-3 text-center text-2xl font-bold sm:text-3xl">三步，把计划→执行→复盘串成闭环</h2>
        <p className="mb-12 text-center text-muted-foreground">低摩擦：你只管说，结构化交给搭子。</p>
        <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              data-reveal-item
              className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-xs"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-white">
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
