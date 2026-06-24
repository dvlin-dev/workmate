import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useChatStore } from '../../store/useChatStore';
import { useConfigStore } from '../../store/useConfigStore';
import { MessageBubble } from './MessageBubble';

/** 三个快捷入口：label 是短按钮文案（占一行），message 是点击后真正发出的完整场景 */
const SUGGESTIONS: { label: string; message: string }[] = [
  {
    // ① 测通流程：一次性树立完整周目标。以"周四早上"的口吻陈述：周初的活已完成（让 agent
    //    勾掉对应待办、进度自然分档），重心落在今天(周四)与周五，时间点用相对词由 agent 按
    //    snapshot.today 解析——这样有截止的事项落在"今天下午/周五"等有效未来时间，
    //    今日聚焦也有内容。文案里不出现"加提醒/改进度"之类的指令，交给 agent 智能判断。
    label: '🎯 建本周目标',
    message:
      '这周订单服务 v2 重构是大头：库存耦合周二已经拆完、周三 code review 也过了，今天周四要灰度 10% 流量、周五争取全量上线；用户反馈的三个线上问题（下单偶发超时、优惠券不生效、导出乱码）这两天得修掉，其中超时那个昨天已经搞定了；核心链路单测补到 70%、再把 Prometheus 监控告警接上，周五前完成；另外今天下午还有个架构评审，提前帮我留出准备时间。',
  },
  {
    // ② 常用：盯延期风险 / 重点关注
    label: '⚠️ 哪些有延期风险',
    message: '帮我看看本周哪些目标有延期风险、或者需要我重点关注的，挑出来提醒我一下。',
  },
  {
    // ③ 常用：一键周报（不绑定具体星期，任何一天演示都自然）
    label: '📝 生成本周周报',
    message: '帮我把这周到目前为止做的事整理成一份能直接发的周报。',
  },
];

function EmptyHint({
  onPick,
  disabled,
}: {
  onPick: (message: string) => void;
  disabled: boolean;
}) {
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
      <div className="flex flex-nowrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.message)}
            className="shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-brand/40 hover:bg-accent disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatPanel({ onRequireConfig }: { onRequireConfig?: () => void }) {
  const messages = useChatStore((s) => s.messages);
  const sending = useChatStore((s) => s.sending);
  const send = useChatStore((s) => s.send);
  const cancel = useChatStore((s) => s.cancel);
  const config = useConfigStore((s) => s.config);
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
    if (!config?.llm.apiKey.trim()) {
      onRequireConfig?.();
      return;
    }
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
