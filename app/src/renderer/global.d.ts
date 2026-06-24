import type { WorkmateApi } from '@shared/ipc';

declare global {
  interface Window {
    workmateAPI: WorkmateApi;
  }
}

export {};
