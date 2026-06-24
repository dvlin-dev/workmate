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
            把这周的目标，交给搭子盯着
          </h2>
          <p className="mx-auto mb-9 max-w-xl leading-relaxed text-muted-foreground">
            下载 macOS App，说出第一个目标，看看搭子怎么替你盯住推进、停滞时推你一把、周五把这周复盘成周报。在设置页填入你的 LLM Key（OpenAI 兼容服务，可自定义 baseURL）即可开跑——完全免费、开源、数据只留在你这台 Mac 上。
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
