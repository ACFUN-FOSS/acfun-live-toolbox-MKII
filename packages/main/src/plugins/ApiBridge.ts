import { ApiServer } from '../server/ApiServer';
import { RoomManager } from '../rooms/RoomManager';
import { DatabaseManager } from '../persistence/DatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import { PopupManager, PopupOptions } from './PopupManager';
import type { NormalizedEvent, NormalizedEventType } from '../types';

export interface PluginAPI {
  subscribeEvents(
    cb: (event: NormalizedEvent) => void,
    filter?: { room_id?: string; type?: NormalizedEventType }
  ): () => void;

  callAcfun(req: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: any }): Promise<any>;

  pluginStorage: {
    write(table: string, row: any): Promise<void>;
  };

  registerHttpRoute(
    def: { method: 'GET' | 'POST'; path: string },
    handler: Parameters<ApiServer['registerPluginRoute']>[2]
  ): void;

  // 弹窗API
  popup: {
    create(options: PopupOptions): Promise<string>;
    close(popupId: string): Promise<boolean>;
    update(popupId: string, options: Partial<PopupOptions>): Promise<boolean>;
    show(popupId: string): Promise<boolean>;
    hide(popupId: string): Promise<boolean>;
    action(popupId: string, actionId: string): Promise<boolean>;
    bringToFront(popupId: string): Promise<boolean>;
    getAll(): Promise<PopupInstance[]>;
    get(popupId: string): Promise<PopupInstance | null>;
    closeAll(): Promise<number>;
    // 事件监听
    onAction(callback: (popupId: string, actionId: string) => void): () => void;
    onClose(callback: (popupId: string) => void): () => void;
    onShow(callback: (popupId: string) => void): () => void;
    onHide(callback: (popupId: string) => void): () => void;
  };

  readonly pluginId: string;
}

/**
 * ApiBridge：面向插件的受控 API 实现。禁止泄露敏感信息（如 Token）。
 */
export class ApiBridge implements PluginAPI {
  public readonly pluginId: string;
  private apiServer: ApiServer;
  private roomManager: RoomManager;
  private databaseManager: DatabaseManager;
  private configManager: ConfigManager;
  private popupManager: PopupManager;
  private onPluginFault: (reason: string) => void;

  constructor(opts: {
    pluginId: string;
    apiServer: ApiServer;
    roomManager: RoomManager;
    databaseManager: DatabaseManager;
    configManager: ConfigManager;
    popupManager: PopupManager;
    onPluginFault: (reason: string) => void;
  }) {
    this.pluginId = opts.pluginId;
    this.apiServer = opts.apiServer;
    this.roomManager = opts.roomManager;
    this.databaseManager = opts.databaseManager;
    this.configManager = opts.configManager;
    this.popupManager = opts.popupManager;
    this.onPluginFault = opts.onPluginFault;
  }

  /**
   * 订阅标准化事件，可选过滤；返回取消订阅函数。
   */
  subscribeEvents(
    cb: (event: NormalizedEvent) => void,
    filter?: { room_id?: string; type?: NormalizedEventType }
  ): () => void {
    const listener = (event: NormalizedEvent) => {
      try {
        if (filter?.room_id && event.room_id !== filter.room_id) return;
        if (filter?.type && event.event_type !== filter.type) return;
        cb(event);
      } catch (err) {
        // 插件抛错不影响主进程，进行熔断计数（简化为直接通知）
        this.onPluginFault('event-handler-error');
      }
    };
    this.roomManager.on('event', listener as any);
    return () => this.roomManager.off('event', listener as any);
  }

