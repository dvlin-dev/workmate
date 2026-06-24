import { Wrench } from 'lucide-react';
import type { ToolTraceItem } from '@shared/types';

/** "看得见 agent 在干活"：把本轮 toolTrace 渲染成行内提示 */
export function ToolHint({ items }: { items: ToolTraceItem[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-0.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wrench className="size-3 shrink-0" />
          <span>{item.summary}</span>
        </div>
      ))}
    </div>
  );
}
