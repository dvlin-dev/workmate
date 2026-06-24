import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

/** 轻量勾选框（不依赖 radix），用于看板人工勾选待办 */
export function Checkbox({
  checked,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        'grid size-4 shrink-0 place-content-center rounded-md border border-border text-primary-foreground transition-all duration-fast hover:border-primary',
        checked && 'border-primary bg-primary',
        className
      )}
    >
      {checked && <Check className="size-3 animate-scale-in" strokeWidth={2.5} />}
    </button>
  );
}
