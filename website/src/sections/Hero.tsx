import { Download, Github, Sparkles } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { DOWNLOAD_URL, GITHUB_URL } from '../lib/site';

/** 两栏 App 预览（CSS 拟真，作为 Hero 的"产品截图"）。 */
function AppMock() {
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl">
      {/* macOS 窗饰 */}
      <div className="flex h-9 items-center gap-1.5 border-b border-border-muted px-4">
        <span aria-hidden="true" className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="ml-3 text-xs text-tertiary">Workmate · 本周（6/22 ~ 6/28）</span>
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 text-left sm:grid-cols-9">
        {/* 左：对话 */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-background/40 p-3.5 sm:col-span-5">
          <p className="text-[11px] font-semibold text-tertiary">
            <span aria-hidden="true">💬 </span>搭子对话
          </p>
          <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-xs leading-relaxed text-background">
            v2 的单测补了一半，核心下单和退款链路覆盖到 60% 了
          </div>
          <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border/60 bg-card px-3 py-2 text-xs leading-relaxed">
            更新好啦，订单服务 v2 重构整体到 62%，优惠券那条分支我挂成待办～
          </div>
          <p className="inline-flex w-fit items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
            <span aria-hidden="true">🔧</span> update_progress 订单服务 v2 → 62%
          </p>
        </div>

        {/* 右：看板 */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 p-3.5 sm:col-span-4">
          <p className="text-[11px] font-semibold text-tertiary">
            <span aria-hidden="true">📋 </span>本周目标
          </p>
          {[
            { t: '订单服务 v2 重构', p: 62 },
            { t: '修复线上问题', p: 33 },
            { t: '接入监控告警', p: 25 },
          ].map((g) => (
            <div key={g.t} className="flex flex-col gap-1">
              <span className="text-xs font-medium">{g.t}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light"
                  style={{ width: `${g.p}%` }}
                />
              </div>
            </div>
          ))}
          <div className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-brand-light px-3 py-2 text-center text-xs font-medium text-white shadow-sm">
            <span aria-hidden="true">📝</span> 一键生成周报
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const eyebrowRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up', duration: 700 });
  const titleRef = useScrollReveal<HTMLHeadingElement>({ animation: 'fade-up', delay: 60, duration: 700 });
  const subRef = useScrollReveal<HTMLParagraphElement>({ animation: 'fade-up', delay: 140, duration: 700 });
  const ctaRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up', delay: 220, duration: 700 });
  const shotRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up', delay: 300, duration: 700 });

  return (
    <section id="top" className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pb-24 sm:pt-40">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--gradient-hero-glow)' }}
      />
      <div className="relative mx-auto max-w-5xl text-center">
        <div ref={eyebrowRef} className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles size={13} className="text-brand" />
            AI-native · 仅 macOS · 开源免费 · 数据全本地
          </span>
        </div>

        <h1
          ref={titleRef}
          className="mb-6 text-4xl font-extrabold leading-[1.12] tracking-tight text-foreground sm:text-5xl md:text-6xl"
        >
          会归因的工作搭子，
          <br />
          <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
            替你把进展写成周报
          </span>
        </h1>

        <p
          ref={subRef}
          className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          像跟同事聊天一样说出本周目标和进展，搭子替你结构化成「周目标树」、自动归因到对应目标、把带日期的待办写进「提醒事项」——周五一句「生成周报」，叙事性周报直接交付。你只管说，看板它替你维护。
        </p>

        <div ref={ctaRef} className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href={DOWNLOAD_URL} variant="brand">
            <Download size={18} /> 下载 macOS App
          </ButtonLink>
          <ButtonLink href={GITHUB_URL} variant="outline">
            <Github size={18} /> 在 GitHub 查看源码
          </ButtonLink>
        </div>
        <p className="mt-4 text-sm text-tertiary">
          完全免费 · 开源 · 数据只存在你这台 Mac 上 · 没填 Key 也能用内置 mock 跑通闭环
        </p>

        <div ref={shotRef} className="mt-16">
          <AppMock />
        </div>
      </div>
    </section>
  );
}
