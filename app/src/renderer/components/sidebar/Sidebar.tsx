import { LayoutDashboard, Boxes, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavStore, type Destination } from '../../store/useNavStore';

const MODULES: { dest: Destination; label: string; icon: typeof Boxes }[] = [
  { dest: 'home', label: '搭子 / 看板', icon: LayoutDashboard },
  { dest: 'skills', label: '技能', icon: Boxes },
];

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const destination = useNavStore((s) => s.destination);
  const go = useNavStore((s) => s.go);

  return (
    <aside className="window-drag-region flex w-52 shrink-0 flex-col border-r border-border-muted bg-muted/30">
      {/* 顶部留红绿灯避让 */}
      <div className="flex h-11 shrink-0 items-center px-4 pl-20 text-sm font-semibold">
        Workmate
      </div>

      <nav className="window-no-drag flex flex-1 flex-col gap-1 px-2 py-2" aria-label="模块导航">
        {MODULES.map(({ dest, label, icon: Icon }) => {
          const active = destination === dest;
          return (
            <button
              key={dest}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => go(dest)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                active
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="window-no-drag shrink-0 p-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <Settings className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">设置</span>
        </button>
      </div>
    </aside>
  );
}
