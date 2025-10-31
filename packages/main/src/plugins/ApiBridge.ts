import { ApiServer } from '../server/ApiServer';
import { RoomManager } from '../rooms/RoomManager';
import { DatabaseManager } from '../persistence/DatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
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
  private onPluginFault: (reason: string) => void;

  constructor(opts: {
    pluginId: string;
    apiServer: ApiServer;
    roomManager: RoomManager;
    databaseManager: DatabaseManager;
    configManager: ConfigManager;
    onPluginFault: (reason: string) => void;
  }) {
    this.pluginId = opts.pluginId;
    this.apiServer = opts.apiServer;
    this.roomManager = opts.roomManager;
    this.databaseManager = opts.databaseManager;
    this.configManager = opts.configManager;
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
}