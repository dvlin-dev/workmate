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
            AI-native · 用说话管理周目标 · 仅 macOS · 开源
          </span>
        </div>

        <h1
          ref={titleRef}
          className="mb-6 text-4xl font-extrabold leading-[1.12] tracking-tight text-foreground sm:text-5xl md:text-6xl"
        >
          会帮你管目标的工作搭子，
          <br />
          <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
            盯着进度、推你做完
          </span>
        </h1>

        <p
          ref={subRef}
          className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          像聊天一样说出目标和进展，搭子替你结构化成「周目标树」、盯住每一项的推进、停滞了主动推你一把、该提醒时写进「提醒事项」——周五还顺手生成一份叙事周报。你只管说，目标它替你盯。
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
