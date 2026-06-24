/**
 * Preload：通过 contextBridge 暴露 workmateAPI（安全通道面）
 * invoke 通道 = ipcRenderer.invoke；事件通道 = on/removeListener 并返回退订函数。
 */

import { contextBridge, ipcRenderer } from 'electron';
import { CH } from '../shared/ipc';
import type { WorkmateApi, NudgePayload, AgentChunk } from '../shared/ipc';
import type { Snapshot } from '../shared/types';

const api: WorkmateApi = {
  ping: () => ipcRenderer.invoke(CH.ping),
  agent: {
    sendMessage: (text) => ipcRenderer.invoke(CH.agentSendMessage, { text }),
    onChunk: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, chunk: AgentChunk) => handler(chunk);
      ipcRenderer.on(CH.agentChunk, listener);
      return () => ipcRenderer.removeListener(CH.agentChunk, listener);
    },
  },
  board: {
    toggleTask: (taskId) => ipcRenderer.invoke(CH.boardToggleTask, { taskId }),
    addGoal: (title) => ipcRenderer.invoke(CH.boardAddGoal, { title }),
    addTask: (goalId, title, due) => ipcRenderer.invoke(CH.boardAddTask, { goalId, title, due }),
    setProgress: (goalId, progress) => ipcRenderer.invoke(CH.boardSetProgress, { goalId, progress }),
    clearWeek: () => ipcRenderer.invoke(CH.boardClearWeek),
  },
  snapshot: {
    get: () => ipcRenderer.invoke(CH.snapshotGet),
    onChange: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: Snapshot) => handler(payload);
      ipcRenderer.on(CH.snapshotChanged, listener);
      return () => ipcRenderer.removeListener(CH.snapshotChanged, listener);
    },
  },
  report: {
    generate: (weekOf) => ipcRenderer.invoke(CH.reportGenerate, { weekOf }),
  },
  config: {
    get: () => ipcRenderer.invoke(CH.configGet),
    set: (patch) => ipcRenderer.invoke(CH.configSet, patch),
    testProvider: (input) => ipcRenderer.invoke(CH.configTestProvider, input),
  },
  reminders: {
    write: (taskId) => ipcRenderer.invoke(CH.remindersWrite, { taskId }),
  },
  nudge: {
    onNotify: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: NudgePayload) =>
        handler(payload);
      ipcRenderer.on(CH.nudgeNotify, listener);
      return () => ipcRenderer.removeListener(CH.nudgeNotify, listener);
    },
  },
};

contextBridge.exposeInMainWorld('workmateAPI', api);
