/**
 * @module preload
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * An empty object for now.
 * This will be populated with the actual API as we rebuild the features.
 */
const api = {
  login: {
    qrStart: () => ipcRenderer.invoke('login.qrStart'),
    qrCheck: () => ipcRenderer.invoke('login.qrCheck'),
    logout: () => ipcRenderer.invoke('login.logout')
  },
  room: {
    connect: (roomId: string) => ipcRenderer.invoke('room.connect', roomId),
    disconnect: (roomId: string) => ipcRenderer.invoke('room.disconnect', roomId),
    list: () => ipcRenderer.invoke('room.list'),
    status: (roomId: string) => ipcRenderer.invoke('room.status', roomId),
    setPriority: (roomId: string, priority: number) => ipcRenderer.invoke('room.setPriority', roomId, priority),
    setLabel: (roomId: string, label: string) => ipcRenderer.invoke('room.setLabel', roomId, label)
  }
};

/**
 * The "api" is exposed on the window object in the renderer process.
 * See `packages/renderer/src/global.d.ts` for type declarations.
 */
try {
  contextBridge.exposeInMainWorld('electronApi', api);
} catch (error) {
  console.error('Failed to expose preload API:', error);
}
