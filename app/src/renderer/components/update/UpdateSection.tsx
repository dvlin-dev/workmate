import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { useUpdateStore } from '../../store/useUpdateStore';
import { updateStatusLabel } from './labels';

/** 设置页「软件更新」区：当前版本 + 状态 + 检查/重启安装。 */
export function UpdateSection() {
  const state = useUpdateStore((s) => s.state);
  const checking = useUpdateStore((s) => s.checking);
  const check = useUpdateStore((s) => s.check);
  const restart = useUpdateStore((s) => s.restart);

  const status = state?.status;
  const busyChecking = checking || status === 'checking';
  const isDownloading = status === 'downloading';
  const isRestarting = status === 'restarting';
  const canCheck =
    status !== 'unsupported' && !busyChecking && !isDownloading && !isRestarting;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label>软件更新</Label>
          <p className="truncate text-xs text-muted-foreground">{updateStatusLabel(state)}</p>
        </div>
        {status === 'downloaded' || isRestarting ? (
          <Button size="sm" onClick={() => void restart()} disabled={isRestarting}>
            {isRestarting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            重启安装
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => void check()} disabled={!canCheck}>
            {busyChecking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            检查更新
          </Button>
        )}
      </div>

      {isDownloading && <Progress value={state?.progressPercent ?? 0} className="h-1.5" />}

      <p className="text-xs text-muted-foreground">当前版本 v{state?.currentVersion ?? '—'}</p>
    </div>
  );
}
