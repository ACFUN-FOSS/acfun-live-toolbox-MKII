/**
 * @module preload
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * An empty object for now.
 * This will be populated with the actual API as we rebuild the features.
 */
const api = {
  dialog: {
    showOpenDialog: (options: any) => ipcRenderer.invoke('dialog.showOpenDialog', options),
    showSaveDialog: (options: any) => ipcRenderer.invoke('dialog.showSaveDialog', options)
  },
  fs: {
    exists: (path: string) => ipcRenderer.invoke('fs.exists', path),
    readFile: (path: string) => ipcRenderer.invoke('fs.readFile', path),
    writeFile: (path: string, data: string) => ipcRenderer.invoke('fs.writeFile', path, data)
  },
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
  },
  plugin: {
    list: () => ipcRenderer.invoke('plugin.list'),
    install: (options: any) => ipcRenderer.invoke('plugin.install', options),
    uninstall: (pluginId: string) => ipcRenderer.invoke('plugin.uninstall', pluginId),
    enable: (pluginId: string) => ipcRenderer.invoke('plugin.enable', pluginId),
    disable: (pluginId: string) => ipcRenderer.invoke('plugin.disable', pluginId),
    get: (pluginId: string) => ipcRenderer.invoke('plugin.get', pluginId),
    stats: () => ipcRenderer.invoke('plugin.stats'),
    logs: (pluginId?: string, limit?: number) => ipcRenderer.invoke('plugin.logs', pluginId, limit),
    errorHistory: (pluginId: string) => ipcRenderer.invoke('plugin.errorHistory', pluginId),
    errorStats: () => ipcRenderer.invoke('plugin.errorStats'),
    recovery: (pluginId: string, action: string, context?: Record<string, any>) => ipcRenderer.invoke('plugin.recovery', pluginId, action, context),
    resetErrorCount: (pluginId: string, errorType?: string) => ipcRenderer.invoke('plugin.resetErrorCount', pluginId, errorType),
    // Development Tools API
    saveDevConfig: (config: any) => ipcRenderer.invoke('plugin.devtools.saveConfig', config),
    loadDevConfig: (pluginId?: string) => ipcRenderer.invoke('plugin.devtools.getConfig', pluginId),
    startDebugSession: (config: any) => ipcRenderer.invoke('plugin.devtools.startDebug', config),
    stopDebugSession: (pluginId: string) => ipcRenderer.invoke('plugin.devtools.stopDebug', pluginId),
    testConnection: (config: any) => ipcRenderer.invoke('plugin.devtools.testConnection', config),
    enableHotReload: (pluginId: string) => ipcRenderer.invoke('plugin.devtools.enableHotReload', pluginId),
    disableHotReload: (pluginId: string) => ipcRenderer.invoke('plugin.devtools.disableHotReload', pluginId),
    popup: {
      create: (pluginId: string, options: any) => ipcRenderer.invoke('plugin.popup.create', pluginId, options),
      close: (pluginId: string, popupId: string) => ipcRenderer.invoke('plugin.popup.close', pluginId, popupId),
      action: (pluginId: string, popupId: string, actionId: string) => ipcRenderer.invoke('plugin.popup.action', pluginId, popupId, actionId),
      bringToFront: (pluginId: string, popupId: string) => ipcRenderer.invoke('plugin.popup.bringToFront', pluginId, popupId)
    }
  },
  overlay: {
    create: (options: any) => ipcRenderer.invoke('overlay.create', options),
    update: (overlayId: string, updates: any) => ipcRenderer.invoke('overlay.update', overlayId, updates),
    close: (overlayId: string) => ipcRenderer.invoke('overlay.close', overlayId),
    show: (overlayId: string) => ipcRenderer.invoke('overlay.show', overlayId),
    hide: (overlayId: string) => ipcRenderer.invoke('overlay.hide', overlayId),
    bringToFront: (overlayId: string) => ipcRenderer.invoke('overlay.bringToFront', overlayId),
    list: () => ipcRenderer.invoke('overlay.list'),
    action: (overlayId: string, action: string, data?: any) => ipcRenderer.invoke('overlay.action', overlayId, action, data)
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, listener);
  },
  off: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.off(channel, listener);
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
