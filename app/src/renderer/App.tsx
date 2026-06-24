import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from './components/ui/button';
import { ChatPanel } from './components/chat/ChatPanel';
import { KanbanPanel } from './components/kanban/KanbanPanel';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { useSnapshotStore } from './store/useSnapshotStore';
import { useConfigStore } from './store/useConfigStore';
import { useChatStore } from './store/useChatStore';

export default function App() {
  const hydrate = useSnapshotStore((s) => s.hydrate);
  const subscribe = useSnapshotStore((s) => s.subscribe);
  const subscribeChunks = useChatStore((s) => s.subscribeChunks);
  const loadConfig = useConfigStore((s) => s.load);
  const config = useConfigStore((s) => s.config);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [firstRunChecked, setFirstRunChecked] = useState(false);

  useEffect(() => {
    void hydrate();
    void loadConfig();
    const unsubSnapshot = subscribe();
    const unsubChunks = subscribeChunks();
    const unsubSettings = window.workmateAPI.onOpenSettings(() => setSettingsOpen(true));
    return () => {
      unsubSnapshot();
      unsubChunks();
      unsubSettings();
    };
  }, [hydrate, subscribe, subscribeChunks, loadConfig]);

  // 首启无 key → 自动打开设置引导
  useEffect(() => {
    if (config && !firstRunChecked) {
      setFirstRunChecked(true);
      if (!config.llm.apiKey.trim()) setSettingsOpen(true);
    }
  }, [config, firstRunChecked]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="window-drag-region flex h-11 shrink-0 items-center justify-between pl-20 pr-4">
        <span className="text-sm font-semibold">Workmate · 工作搭子</span>
        <Button
          variant="ghost"
          size="icon"
          className="window-no-drag size-7"
          onClick={() => setSettingsOpen(true)}
          aria-label="设置"
        >
          <Settings className="size-4" />
        </Button>
      </header>

      <main className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <ChatPanel />
        <KanbanPanel />
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
