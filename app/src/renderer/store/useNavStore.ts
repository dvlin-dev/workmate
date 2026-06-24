import { create } from 'zustand';

/** 主区目的地：home=对话+看板，skills=技能管理页 */
export type Destination = 'home' | 'skills';

interface NavState {
  destination: Destination;
  go: (destination: Destination) => void;
}

export const useNavStore = create<NavState>((set) => ({
  destination: 'home',
  go: (destination) => set({ destination }),
}));
