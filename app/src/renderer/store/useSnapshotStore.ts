import { create } from 'zustand';
import type { Snapshot } from '@shared/types';
import { getSnapshot, onSnapshot } from '../lib/api';

interface SnapshotState {
  snapshot: Snapshot | null;
  hydrated: boolean;
  setSnapshot: (snapshot: Snapshot) => void;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
}

export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshot: null,
  hydrated: false,
  setSnapshot: (snapshot) => set({ snapshot }),
  hydrate: async () => {
    try {
      const snapshot = await getSnapshot();
      set({ snapshot, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  subscribe: () => onSnapshot((snapshot) => set({ snapshot })),
}));
