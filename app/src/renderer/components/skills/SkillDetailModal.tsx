import { useEffect, useState } from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SkillDetail, SkillSummary } from '@shared/ipc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Markdown } from '../ui/markdown';
import { getSkillDetail, openSkillDirectory } from '../../lib/api';
import { useSkillsStore } from '../../store/useSkillsStore';

export function SkillDetailModal({
  skill: initialSkill,
  open,
  onOpenChange,
}: {
  skill: SkillSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setEnabled = useSkillsStore((s) => s.setEnabled);
  // 读 store 里的实时版本，确保启停后按钮态/标签同步
  const liveSkill = useSkillsStore((s) =>
    initialSkill ? (s.skills.find((item) => item.name === initialSkill.name) ?? initialSkill) : null
  );
  const skill = liveSkill ?? initialSkill;
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const skillName = skill?.name ?? null;
  useEffect(() => {
    if (!open || !skillName) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSkillDetail(skillName)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch(() => {
        if (!cancelled) toast.error('加载技能详情失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, skillName]);

  const toggle = async () => {
    if (!skill) return;
    try {
      await setEnabled(skill.name, !skill.enabled);
    } catch {
      toast.error('操作失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{skill?.title ?? '技能'}</DialogTitle>
          <DialogDescription className="line-clamp-2">{skill?.description ?? ''}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="max-h-[55vh] rounded-lg border border-border-muted p-4">
            <Markdown>{detail?.content ?? '（无内容）'}</Markdown>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => skill && void openSkillDirectory(skill.name)}
            disabled={!skill}
          >
            <FolderOpen className="size-4" /> 打开目录
          </Button>
          <Button variant={skill?.enabled ? 'secondary' : 'default'} size="sm" onClick={toggle} disabled={!skill}>
            {skill?.enabled ? '停用' : '启用'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
