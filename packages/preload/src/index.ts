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
    list: (path: string) => ipcRenderer.invoke('file:list', path),
  },

  // 直播相关API
  live: {
        getStatus: () => ipcRenderer.invoke('live:get-status'),
        start: (params: { title: string, coverUrl?: string, categoryId?: number, tags?: string[] }) => 
          ipcRenderer.invoke('live:start', params),
        end: () => ipcRenderer.invoke('live:end'),
        updateInfo: (params: { title?: string, coverUrl?: string, tags?: string[] }) => 
          ipcRenderer.invoke('live:update-info', params),
        getCategories: () => ipcRenderer.invoke('live:get-categories'),
        getHistory: (params?: { page?: number, pageSize?: number }) => 
          ipcRenderer.invoke('live:get-history', params),
        onStatusChange: (callback: (status: any) => void) => {
          const listener = (_event: any, status: any) => callback(status);
          ipcRenderer.on('live:status-change', listener);
          return () => ipcRenderer.removeListener('live:status-change', listener);
        },
      },

  // 统计API
  stats: {
    getToday: () => ipcRenderer.invoke('stats:get-today'),
    getComparison: () => ipcRenderer.invoke('stats:get-comparison'),
    getAllTime: () => ipcRenderer.invoke('stats:get-all-time'),
    refresh: () => ipcRenderer.invoke('stats:refresh'),
    onStatsUpdated: (callback: (stats: any) => void) => {
      const listener = (_event: any, stats: any) => callback(stats);
      ipcRenderer.on('stats:stats-updated', listener);
      return () => ipcRenderer.removeListener('stats:stats-updated', listener);
    },
  },

  // 认证API
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getUserInfo: () => ipcRenderer.invoke('auth:get-user-info'),
    refreshToken: () => ipcRenderer.invoke('auth:refresh-token'),
    generateLoginQrCode: () => ipcRenderer.invoke('auth:generate-login-qr-code'),
    checkQrCodeStatus: (token: string) => ipcRenderer.invoke('auth:check-qr-code-status', token),
    // checkPermission: (permission: string) => ipcRenderer.invoke('auth:checkPermission', permission),
    onLoginSuccess: (callback: (userInfo: any) => void) => {
      const listener = (_event: any, userInfo: any) => callback(userInfo);
      ipcRenderer.on('auth:login-success', listener);
      return () => ipcRenderer.removeListener('auth:login-success', listener);
    },
    onLoginFailed: (callback: (error: any) => void) => {
      const listener = (_event: any, error: any) => callback(error);
      ipcRenderer.on('auth:login-failed', listener);
      return () => ipcRenderer.removeListener('auth:login-failed', listener);
    },
    onQrCodeGenerated: (callback: (qrCodeData: any) => void) => {
      const listener = (_event: any, qrCodeData: any) => callback(qrCodeData);
      ipcRenderer.on('auth:qr-code-generated', listener);
      return () => ipcRenderer.removeListener('auth:qr-code-generated', listener);
    },
    onQrScanned: (callback: () => void) => {
      const listener = (_event: any) => callback();
      ipcRenderer.on('auth:qr-scanned', listener);
      return () => ipcRenderer.removeListener('auth:qr-scanned', listener);
    },
    onQrExpired: (callback: () => void) => {
      const listener = (_event: any) => callback();
      ipcRenderer.on('auth:qr-expired', listener);
      return () => ipcRenderer.removeListener('auth:qr-expired', listener);
    },
    onLogout: (callback: () => void) => {
      const listener = (_event: any) => callback();
      ipcRenderer.on('auth:logout', listener);
      return () => ipcRenderer.removeListener('auth:logout', listener);
    },
    onAuthStatusChanged: (callback: (status: any) => void) => {
      const listener = (_event: any, status: any) => callback(status);
      ipcRenderer.on('auth:status-changed', listener);
      return () => ipcRenderer.removeListener('auth:status-changed', listener);
    }
  }
};

// 暴露API到渲染进程
try {
  contextBridge.exposeInMainWorld('api', api);
} catch (error) {
  console.error('Failed to expose API to renderer process:', error);
}
