import { useState, type KeyboardEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Goal, Task } from '@shared/types';
import { useSnapshotStore } from '../../store/useSnapshotStore';
import { useChatStore } from '../../store/useChatStore';
import { addGoal as apiAddGoal, clearWeek as apiClearWeek } from '../../lib/api';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { GoalCard } from './GoalCard';
import { TodayFocus } from './TodayFocus';
import { ReportButton } from '../report/ReportDialog';

const EMPTY_GOALS: Goal[] = [];
const EMPTY_TASKS: Task[] = [];

function AddGoal() {
  const setSnapshot = useSnapshotStore((s) => s.setSnapshot);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const submit = async () => {
    const value = title.trim();
    setTitle('');
    setAdding(false);
    if (!value) return;
    try {
      setSnapshot(await apiAddGoal(value));
    } catch {
      toast.error('新建目标失败');
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void submit();
    if (e.key === 'Escape') {
      setTitle('');
      setAdding(false);
    }
  };

  if (adding) {
    return (
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => void submit()}
        placeholder="目标标题，回车新建"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border-muted py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      <Plus className="size-3.5" /> 新建目标
    </button>
  );
}

function ClearWeekButton() {
  const setSnapshot = useSnapshotStore((s) => s.setSnapshot);
  const clearChat = useChatStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      setSnapshot(await apiClearWeek());
      clearChat();
      toast.success('已清空本周');
      setOpen(false);
    } catch {
      toast.error('清空失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label="清空本周"
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm gap-4">
          <DialogHeader>
            <DialogTitle>清空本周</DialogTitle>
            <DialogDescription>
              将清空本周的目标、待办与对话，此操作不可撤销。配置与历史周不受影响。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              清空
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function KanbanPanel() {
  const snapshot = useSnapshotStore((s) => s.snapshot);
  const goals = snapshot?.goals ?? EMPTY_GOALS;
  const todayFocus = snapshot?.todayFocus ?? EMPTY_TASKS;

  return (
    <section className="flex min-w-0 flex-[4] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border-muted px-4">
        <span className="text-sm font-semibold">📋 本周目标</span>
        <div className="flex items-center gap-1.5">
          {snapshot && <span className="text-xs text-muted-foreground">{snapshot.weekOf} 起</span>}
          <ClearWeekButton />
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {/* 今日聚焦置顶：目标多时也不会被挤到看不见，进面板即见「今天要做什么」 */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">☀️ 今日聚焦</h3>
            <TodayFocus tasks={todayFocus} />
          </div>
          <div className="border-t border-border-muted/70" />
          <div className="flex flex-col gap-2">
            {goals.length === 0 && (
              <div className="rounded-xl border border-dashed border-border-muted p-6 text-center text-xs text-muted-foreground">
                还没有目标。去左边说一句"这周要做…"，或在下面手动新建。
              </div>
            )}
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
            <AddGoal />
          </div>
        </div>
      </ScrollArea>
      <div className="shrink-0 border-t border-border-muted p-3">
        <ReportButton />
      </div>
    </section>
  );
}
