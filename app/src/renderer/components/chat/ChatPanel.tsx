import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';
import { useChatStore } from '../../store/useChatStore';
import { MessageBubble } from './MessageBubble';

function EmptyHint() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 py-16 text-center text-sm text-muted-foreground">
      <p>嗨，我是你的工作搭子 👋</p>
      <p className="text-xs">说说这周要做什么，或随手同步进展，我帮你记到右边的看板上。</p>
    </div>
  );
}

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const sending = useChatStore((s) => s.sending);
  const send = useChatStore((s) => s.send);
  const [draft, setDraft] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const onScroll = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    stickToBottom.current = vp.scrollHeight - vp.scrollTop - vp.clientHeight < 80;
  };

  // 新消息时仅在用户停在底部时自动滚底；尊重 prefers-reduced-motion
  useEffect(() => {
    if (!stickToBottom.current) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    vp.scrollTo({ top: vp.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [messages]);

  const submit = () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    stickToBottom.current = true;
    void send(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section className="flex min-w-0 flex-[5] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
      <header className="flex h-11 shrink-0 items-center border-b border-border-muted px-4 text-sm font-semibold">
        💬 搭子对话
      </header>
      <div ref={viewportRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col gap-3 p-4">
          {messages.length === 0 ? (
            <EmptyHint />
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
          <div className="flex items-center justify-between px-2.5 pb-2.5">
            <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter 发送</span>
            <Button
              size="icon"
              className={cn('size-8 rounded-full')}
              onClick={submit}
              disabled={sending || !draft.trim()}
              aria-label="发送"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
