import { contextBridge, ipcRenderer } from 'electron';
import { sha256sum } from './nodeCrypto.js';
import { versions } from './versions.js';

// 定义API接口
export const api = {
  // 加密和版本信息
  sha256sum,
  versions,
  
  // 应用管理API
  app: {
    getInstalledApps: () => ipcRenderer.invoke('app:getInstalledApps'),
    startApp: (appId: string, displayType?: string) => ipcRenderer.invoke('app:startApp', appId, displayType),
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    off: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback);
    }
  },
  
  // 窗口管理API
  window: {
    close: (windowId?: number) => ipcRenderer.invoke('window:close', windowId),
    minimize: (windowId?: number) => ipcRenderer.invoke('window:minimize', windowId),
    toggleAlwaysOnTop: (windowId?: number, alwaysOnTop?: boolean) => ipcRenderer.invoke('window:toggleAlwaysOnTop', windowId, alwaysOnTop),
    isAlwaysOnTop: (windowId?: number) => ipcRenderer.invoke('window:isAlwaysOnTop', windowId),
    getAllWindows: () => ipcRenderer.invoke('window:getAllWindows')
  },
  
  // Acfun弹幕模块API
  acfunDanmu: {
    start: () => ipcRenderer.invoke('acfunDanmu:start'),
    stop: () => ipcRenderer.invoke('acfunDanmu:stop'),
    restart: () => ipcRenderer.invoke('acfunDanmu:restart'),
    updateConfig: (config: any) => ipcRenderer.invoke('acfunDanmu:updateConfig', config),
    getConfig: () => ipcRenderer.invoke('acfunDanmu:getConfig'),
    getStatus: () => ipcRenderer.invoke('acfunDanmu:getStatus'),
    getLogs: (limit?: number) => ipcRenderer.invoke('acfunDanmu:getLogs', limit)
  },
  
  // 进程管理API
  process: {
    list: () => ipcRenderer.invoke('process:list'),
    start: (command: string, args: string[], cwd?: string) => ipcRenderer.invoke('process:start', { command, args, cwd }),
    stop: (pid: number) => ipcRenderer.invoke('process:stop', { pid })
  },
  
  // 文件操作API
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    write: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
    delete: (path: string) => ipcRenderer.invoke('file:delete', path),
    list: (path: string) => ipcRenderer.invoke('file:list', path)
  },

  // 认证API
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getUserInfo: () => ipcRenderer.invoke('auth:getUserInfo'),
    checkPermission: (permission: string) => ipcRenderer.invoke('auth:checkPermission', permission),
    refreshQrCode: (token: string) => ipcRenderer.invoke('auth:refreshQrCode', token),
    onLoginSuccess: (callback: (userInfo: any) => void) => {
      ipcRenderer.on('auth:login-success', (event, userInfo) => callback(userInfo));
    },
    onLoginFailed: (callback: (error: any) => void) => {
      ipcRenderer.on('auth:login-failed', (event, error) => callback(error));
    },
    onQrScanned: (callback: () => void) => {
      ipcRenderer.on('auth:qr-scanned', () => callback());
    },
    onLogout: (callback: () => void) => {
      ipcRenderer.on('auth:logout', () => callback());
    },
    off: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback);
    }
  }
};

// 暴露API到渲染进程
try {
  contextBridge.exposeInMainWorld('api', api);
} catch (error) {
  console.error('Failed to expose API to renderer process:', error);
}
