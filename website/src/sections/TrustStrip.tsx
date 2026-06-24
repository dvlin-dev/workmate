import { HardDrive, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ITEMS: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldCheck, label: '开源免费，代码全公开' },
  { icon: HardDrive, label: '数据 100% 本地，不上云' },
  { icon: KeyRound, label: 'BYOK 自带 Key，provider 可换' },
  { icon: Sparkles, label: '没填 Key 也能用 mock 跑通' },
];

export function TrustStrip() {
  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12">
        {ITEMS.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-2 text-sm text-tertiary">
            <Icon size={16} className="shrink-0 text-brand" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
