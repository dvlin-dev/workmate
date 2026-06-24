import { Download, Github } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { DOWNLOAD_URL, GITHUB_URL } from '../lib/site';

export function DownloadCTA() {
  const ref = useScrollReveal<HTMLDivElement>({ animation: 'scale-up', duration: 600 });
  return (
    <section className="px-4 py-24 sm:px-6">
      <div
        ref={ref}
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border/60 bg-card px-6 py-16 text-center shadow-sm"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--gradient-hero-glow)' }}
        />
        <div className="relative">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">现在就找个搭子，一起把这周搞定</h2>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            macOS 桌面应用，开源免费，数据全部本地。配置自己的 LLM key 即可开跑。
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ButtonLink href={DOWNLOAD_URL} variant="brand">
              <Download size={18} /> 下载 for macOS
            </ButtonLink>
            <ButtonLink href={GITHUB_URL} variant="outline">
              <Github size={18} /> 在 GitHub 上查看
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
