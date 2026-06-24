import { create } from 'zustand';
import type { DeepPartial } from '@shared/ipc';
import type { AppConfig } from '@shared/config';
import { getConfig, setConfig } from '../lib/api';

interface ConfigState {
  config: AppConfig | null;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: DeepPartial<AppConfig>) => Promise<AppConfig>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  loaded: false,
  load: async () => {
    try {
      const config = await getConfig();
      set({ config, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  update: async (patch) => {
    const config = await setConfig(patch);
    set({ config });
    return config;
  },
}));
