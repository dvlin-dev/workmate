import type { AnchorHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'brand' | 'outline';

const VARIANTS: Record<Variant, string> = {
  brand: 'bg-foreground text-background hover:bg-foreground/90 hover:shadow-lg',
  outline: 'border border-border bg-card text-foreground hover:border-brand/40 hover:shadow-md',
};

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
}

/** 营销页 CTA 按钮（锚点） */
export function ButtonLink({ variant = 'brand', className, ...props }: ButtonLinkProps) {
  return (
    <a
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3 text-base font-medium transition-all',
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
