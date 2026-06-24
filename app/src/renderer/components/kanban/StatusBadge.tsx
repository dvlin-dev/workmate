import { Badge } from '../ui/badge';
import type { GoalStatus } from '@shared/types';

const CONFIG = {
  active: { label: '进行中', variant: 'secondary' },
  done: { label: '已完成', variant: 'success' },
} as const;

export function StatusBadge({ status }: { status: GoalStatus }) {
  const { label, variant } = CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
}
