import { Download, Github } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { DOWNLOAD_URL, GITHUB_URL } from '../lib/site';

export function DownloadCTA() {
  const ref = useScrollReveal<HTMLDivElement>({ animation: 'scale-up', duration: 600 });
  return (
    <section id="download" className="px-4 py-24 sm:px-6">
      <div
        ref={ref}
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border/60 bg-card px-6 py-16 text-center shadow-sm"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--gradient-hero-glow)' }}
        />
        <div className="relative">
          <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
            把这一周，交给你的工作搭子
          </h2>
          <p className="mx-auto mb-9 max-w-xl leading-relaxed text-muted-foreground">
            下载 macOS App，说出第一句计划，看看看板怎么自己长出来、周报怎么自己写出来。设置页填入你的 LLM Key 即全功能启用，没填也能用内置 mock 先把整套闭环跑通——体验过再决定。
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ButtonLink href={DOWNLOAD_URL} variant="brand">
              <Download size={18} /> 下载 macOS App
            </ButtonLink>
            <ButtonLink href={GITHUB_URL} variant="outline">
              <Github size={18} /> 在 GitHub 查看源码
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-tertiary">完全免费 · 开源 · 数据全部本地 · 仅支持 macOS</p>
        </div>
      </div>
    </section>
  );
}
