// PluginPageStatusManager: aggregate per-plugin page status and bridge to MessageCenter
import { DataManager, MessageRecord } from './DataManager';

type OverlayClientStatus = {
  clientId: string;
  lastSeen: number;
};

type PluginOverlayStatus = {
  pluginId: string;
  clients: Map<string, OverlayClientStatus>;
  lastChange: number;
};

export class PluginPageStatusManager {
  private static instance: PluginPageStatusManager | null = null;
  private dataManager = DataManager.getInstance();
  private overlaysByPlugin: Map<string, PluginOverlayStatus> = new Map();

  static getInstance(): PluginPageStatusManager {
    if (!PluginPageStatusManager.instance) {
      PluginPageStatusManager.instance = new PluginPageStatusManager();
    }
    return PluginPageStatusManager.instance;
  }

  private constructor() {}

  /** Generate a safe channel name for plugin page status */
  private statusChannel(pluginId: string): string {
    return `plugin:${pluginId}:page-status`;
  }

  /** Ensure a plugin status container exists */
  private ensurePlugin(pluginId: string): PluginOverlayStatus {
    let p = this.overlaysByPlugin.get(pluginId);
    if (!p) {
      p = { pluginId, clients: new Map(), lastChange: Date.now() };
      this.overlaysByPlugin.set(pluginId, p);
    }
    return p;
  }

  /** Mark overlay SSE client connected and publish status event */
  overlayClientConnected(pluginId: string, clientId: string): MessageRecord {
    const p = this.ensurePlugin(pluginId);
    const now = Date.now();
    p.clients.set(clientId, { clientId, lastSeen: now });
    p.lastChange = now;
    const payload = { type: 'overlay-connected', pluginId, clientId, ts: now };
    return this.dataManager.publish(this.statusChannel(pluginId), payload, { ttlMs: 2 * 60 * 1000, persist: false, meta: { kind: 'status' } });
  }

  /** Append heartbeat for overlay SSE client */
  overlayClientHeartbeat(pluginId: string, clientId: string): MessageRecord {
    const p = this.ensurePlugin(pluginId);
    const now = Date.now();
    const c = p.clients.get(clientId);
    if (c) c.lastSeen = now; else p.clients.set(clientId, { clientId, lastSeen: now });
    p.lastChange = now;
    const payload = { type: 'overlay-heartbeat', pluginId, clientId, ts: now };
    return this.dataManager.publish(this.statusChannel(pluginId), payload, { ttlMs: 60 * 1000, persist: false, meta: { kind: 'heartbeat' } });
  }

  /** Mark overlay SSE client disconnected and publish status event */
  overlayClientDisconnected(pluginId: string, clientId: string): MessageRecord {
    const p = this.ensurePlugin(pluginId);
    const now = Date.now();
    p.clients.delete(clientId);
    p.lastChange = now;
    const payload = { type: 'overlay-disconnected', pluginId, clientId, ts: now };
    return this.dataManager.publish(this.statusChannel(pluginId), payload, { ttlMs: 2 * 60 * 1000, persist: false, meta: { kind: 'status' } });
  }

  /** Read-only snapshot of current page status */
  querySnapshot(pluginId?: string): any {
    const now = Date.now();
    const toDto = (p: PluginOverlayStatus) => ({
      pluginId: p.pluginId,
      overlayClients: Array.from(p.clients.values()).map(c => ({ clientId: c.clientId, lastSeen: c.lastSeen })),
      connectedCount: p.clients.size,
      lastChange: p.lastChange,
      ts: now
    });

    if (pluginId) {
      const p = this.ensurePlugin(pluginId);
      return toDto(p);
    }
    return { plugins: Array.from(this.overlaysByPlugin.values()).map(toDto), ts: now };
  }
}

export default PluginPageStatusManager;
