/**
 * @module preload
 */

import { contextBridge, ipcRenderer } from 'electron';

// Maintain mapping between user listeners and wrapped listeners
const _listenerMap = new WeakMap<(...args: any[]) => void, (event: Electron.IpcRendererEvent, ...args: any[]) => void>();

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
    qrFinalize: () => ipcRenderer.invoke('login.qrFinalize'),
    qrCancel: () => ipcRenderer.invoke('login.qrCancel'),
    logout: () => ipcRenderer.invoke('login.logout'),
    onStateChanged: (callback: any) => ipcRenderer.on('login.onStateChanged', callback)
  },
  // Window controls bridging
  window: {
    minimizeWindow: () => ipcRenderer.invoke('window.minimize'),
    closeWindow: () => ipcRenderer.invoke('window.close'),
    maximizeWindow: () => ipcRenderer.invoke('window.maximize'),
    restoreWindow: () => ipcRenderer.invoke('window.restore')
  },
  system: {
    getConfig: () => ipcRenderer.invoke('system.getConfig'),
    updateConfig: (newConfig: any) => ipcRenderer.invoke('system.updateConfig', newConfig),
    getSystemLog: (count?: number) => ipcRenderer.invoke('system.getSystemLog', count),
    genDiagnosticZip: () => ipcRenderer.invoke('system.genDiagnosticZip'),
    showItemInFolder: (targetPath: string) => ipcRenderer.invoke('system.showItemInFolder', targetPath),
    openExternal: (url: string) => ipcRenderer.invoke('system.openExternal', url)
  },
  // Overlay API bridging
  overlay: {
    create: (options: any) => ipcRenderer.invoke('overlay.create', options),
    update: (overlayId: string, updates: any) => ipcRenderer.invoke('overlay.update', overlayId, updates),
    close: (overlayId: string) => ipcRenderer.invoke('overlay.close', overlayId),
    show: (overlayId: string) => ipcRenderer.invoke('overlay.show', overlayId),
    hide: (overlayId: string) => ipcRenderer.invoke('overlay.hide', overlayId),
    bringToFront: (overlayId: string) => ipcRenderer.invoke('overlay.bringToFront', overlayId),
    list: () => ipcRenderer.invoke('overlay.list'),
    action: (overlayId: string, action: string, data?: any) => ipcRenderer.invoke('overlay.action', overlayId, action, data),
    send: (overlayId: string, event: string, payload?: any) => ipcRenderer.invoke('overlay.send', overlayId, event, payload)
  },
  // Plugin API bridging
  plugin: {
    list: () => ipcRenderer.invoke('plugin.list'),
    install: (options: { filePath?: string; url?: string; force?: boolean }) => ipcRenderer.invoke('plugin.install', options),
    uninstall: (pluginId: string) => ipcRenderer.invoke('plugin.uninstall', pluginId),
    enable: (pluginId: string) => ipcRenderer.invoke('plugin.enable', pluginId),
    disable: (pluginId: string) => ipcRenderer.invoke('plugin.disable', pluginId),
    get: (pluginId: string) => ipcRenderer.invoke('plugin.get', pluginId),
    getConfig: (pluginId: string) => ipcRenderer.invoke('plugin.getConfig', pluginId),
    updateConfig: (pluginId: string, config: any) => ipcRenderer.invoke('plugin.updateConfig', pluginId, config),
    stats: () => ipcRenderer.invoke('plugin.stats'),
    logs: (pluginId?: string, limit?: number) => ipcRenderer.invoke('plugin.logs', pluginId, limit),
    errorHistory: (pluginId: string) => ipcRenderer.invoke('plugin.errorHistory', pluginId),
    errorStats: () => ipcRenderer.invoke('plugin.errorStats'),
    recovery: (pluginId: string, action: string, context?: Record<string, any>) => ipcRenderer.invoke('plugin.recovery', pluginId, action, context),
    resetErrorCount: (pluginId: string, errorType?: string) => ipcRenderer.invoke('plugin.resetErrorCount', pluginId, errorType),
    saveDevConfig: (config: any) => ipcRenderer.invoke('plugin.devtools.saveConfig', config),
    loadDevConfig: (pluginId?: string) => ipcRenderer.invoke('plugin.devtools.getConfig', pluginId),
    startDebugSession: (config: any) => ipcRenderer.invoke('plugin.devtools.startDebug', config),
    stopDebugSession: (pluginId: string) => ipcRenderer.invoke('plugin.devtools.stopDebug', pluginId),
    enableHotReload: (pluginId: string) => ipcRenderer.invoke('plugin.devtools.enableHotReload', pluginId),
    disableHotReload: (pluginId: string) => ipcRenderer.invoke('plugin.devtools.disableHotReload', pluginId),
    testConnection: (config: any) => ipcRenderer.invoke('plugin.devtools.testConnection', config),
    popup: {
      create: (pluginId: string, options: any) => ipcRenderer.invoke('plugin.popup.create', pluginId, options),
      close: (pluginId: string, popupId: string) => ipcRenderer.invoke('plugin.popup.close', pluginId, popupId),
      action: (pluginId: string, popupId: string, actionId: string) => ipcRenderer.invoke('plugin.popup.action', pluginId, popupId, actionId),
      bringToFront: (pluginId: string, popupId: string) => ipcRenderer.invoke('plugin.popup.bringToFront', pluginId, popupId)
    },
    lifecycle: {
      emit: (hook: string, pluginId: string, context?: any) => ipcRenderer.invoke('plugin.lifecycle.emit', hook, pluginId, context)
    }
  },
  // Wujie helper bridging
  wujie: {
    getUIConfig: async (pluginId: string) => {
      const res = await ipcRenderer.invoke('plugin.get', pluginId);
      if (res && 'success' in res && res.success) {
        const ui = res.data?.manifest?.ui?.wujie || null;
        return { success: true, data: ui };
      }
      return { success: false, error: res?.error || 'Failed to fetch plugin' };
    },
    getOverlayConfig: async (pluginId: string) => {
      const res = await ipcRenderer.invoke('plugin.get', pluginId);
      if (res && 'success' in res && res.success) {
        const ov = res.data?.manifest?.overlay?.wujie || null;
        return { success: true, data: ov };
      }
      return { success: false, error: res?.error || 'Failed to fetch plugin' };
    }
  },
  // Unified hosting manifest bridging
  hosting: {
    getConfig: async (pluginId: string) => {
      const res = await ipcRenderer.invoke('plugin.get', pluginId);
      if (res && 'success' in res && res.success) {
        const m = res.data?.manifest || {};
        return {
          success: true,
          data: {
            ui: m.ui ? { spa: !!m.ui.spa, route: m.ui.route || '/', html: m.ui.html || 'ui.html' } : null,
            window: (m as any).window ? { spa: !!(m as any).window.spa, route: (m as any).window.route || '/', html: (m as any).window.html || 'window.html' } : null,
            overlay: m.overlay ? { spa: !!m.overlay.spa, route: m.overlay.route || '/', html: m.overlay.html || 'overlay.html' } : null
          }
        };
      }
      return { success: false, error: res?.error || 'Failed to fetch plugin' };
    }
  },
  // Room API bridging
  room: {
    connect: (roomId: string) => ipcRenderer.invoke('room.connect', roomId),
    disconnect: (roomId: string) => ipcRenderer.invoke('room.disconnect', roomId),
    list: () => ipcRenderer.invoke('room.list'),
    status: (roomId: string) => ipcRenderer.invoke('room.status', roomId),
    details: (roomId: string) => ipcRenderer.invoke('room.details', roomId),
    setPriority: (roomId: string, priority: number) => ipcRenderer.invoke('room.setPriority', roomId, priority),
    setLabel: (roomId: string, label: string) => ipcRenderer.invoke('room.setLabel', roomId, label)
  },
  // Account API bridging
  account: {
    getUserInfo: () => ipcRenderer.invoke('account.getUserInfo')
  },
  http: {
    get: async (path: string, params?: Record<string, any>) => {
      const port = parseInt(process.env.ACFRAME_API_PORT || '18299');
      const url = new URL(path, `http://127.0.0.1:${port}`);
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        }
      }
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return res.json();
      }
      return res.text();
    }
  },
  // Activity events bridge (WS-based, sanitized payloads, throttle for danmu)
  events: (() => {
    type Handler = (payload: any) => void;
    const port = parseInt(process.env.ACFRAME_API_PORT || '18299');
    let ws: WebSocket | null = null;
    let connected = false;
    const listeners: Record<string, Set<Handler>> = {};
    const DANMU_BUFFER: any[] = [];
    let danmuFlushTimer: any = null;
    const DANMU_FLUSH_INTERVAL_MS = 250; // up to 4 Hz
    const DANMU_MAX_BATCH = 50; // cap batch size

    const emit = (type: string, payload: any) => {
      const set = listeners[type];
      if (!set || set.size === 0) return;
      set.forEach((fn) => {
        try { fn(payload); } catch (e) { console.warn('[preload.events] listener error', e); }
      });
    };

    const sanitizeEvent = (e: any) => {
      if (!e || typeof e !== 'object') return e;
      const { ts, received_at, room_id, source, event_type, user_id, user_name, content } = e;
      return { ts, received_at, room_id, source, event_type, user_id, user_name, content };
    };

    const flushDanmu = () => {
      if (DANMU_BUFFER.length === 0) return;
      const batch = DANMU_BUFFER.splice(0, DANMU_MAX_BATCH).map(sanitizeEvent);
      emit('danmu.batch', { events: batch, ts: Date.now() });
      if (DANMU_BUFFER.length > 0) {
        // schedule next flush quickly
        danmuFlushTimer = setTimeout(flushDanmu, DANMU_FLUSH_INTERVAL_MS);
      } else {
        danmuFlushTimer = null;
      }
    };

    const ensureConnection = () => {
      if (ws && connected) return;
      try {
        ws = new WebSocket(`ws://127.0.0.1:${port}`);
        ws.onopen = () => { connected = true; };
        ws.onclose = () => { connected = false; ws = null; };
        ws.onerror = () => { connected = false; };
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(String(evt.data));
            if (msg && msg.op === 'event' && msg.d) {
              const ev = msg.d;
              const type = String(ev?.event_type || '').toLowerCase();
              if (type === 'danmaku') {
                DANMU_BUFFER.push(ev);
                if (!danmuFlushTimer) {
                  danmuFlushTimer = setTimeout(flushDanmu, DANMU_FLUSH_INTERVAL_MS);
                }
              } else {
                // forward room.* and live.* semantics if applicable
                emit(`live.${type}`, sanitizeEvent(ev));
              }
            } else if (msg && msg.op === 'room_status' && msg.d) {
              emit('room.status', msg.d);
            } else if (msg && msg.op === 'activity' && msg.d) {
              const { type, payload } = msg.d || {};
              if (typeof type === 'string') {
                emit(type, payload);
              }
            }
          } catch (e) {
            console.warn('[preload.events] message parse error', e);
          }
        };
      } catch (e) {
        console.warn('[preload.events] WS connection failed', e);
      }
    };

    return {
      connect: () => ensureConnection(),
      disconnect: () => { try { ws?.close(); } catch {/**/} ws = null; connected = false; },
      on: (channel: string, handler: Handler) => {
        if (!listeners[channel]) listeners[channel] = new Set();
        listeners[channel].add(handler);
        // auto-connect when a listener is added
        ensureConnection();
      },
      off: (channel: string, handler: Handler) => {
        const set = listeners[channel];
        if (set) set.delete(handler);
      }
    };
  })(),
  // Console API bridging (note: uses colon channels)
  console: {
    createSession: (options: any) => ipcRenderer.invoke('console:createSession', options),
    endSession: (options: any) => ipcRenderer.invoke('console:endSession', options),
    executeCommand: (options: any) => ipcRenderer.invoke('console:executeCommand', options),
    getCommands: () => ipcRenderer.invoke('console:getCommands'),
    getSession: (options: any) => ipcRenderer.invoke('console:getSession', options),
    getActiveSessions: () => ipcRenderer.invoke('console:getActiveSessions')
  },
  // Generic event subscription utilities used by renderer
  on: (channel: string, listener: (...args: any[]) => void) => {
    let wrapped = _listenerMap.get(listener);
    if (!wrapped) {
      wrapped = (event, ...args) => listener(...args);
      _listenerMap.set(listener, wrapped);
    }
    ipcRenderer.on(channel, wrapped);
  },
  off: (channel: string, listener: (...args: any[]) => void) => {
    const wrapped = _listenerMap.get(listener);
    if (wrapped) {
      ipcRenderer.removeListener(channel, wrapped);
      _listenerMap.delete(listener);
    } else {
      // Fallback in case it was added without wrapping
      ipcRenderer.removeListener(channel, listener as unknown as any);
    }
  }
};

/**
 * The `api` object is exposed to the renderer process under `window.electronApi`.
 * See `packages/renderer/src/global.d.ts` for type declarations.
 */
try {
  contextBridge.exposeInMainWorld('electronApi', api);
} catch (error) {
  console.error('Failed to expose preload API:', error);
}
