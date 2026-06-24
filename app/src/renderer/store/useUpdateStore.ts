import { create } from 'zustand';
import type { AppUpdateState } from '@shared/ipc';
import {
  checkForUpdates as apiCheck,
  getUpdateState,
  onUpdateState,
  restartToInstall as apiRestart,
} from '../lib/api';

interface UpdateStoreState {
  state: AppUpdateState | null;
  /** 手动检查进行中（按钮 loading） */
  checking: boolean;
  /** 拉初值 + 订阅主进程状态广播；返回退订函数 */
  init: () => () => void;
  check: () => Promise<void>;
  restart: () => Promise<void>;
}

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  state: null,
  checking: false,

  init: () => {
    const unsubscribe = onUpdateState((state) => set({ state }));
    void getUpdateState()
      .then((state) => set({ state }))
      .catch(() => {
        /* 取初值失败无妨：后续广播会补 */
      });
    return unsubscribe;
  },

  check: async () => {
    if (get().checking) return;
    set({ checking: true });
    try {
      const state = await apiCheck();
      set({ state }); // 广播也会更新；这里兜底
    } catch {
      /* 错误已反映在广播的 state.status='error' 上 */
    } finally {
      set({ checking: false });
    }
  },

  restart: async () => {
    try {
      await apiRestart();
    } catch {
      /* 失败会经广播回到 downloaded/error */
    }
  },
}));
