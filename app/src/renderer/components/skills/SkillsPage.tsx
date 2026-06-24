import { useEffect, useMemo, useState } from 'react';
import { Boxes, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { SkillSummary } from '@shared/ipc';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import { useSkillsStore } from '../../store/useSkillsStore';
import { SkillDetailModal } from './SkillDetailModal';

function SkillCard({
  skill,
  onOpen,
  onToggle,
}: {
  skill: SkillSummary;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{skill.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{skill.description}</p>
      </div>
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <Switch checked={skill.enabled} onCheckedChange={onToggle} aria-label={`${skill.title} 启停`} />
      </div>
    </div>
  );
}

export function SkillsPage() {
  const skills = useSkillsStore((s) => s.skills);
  const loading = useSkillsStore((s) => s.loading);
  const loaded = useSkillsStore((s) => s.loaded);
  const load = useSkillsStore((s) => s.load);
  const setEnabled = useSkillsStore((s) => s.setEnabled);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SkillSummary | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) => `${s.name} ${s.title} ${s.description}`.toLowerCase().includes(q));
  }, [skills, search]);

  const toggle = async (skill: SkillSummary, enabled: boolean) => {
    try {
      await setEnabled(skill.name, enabled);
    } catch {
      toast.error('操作失败');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="window-drag-region flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border-muted px-4">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Boxes className="size-4" /> 技能
        </span>
        <div className="window-no-drag flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索技能…"
            className="h-8 w-56"
          />
          <Button variant="ghost" size="icon" className="size-8" onClick={() => void load()} aria-label="刷新">
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-foreground">已安装</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              技能让搭子按需加载操作手册，并用文件 / bash / web 等工具围绕目标实际产出。
            </p>
            {loading && skills.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-muted px-4 py-8 text-center text-sm text-muted-foreground">
                {search ? '没有匹配的技能。' : '暂无已安装技能。'}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filtered.map((skill) => (
                  <SkillCard
                    key={skill.name}
                    skill={skill}
                    onOpen={() => {
                      setSelected(skill);
                      setDetailOpen(true);
                    }}
                    onToggle={(enabled) => void toggle(skill, enabled)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <SkillDetailModal
        skill={selected}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
