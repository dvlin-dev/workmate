import { Check } from 'lucide-react';
import type { ToolTraceItem } from '@shared/types';

/** "看得见 agent 在干活"：把本轮 toolTrace 渲染成行内提示（工具完成后逐条出现） */
export function ToolHint({ items }: { items: ToolTraceItem[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border-muted/70 bg-muted/40 px-2.5 py-1.5">
      {items.map((item, i) => (
        <div
          key={`${i}-${item.summary}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Check className="size-3 shrink-0 text-success" strokeWidth={2.5} />
          <span className="truncate">{item.summary}</span>
        </div>
      ))}
    </div>
  );
}
