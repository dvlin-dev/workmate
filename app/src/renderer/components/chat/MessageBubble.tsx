import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Markdown } from '../ui/markdown';
import type { ChatMessage } from '../../store/useChatStore';
import { ToolHint } from './ToolHint';

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  const hasTrace = (message.toolTrace?.length ?? 0) > 0;
  // 仅在「还没有任何内容」时显示转圈；一旦有文字/工具足迹就流式展示
  const showSpinner = message.pending && !message.text && !hasTrace;

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[90%] rounded-2xl px-3 py-2',
          message.error ? 'bg-destructive/10 text-destructive' : 'bg-muted'
        )}
      >
        {showSpinner ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 搭子正在处理…
          </span>
        ) : (
          <>
            {hasTrace && <ToolHint items={message.toolTrace!} />}
            {message.text && (
              <div className={cn(hasTrace && 'mt-1.5')}>
                <Markdown>{message.text}</Markdown>
                {message.pending && (
                  <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-foreground/60 align-middle" />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
