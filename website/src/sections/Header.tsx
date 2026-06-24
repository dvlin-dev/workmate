import { useEffect, useState } from 'react';
import { Download, Github } from 'lucide-react';
import { cn } from '../lib/utils';
import { DOWNLOAD_URL, GITHUB_URL } from '../lib/site';

const NAV = [
  { href: '#demo', label: '看演示' },
  { href: '#how', label: '怎么用' },
  { href: '#features', label: '能力' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={cn('fixed inset-x-0 top-0 z-50 px-4 transition-all duration-300 sm:px-6', scrolled ? 'pt-3' : 'pt-5')}>
      <div
        className={cn(
          'mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 sm:px-5',
          scrolled ? 'border border-border/70 bg-background/80 shadow-sm backdrop-blur-xl' : 'border border-transparent'
        )}
      >
        <a href="#top" className="group flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand to-brand-light text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-105">
            W
          </span>
          <span className="text-[15px] tracking-tight">Workmate</span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="hidden size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
          >
            <Github size={18} />
          </a>
          <a
            href={DOWNLOAD_URL}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-all hover:bg-foreground/90 hover:shadow-md"
          >
            <Download size={15} /> 下载
          </a>
        </div>
      </div>
    </nav>
  );
}