  /**
   * 代表插件调用 AcFun API。主进程注入 Token/UA，插件不可控。
   */
  async callAcfun(req: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: any }): Promise<any> {
    const token = this.configManager.get<string>('acfun.token');
    if (!token) {
      const err = new Error('ACFUN_NOT_LOGGED_IN');
      // 插件调用依赖登录态，缺失视为故障信号但不暂停核心
      this.onPluginFault('missing-token');
      throw err;
    }

    // 统一前缀与头部（示例化，后续替换为 acfunlive-http-api 封装）
    const base = this.configManager.get<string>('acfun.apiBase', 'https://api2.aixifan.com');
    const url = `${base}${req.path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AcFunLiveToolbox/1.0 (PluginRuntime)'
    };
    // 示例：Authorization 头按平台策略注入（真实实现需按 AcFun 要求组合）
    headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined
    });

    const text = await res.text();
    let data: any;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      const err = new Error(`ACFUN_API_ERROR_${res.status}`);
      this.onPluginFault(`acfun-http-${res.status}`);
      throw err;
    }
    return data;
  }

  /**
   * 插件存储：每插件独立前缀表，写入 JSON 行。主进程代写。
   */
  async pluginStorageWrite(table: string, row: any): Promise<void> {
    await this.pluginStorage.write(table, row);
  }

  public pluginStorage = {
    write: async (table: string, row: any): Promise<void> => {
      const validName = /^[a-zA-Z0-9_]+$/;
      if (!validName.test(table)) {
        throw new Error('INVALID_TABLE_NAME');
      }
      const pluginId = this.pluginId;
      if (!validName.test(pluginId)) {
        throw new Error('INVALID_PLUGIN_ID');
      }

      const db = this.databaseManager.getDb();
      const tableName = `plugin_${pluginId}_${table}`;

      // 建表（若不存在），包含 id/data/created_at
      await new Promise<void>((resolve, reject) => {
        db.run(
          `CREATE TABLE IF NOT EXISTS ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          (err) => (err ? reject(err) : resolve())
        );
      });

      // 插入 JSON 数据
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO ${tableName} (data) VALUES (?)`,
          [JSON.stringify(row ?? {})],
          (err) => (err ? reject(err) : resolve())
        );
      });
    }
  };

  /**
   * 路由注册：强制前缀 `/plugins/:id/*`，由主进程统一挂载。
   */
  registerHttpRoute(
    def: { method: 'GET' | 'POST'; path: string },
    handler: Parameters<ApiServer['registerPluginRoute']>[2]
  ): void {
    this.apiServer.registerPluginRoute(this.pluginId, def, handler);
  }

  /**
   * 弹窗API实现
   */
  public popup = {
    create: async (options: PopupOptions): Promise<string> => {
      try {
        return this.popupManager.createPopup(this.pluginId, options);
      } catch (error) {
        this.onPluginFault('popup-creation-error');
        throw error;
      }
    },

    close: async (popupId: string): Promise<boolean> => {
      try {
        return this.popupManager.closePopup(popupId);
      } catch (error) {
        this.onPluginFault('popup-close-error');
        throw error;
      }
    },

    update: async (popupId: string, options: Partial<PopupOptions>): Promise<boolean> => {
      try {
        return this.popupManager.updatePopup(popupId, options);
      } catch (error) {
        this.onPluginFault('popup-update-error');
        throw error;
      }
    },

    show: async (popupId: string): Promise<boolean> => {
      try {
        return this.popupManager.showPopup(popupId);
      } catch (error) {
        this.onPluginFault('popup-show-error');
        throw error;
      }
    },

    hide: async (popupId: string): Promise<boolean> => {
      try {
        return this.popupManager.hidePopup(popupId);
      } catch (error) {
        this.onPluginFault('popup-hide-error');
        throw error;
      }
    },

    action: async (popupId: string, actionId: string): Promise<boolean> => {
      try {
        return this.popupManager.handlePopupAction(popupId, actionId);
      } catch (error) {
        this.onPluginFault('popup-action-error');
        throw error;
      }
    },

    bringToFront: async (popupId: string): Promise<boolean> => {
      try {
        return this.popupManager.bringToFront(popupId);
      } catch (error) {
        this.onPluginFault('popup-bring-to-front-error');
        throw error;
      }
    },

    getAll: async (): Promise<PopupInstance[]> => {
      try {
        return this.popupManager.getPluginPopups(this.pluginId);
      } catch (error) {
        this.onPluginFault('popup-get-all-error');
        throw error;
      }
    },

    get: async (popupId: string): Promise<PopupInstance | null> => {
      try {
        const popup = this.popupManager.getPopup(popupId);
        // 只返回属于当前插件的弹窗
        if (popup && popup.pluginId === this.pluginId) {
          return popup;
        }
        return null;
      } catch (error) {
        this.onPluginFault('popup-get-error');
        throw error;
      }
    },

    closeAll: async (): Promise<number> => {
      try {
        return this.popupManager.closePluginPopups(this.pluginId);
      } catch (error) {
        this.onPluginFault('popup-close-all-error');
        throw error;
      }
    },

    // 事件监听方法
    onAction: (callback: (popupId: string, actionId: string) => void): (() => void) => {
      const listener = (data: { popupId: string; pluginId: string; actionId: string }) => {
        if (data.pluginId === this.pluginId) {
          try {
            callback(data.popupId, data.actionId);
          } catch (error) {
            this.onPluginFault('popup-action-callback-error');
          }
        }
      };
      this.popupManager.on('popup.action', listener);
      return () => this.popupManager.off('popup.action', listener);
    },

    onClose: (callback: (popupId: string) => void): (() => void) => {
      const listener = (data: { popupId: string; pluginId: string }) => {
        if (data.pluginId === this.pluginId) {
          try {
            callback(data.popupId);
          } catch (error) {
            this.onPluginFault('popup-close-callback-error');
          }
        }
      };
      this.popupManager.on('popup.closed', listener);
      return () => this.popupManager.off('popup.closed', listener);
    },

    onShow: (callback: (popupId: string) => void): (() => void) => {
      const listener = (data: { popupId: string; pluginId: string }) => {
        if (data.pluginId === this.pluginId) {
          try {
            callback(data.popupId);
          } catch (error) {
            this.onPluginFault('popup-show-callback-error');
          }
        }
      };
      this.popupManager.on('popup.shown', listener);
      return () => this.popupManager.off('popup.shown', listener);
    },

    onHide: (callback: (popupId: string) => void): (() => void) => {
      const listener = (data: { popupId: string; pluginId: string }) => {
        if (data.pluginId === this.pluginId) {
          try {
            callback(data.popupId);
          } catch (error) {
            this.onPluginFault('popup-hide-callback-error');
          }
        }
      };
      this.popupManager.on('popup.hidden', listener);
      return () => this.popupManager.off('popup.hidden', listener);
    }
  };
}