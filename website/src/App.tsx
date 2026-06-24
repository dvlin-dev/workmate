import { Download } from 'lucide-react';
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { HowItWorks } from './sections/HowItWorks';
import { Features } from './sections/Features';
import { DownloadCTA } from './sections/DownloadCTA';
import { Footer } from './sections/Footer';
import { DOWNLOAD_URL } from './lib/site';

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border-muted/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-light text-xs text-white">
            W
          </span>
          Workmate
        </a>
        <a
          href={DOWNLOAD_URL}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <Download size={15} /> 下载
        </a>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <DownloadCTA />
      </main>
      <Footer />
    </div>
  );
}
