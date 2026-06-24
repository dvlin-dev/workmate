import { Download, Github } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { DOWNLOAD_URL, GITHUB_URL } from '../lib/site';

/** 两栏 App 预览（CSS 拟真，替代真实截图） */
function AppMock() {
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl">
      <div className="flex h-8 items-center gap-1.5 border-b border-border-muted px-4">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 text-left sm:grid-cols-9">
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:col-span-5">
          <p className="text-xs font-semibold text-muted-foreground">💬 搭子对话</p>
          <div className="ml-auto max-w-[80%] rounded-2xl bg-primary px-3 py-1.5 text-xs text-primary-foreground">
            登录联调跟前端搞通了
          </div>
          <div className="max-w-[85%] rounded-2xl bg-muted px-3 py-1.5 text-xs">
            搞定 👍 登录联调更新到 60% 了～
          </div>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            🔧 进度更新到 60%
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:col-span-4">
          <p className="text-xs font-semibold text-muted-foreground">📋 本周目标</p>
          {[
            { t: '登录联调', p: 60 },
            { t: '设计文档', p: 25 },
          ].map((g) => (
            <div key={g.t} className="flex flex-col gap-1">
              <span className="text-xs">{g.t}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success" style={{ width: `${g.p}%` }} />
              </div>
            </div>
          ))}
          <div className="mt-1 rounded-lg bg-gradient-to-r from-brand to-brand-light px-3 py-1.5 text-center text-xs font-medium text-white">
            📝 一键生成周报
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const titleRef = useScrollReveal<HTMLHeadingElement>({ animation: 'fade-up', duration: 700 });
  const subRef = useScrollReveal<HTMLParagraphElement>({ animation: 'fade-up', delay: 100, duration: 700 });
  const ctaRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up', delay: 200, duration: 700 });
  const shotRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up', delay: 300, duration: 700 });

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pb-24 sm:pt-40">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--gradient-hero-glow)' }}
      />
      <div className="relative mx-auto max-w-5xl text-center">
        <h1
          ref={titleRef}
          className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl"
        >
          会归因的工作搭子，
          <br />
          <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
            替你把进展写成周报
          </span>
        </h1>
        <p
          ref={subRef}
          className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
        >
          用说话维护周目标 · 一键生成周报 · 拆出的待办写入「提醒事项」。
          <br />
          一个 AI-native 的 macOS 工作搭子。
        </p>
        <div ref={ctaRef} className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href={DOWNLOAD_URL} variant="brand">
            <Download size={18} /> 下载 for macOS
          </ButtonLink>
          <ButtonLink href={GITHUB_URL} variant="outline">
            <Github size={18} /> GitHub 开源
          </ButtonLink>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">免费 · 开源 · 数据全部本地</p>
        <div ref={shotRef} className="mt-16">
          <AppMock />
        </div>
      </div>
    </section>
  );
}
