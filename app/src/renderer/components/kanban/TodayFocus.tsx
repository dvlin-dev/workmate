import { toast } from 'sonner';
import type { Task } from '@shared/types';
import { Checkbox } from '../ui/checkbox';
import { toggleTask as apiToggleTask } from '../../lib/api';
import { useSnapshotStore } from '../../store/useSnapshotStore';

export function TodayFocus({ tasks }: { tasks: Task[] }) {
  const setSnapshot = useSnapshotStore((s) => s.setSnapshot);

  if (!tasks.length) {
    return <p className="px-1 text-xs text-muted-foreground">今天暂无聚焦待办。</p>;
  }

  const toggle = async (taskId: string) => {
    try {
      setSnapshot(await apiToggleTask(taskId));
    } catch {
      toast.error('操作失败');
    }
  };

  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-2 text-sm">
          <Checkbox checked={task.done} onChange={() => toggle(task.id)} aria-label={task.title} />
          <span className="truncate">{task.title}</span>
          {task.due && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {task.due.slice(5, 10)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
