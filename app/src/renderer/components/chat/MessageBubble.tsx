import { memo } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import type { ToolTraceItem } from '@shared/types';
import { Markdown } from '../ui/markdown';
import { Loader } from '../ui/loader';
import { useCopy } from '../../lib/useCopy';
import { messageText, useChatStore, type ChatMessage, type MessagePart } from '../../store/useChatStore';
import { ToolHint } from './ToolHint';

function CopyButton({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      aria-label="复制"
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/**
 * 有序 parts → 渲染块：相邻工具合并成一个清单块（保留 Workmate 的勾选清单观感），
 * 文字各自成块，整体严格按到达顺序——这是修复"工具堆顶上、文字堆底下"的关键。
 */
type Block = { kind: 'text'; text: string } | { kind: 'tools'; items: ToolTraceItem[] };

function toBlocks(parts: MessagePart[]): Block[] {
  const blocks: Block[] = [];
  for (const part of parts) {
    if (part.kind === 'text') {
      blocks.push({ kind: 'text', text: part.text });
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'tools') last.items.push(part.item);
      else blocks.push({ kind: 'tools', items: [part.item] });
    }
  }
  return blocks;
}

function MessageBubbleImpl({ message }: { message: ChatMessage }) {
  const retry = useChatStore((s) => s.retry);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl bg-secondary px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
          {messageText(message)}
        </div>
      </div>
    );
  }

  const blocks = toBlocks(message.parts);
  const pending = !!message.pending;
  const lastIndex = blocks.length - 1;
  const fullText = messageText(message);

  return (
    <div className="group flex w-full flex-col gap-2">
      {blocks.map((block, i) => {
        const isLast = i === lastIndex;
        if (block.kind === 'tools') {
          // 末尾的工具块在 pending 时显示「正在处理…」转圈行
          return <ToolHint key={`tools-${i}`} items={block.items} pending={pending && isLast} />;
        }
        // 末尾文字块且仍在流式：纯文本 + 光标（避免每个 delta 全量解析半截 markdown）；否则 markdown 定稿
        return pending && isLast ? (
          <div
            key={`text-${i}`}
            className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
          >
            {block.text}
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full bg-foreground/50 align-middle" />
          </div>
        ) : (
          <Markdown key={`text-${i}`}>{block.text}</Markdown>
        );
      })}

      {/* 还没产出任何片段：独立的「思考中」提示 */}
      {blocks.length === 0 && pending && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader size={15} /> 搭子正在思考…
        </span>
      )}

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

      {!pending && !message.errorText && fullText && (
        <div className="-mt-1">
          <CopyButton text={fullText} />
        </div>
      )}
    </div>
  );
}

/**
 * memo：流式每个 chunk 只让 patch 替换过对象的"那一条"气泡重渲染；
 * 历史里引用未变的消息整体跳过（避免长对话里每秒多次全量重渲染）。
 */
export const MessageBubble = memo(MessageBubbleImpl);
