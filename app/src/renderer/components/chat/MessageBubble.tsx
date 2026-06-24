import { useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { Markdown } from '../ui/markdown';
import { Loader } from '../ui/loader';
import { useChatStore, type ChatMessage } from '../../store/useChatStore';
import { ToolHint } from './ToolHint';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label="复制"
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const retry = useChatStore((s) => s.retry);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl bg-secondary px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  const hasTrace = (message.toolTrace?.length ?? 0) > 0;
  const showThinking = message.pending && !message.text && !hasTrace;

  return (
    <div className="group flex w-full flex-col gap-2">
      {showThinking && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader size={15} /> 搭子正在思考…
        </span>
      )}

      {hasTrace && <ToolHint items={message.toolTrace!} />}

      {message.text &&
        (message.pending ? (
          // 流式进行中：纯文本渲染，避免每个 delta 全量解析半截 markdown（性能 + 防闪烁）
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {message.text}
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full bg-foreground/50 align-middle" />
          </div>
        ) : (
          <Markdown>{message.text}</Markdown>
        ))}

      {message.errorText && (
        <div className="flex flex-col items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{message.errorText}</span>
          <button
            type="button"
            onClick={() => void retry(message.id)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium hover:bg-destructive/10"
          >
            <RotateCcw className="size-3" /> 重试
          </button>
        </div>
      )}

      {!message.pending && !message.errorText && message.text && (
        <div className="-mt-1">
          <CopyButton text={message.text} />
        </div>
      )}
    </div>
  );
}
