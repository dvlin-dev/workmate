import { useState } from 'react';
import { BellRing, Check, Copy, Wrench } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useInView } from '../hooks/useInView';
import { DEMO_CHAT, DEMO_GOALS, DEMO_REPORT, type DemoGoal } from '../lib/demo';

/* ── 左栏：对话流 ── */
function ChatColumn() {
  const ref = useScrollReveal<HTMLDivElement>({ animation: 'slide-left', duration: 700 });
  return (
    <div ref={ref} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <p className="mb-4 text-xs font-semibold text-tertiary">
        <span aria-hidden="true">💬 </span>你和搭子的对话
      </p>
      <div className="flex flex-col gap-3">
        {DEMO_CHAT.map((turn, i) =>
          turn.role === 'user' ? (
            <div key={i} className="flex flex-col items-end gap-1">
              {turn.day && (
                <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-tertiary">
                  {turn.day}
                </span>
              )}
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-[13px] leading-relaxed text-background">
                {turn.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-start gap-1.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-light text-[10px] font-bold text-white">
                  W
                </span>
                <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-border/60 bg-background/50 px-3.5 py-2 text-[13px] leading-relaxed">
                  {turn.text}
                </div>
              </div>
              {turn.tool && (
                <span className="ml-8 inline-flex items-center gap-1.5 rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                  <Wrench size={10} />
                  {turn.tool}
                </span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ── 右栏：周目标看板（进入视口时进度条填充） ── */
function GoalCard({ goal, active }: { goal: DemoGoal; active: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{goal.title}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
          进行中 · {goal.progress}%
        </span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: active ? `${goal.progress}%` : '0%' }}
        />
      </div>
      <ul className="flex flex-col gap-1.5">
        {goal.tasks.map((task) => (
          <li key={task.title} className="flex items-center gap-2 text-xs">
            <span
              className={
                task.done
                  ? 'flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success'
                  : 'size-4 shrink-0 rounded-[5px] border border-border'
              }
            >
              {task.done && <Check size={11} strokeWidth={3} />}
            </span>
            <span className={task.done ? 'text-muted-foreground line-through' : 'text-foreground'}>
              {task.title}
            </span>
            {task.due && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {task.reminder && <BellRing size={9} aria-hidden="true" />}
                {task.due}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KanbanColumn() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  return (
    <div ref={ref} className="lg:sticky lg:top-24">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold text-tertiary">
            <span aria-hidden="true">📋 </span>本周目标看板
          </p>
          <span className="text-[10px] text-tertiary">搭子自动维护</span>
        </div>
        <div className="flex flex-col gap-3">
          {DEMO_GOALS.map((goal) => (
            <GoalCard key={goal.title} goal={goal} active={inView} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 底部：一键生成的周报卡 ── */
function reportToPlainText() {
  const lines = [`# 本周周报（${DEMO_REPORT.range}）`, ''];
  for (const s of DEMO_REPORT.sections) {
    lines.push(`## ${s.heading}`);
    for (const item of s.items) lines.push(`- ${item}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function ReportCard() {
  const ref = useScrollReveal<HTMLDivElement>({ animation: 'fade-up', duration: 700 });
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportToPlainText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 忽略：演示环境无剪贴板权限时静默 */
    }
  };

  return (
    <div ref={ref} className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      {/* macOS 窗饰 + 操作 */}
      <div className="flex items-center justify-between border-b border-border-muted px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="ml-3 text-xs text-tertiary">周五 · 一键生成</span>
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>

      {/* 周报正文（仿 markdown 渲染） */}
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <h3 className="mb-5 text-lg font-bold tracking-tight">本周周报（{DEMO_REPORT.range}）</h3>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {DEMO_REPORT.sections.map((s) => (
            <div key={s.heading}>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-brand to-brand-light" />
                {s.heading}
              </h4>
              <ul className="flex flex-col gap-1.5">
                {s.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-brand/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DemoShowcase() {
  const headRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up' });
  return (
    <section id="demo" className="px-4 py-20 sm:px-6 sm:py-28" style={{ background: 'var(--gradient-section-subtle)' }}>
      <div className="mx-auto max-w-6xl">
        <div ref={headRef} className="mb-12 text-center">
          <span className="mb-3 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            真实演示
          </span>
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            看一名工程师的一周：订单服务 v2 重构
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            从周一一段话建好看板，到周五一键出周报——同一条进度流，全程他只是在「说话」。左边是对话，右边是看板被搭子一步步维护出来的样子。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ChatColumn />
          </div>
          <div className="lg:col-span-5">
            <KanbanColumn />
          </div>
        </div>

        <ReportCard />

        <p className="mt-5 text-center text-sm text-tertiary">
          这份周报的唯一原料，就是这一周里你随口说出的每一条进展。
        </p>
      </div>
    </section>
  );
}
