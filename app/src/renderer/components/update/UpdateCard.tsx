import { Download, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { useUpdateStore } from '../../store/useUpdateStore';

/**
 * 侧边栏底部的更新卡片：仅在下载中 / 已就绪 / 重启中时出现（其余时间隐身），
 * 作为静默自动更新路径的"看得见"提示 + 一键重启安装入口。
 */
export function UpdateCard() {
  const state = useUpdateStore((s) => s.state);
  const restart = useUpdateStore((s) => s.restart);
  const status = state?.status;

  if (status !== 'downloading' && status !== 'downloaded' && status !== 'restarting') {
    return null;
  }

  return (
    <div className="window-no-drag mx-2 mb-1 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-xs">
      {status === 'downloaded' ? (
        <>
          <p className="text-xs font-medium text-foreground">新版本已就绪 🎉</p>
          {state?.downloadedVersion && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              v{state.downloadedVersion}
            </p>
          )}
          <Button
            size="sm"
            className="mt-2 h-7 w-full rounded-full text-xs"
            onClick={() => void restart()}
          >
            <RotateCcw className="size-3" /> 重启更新
          </Button>
        </>
      ) : status === 'restarting' ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> 正在重启安装…
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Download className="size-3.5 shrink-0" />
          新版本下载中{state?.progressPercent != null ? ` ${Math.round(state.progressPercent)}%` : '…'}
        </p>
      )}
    </div>
  );
}
