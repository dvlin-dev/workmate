import { useEffect, useState } from 'react';
import { ChatPanel } from './components/chat/ChatPanel';
import { KanbanPanel } from './components/kanban/KanbanPanel';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { Sidebar } from './components/sidebar/Sidebar';
import { SkillsPage } from './components/skills/SkillsPage';
import { useSnapshotStore } from './store/useSnapshotStore';
import { useConfigStore } from './store/useConfigStore';
import { useChatStore } from './store/useChatStore';
import { useNavStore } from './store/useNavStore';
import { useUpdateStore } from './store/useUpdateStore';

function HomeView({ onRequireConfig }: { onRequireConfig: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 pt-3">
      <ChatPanel onRequireConfig={onRequireConfig} />
      <KanbanPanel />
    </div>
  );
}

export default function App() {
  const hydrate = useSnapshotStore((s) => s.hydrate);
  const subscribe = useSnapshotStore((s) => s.subscribe);
  const subscribeChunks = useChatStore((s) => s.subscribeChunks);
  const loadConfig = useConfigStore((s) => s.load);
  const config = useConfigStore((s) => s.config);
  const destination = useNavStore((s) => s.destination);
  const initUpdates = useUpdateStore((s) => s.init);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [firstRunChecked, setFirstRunChecked] = useState(false);

  useEffect(() => {
    void hydrate();
    void loadConfig();
    const unsubSnapshot = subscribe();
    const unsubChunks = subscribeChunks();
    const unsubUpdates = initUpdates();
    const unsubSettings = window.workmateAPI.onOpenSettings(() => setSettingsOpen(true));
    return () => {
      unsubSnapshot();
      unsubChunks();
      unsubUpdates();
      unsubSettings();
    };
  }, [hydrate, subscribe, subscribeChunks, loadConfig, initUpdates]);

  // 首启无 key → 自动打开设置引导
  useEffect(() => {
    if (config && !firstRunChecked) {
      setFirstRunChecked(true);
      if (!config.llm.apiKey.trim()) setSettingsOpen(true);
    }
  }, [config, firstRunChecked]);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {destination === 'home' ? (
          <HomeView onRequireConfig={() => setSettingsOpen(true)} />
        ) : (
          <SkillsPage />
        )}
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
