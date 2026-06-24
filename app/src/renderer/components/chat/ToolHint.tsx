import { Check, TriangleAlert } from 'lucide-react';
import type { ToolTraceItem } from '@shared/types';
import { cn } from '../../lib/utils';
import { Loader } from '../ui/loader';

/**
 * "看得见 agent 在干活"：把本轮 toolTrace 渲染成行内清单（工具完成后逐条出现）。
 * 失败项（ok===false）用告警样式区分，不再混作绿勾；pending 时末尾追加转圈「正在处理…」，
 * 让用户清楚搭子还没结束、仍在执行后续动作。
 */
export function ToolHint({ items, pending = false }: { items: ToolTraceItem[]; pending?: boolean }) {
  if (!items.length && !pending) return null;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border-muted/70 bg-muted/40 px-2.5 py-1.5">
      {items.map((item, i) => {
        const failed = item.ok === false;
        return (
          <div
            key={`${i}-${item.summary}`}
            className={cn(
              'flex items-center gap-1.5 text-xs',
              failed ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'
            )}
          >
            {failed ? (
              <TriangleAlert className="size-3 shrink-0" strokeWidth={2.5} />
            ) : (
              <Check className="size-3 shrink-0 text-success" strokeWidth={2.5} />
            )}
            <span className="truncate">{item.summary}</span>
          </div>
        );
      })}
      {pending && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader size={12} className="shrink-0" />
          <span>正在处理…</span>
        </div>
      )}
    </div>
  );
}
