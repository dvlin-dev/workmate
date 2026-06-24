import { Download, Github, Sparkles } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { DOWNLOAD_URL, GITHUB_URL } from '../lib/site';

export function Hero() {
  const eyebrowRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up', duration: 700 });
  const titleRef = useScrollReveal<HTMLHeadingElement>({ animation: 'fade-up', delay: 60, duration: 700 });
  const subRef = useScrollReveal<HTMLParagraphElement>({ animation: 'fade-up', delay: 140, duration: 700 });
  const ctaRef = useScrollReveal<HTMLDivElement>({ animation: 'fade-up', delay: 220, duration: 700 });

  return (
    <section id="top" className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-44">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--gradient-hero-glow)' }}
      />
      <div className="relative mx-auto max-w-5xl text-center">
        <div ref={eyebrowRef} className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles size={13} className="text-brand" aria-hidden="true" />
            你的 AI 工作搭子 · 仅 macOS · 开源免费
          </span>
        </div>

        <h1
          ref={titleRef}
          className="mb-6 text-4xl font-extrabold leading-[1.12] tracking-tight text-foreground sm:text-5xl md:text-6xl"
        >
          这周的目标，
          <br />
          <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
            我陪你一件件做完
          </span>
        </h1>

        <p
          ref={subRef}
          className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          这周想做啥，随口跟我说一声——我帮你记上、理清楚，盯着一项项往前走，哪个好几天没动静，我比你还急、会喊你一声。到周五？周报我也顺手给你攒好了。
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
          完全免费 · 开源 · 数据只存在你这台 Mac 上 · 自带你的 LLM Key
        </p>
      </div>
    </section>
  );
}
