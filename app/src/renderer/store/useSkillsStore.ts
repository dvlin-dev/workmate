import { create } from 'zustand';
import type { SkillSummary } from '@shared/ipc';
import { listSkills, setSkillEnabled } from '../lib/api';

interface SkillsState {
  skills: SkillSummary[];
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  setEnabled: (name: string, enabled: boolean) => Promise<void>;
}

export const useSkillsStore = create<SkillsState>((set) => ({
  skills: [],
  loaded: false,
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      set({ skills: await listSkills(), loaded: true });
    } catch {
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },
  setEnabled: async (name, enabled) => {
    const updated = await setSkillEnabled(name, enabled);
    set((s) => ({ skills: s.skills.map((item) => (item.name === updated.name ? updated : item)) }));
  },
}));
