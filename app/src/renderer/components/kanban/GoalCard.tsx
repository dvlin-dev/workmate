import { useState, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Goal } from '@shared/types';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import { StatusBadge } from './StatusBadge';
import { addTask as apiAddTask, toggleTask as apiToggleTask } from '../../lib/api';
import { useSnapshotStore } from '../../store/useSnapshotStore';

export function GoalCard({ goal }: { goal: Goal }) {
  const setSnapshot = useSnapshotStore((s) => s.setSnapshot);
  const [adding, setAdding] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const doneCount = goal.tasks.filter((t) => t.done).length;

  const toggle = async (taskId: string) => {
    try {
      setSnapshot(await apiToggleTask(taskId));
    } catch {
      toast.error('操作失败');
    }
  };

  const submitTask = async () => {
    const title = taskTitle.trim();
    setTaskTitle('');
    setAdding(false);
    if (!title) return;
    try {
      setSnapshot(await apiAddTask(goal.id, title));
    } catch {
      toast.error('添加待办失败');
    }
  };

  const onTaskKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void submitTask();
    if (e.key === 'Escape') {
      setTaskTitle('');
      setAdding(false);
    }
  };

  return (
    <Card className="gap-2 rounded-xl border-border/60 p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug">{goal.title}</span>
        <StatusBadge status={goal.status} />
      </div>
      <div className="flex items-center gap-2">
        <Progress value={goal.progress} className="h-1.5 flex-1" />
        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
          {goal.progress}%
        </span>
      </div>

      {goal.tasks.length > 0 && (
        <ul className="mt-0.5 flex flex-col gap-1">
          {goal.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={t.done} onChange={() => toggle(t.id)} aria-label={t.title} />
              <span className={cn('truncate', t.done && 'text-muted-foreground line-through')}>
                {t.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <input
          autoFocus
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          onKeyDown={onTaskKey}
          onBlur={() => void submitTask()}
          placeholder="待办内容，回车添加"
          className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary/40"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-0.5 flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="size-3" /> 添加待办
        </button>
      )}

      {goal.tasks.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {doneCount}/{goal.tasks.length} 待办完成
        </p>
      )}
    </Card>
  );
}
