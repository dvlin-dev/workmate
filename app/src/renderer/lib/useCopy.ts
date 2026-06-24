import { useCallback, useState } from 'react';

/**
 * 复制到剪贴板 + 短暂的 copied 态（用于「复制」按钮的对勾反馈）。
 * 收口 MessageBubble / ReportDialog 里重复的「clipboard 守卫 + copied flag + 1500ms 重置」。
 * copy(text) 返回是否成功，调用方据此决定是否 toast（不同处文案不同，留在调用方）。
 */
export function useCopy(resetMs = 1500): { copied: boolean; copy: (text: string) => Promise<boolean> } {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    async (text: string) => {
      if (!text || !navigator.clipboard?.writeText) return false;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetMs);
        return true;
      } catch {
        return false;
      }
    },
    [resetMs]
  );
  return { copied, copy };
}
