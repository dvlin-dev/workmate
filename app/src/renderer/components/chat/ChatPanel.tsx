import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useChatStore } from '../../store/useChatStore';
import { MessageBubble } from './MessageBubble';

const SUGGESTIONS = [
  '这周要做完登录联调',
  '帮我把本周的几个目标建一下',
  '刚把设计文档写完了',
  '生成这周的周报',
];

function EmptyHint({ onPick, disabled }: { onPick: (s: string) => void; disabled: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-2 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-light text-2xl shadow-sm">
        💬
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">嗨，我是你的工作搭子</p>
        <p className="text-xs text-muted-foreground">
          说说这周要做什么，或随手同步进展，我帮你记到右边的看板上。
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-brand/40 hover:bg-accent disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const sending = useChatStore((s) => s.sending);
  const send = useChatStore((s) => s.send);
  const cancel = useChatStore((s) => s.cancel);
  const [draft, setDraft] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const onScroll = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    stickToBottom.current = vp.scrollHeight - vp.scrollTop - vp.clientHeight < 80;
  };

  useEffect(() => {
    if (!stickToBottom.current) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 流式逐字期间用 auto 直接贴底，避免 smooth 动画排队导致抖动；轮次结束/新消息用 smooth
    vp.scrollTo({ top: vp.scrollHeight, behavior: reduce || sending ? 'auto' : 'smooth' });
  }, [messages, sending]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || sending) return;
    setDraft('');
    stickToBottom.current = true;
    void send(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return; // 中文输入法选词中，不触发发送
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  };

  return (
    <section className="flex min-w-0 flex-[5] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
      <header className="flex h-11 shrink-0 items-center border-b border-border-muted px-4 text-sm font-semibold">
        💬 搭子对话
      </header>
      <div ref={viewportRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          className="flex min-h-full flex-col gap-5 p-4"
        >
          {messages.length === 0 ? (
            <EmptyHint onPick={submit} disabled={sending} />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
        </div>
      </div>
      <div className="shrink-0 p-3">
        <div className="flex flex-col rounded-2xl border border-border bg-background shadow-xs transition-colors focus-within:border-primary/40">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="输入消息"
            placeholder="说点什么…让搭子帮你记到右边看板"
            className="field-sizing-content max-h-40 min-h-12 resize-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="flex items-center justify-end px-2.5 pb-2.5">
            {sending ? (
              <Button
                size="icon"
                variant="secondary"
                className="size-8 rounded-full"
                onClick={() => void cancel()}
                aria-label="停止"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="size-8 rounded-full"
                onClick={() => submit(draft)}
                disabled={!draft.trim()}
                aria-label="发送"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
