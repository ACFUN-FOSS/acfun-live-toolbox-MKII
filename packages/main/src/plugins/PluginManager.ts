import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { ApiServer } from '../server/ApiServer';
import { RoomManager } from '../rooms/RoomManager';
import { DatabaseManager } from '../persistence/DatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import { ApiBridge, PluginAPI } from './ApiBridge';

export interface PluginManagerEvents {
  'plugin.suspended': { id: string; reason: string };
}

/**
 * PluginManager 负责插件生命周期与受控 API 提供。
 * 目前阶段实现：为插件创建 ApiBridge、代理路由注册、后续扩展安装/启用/暂停。
 */
export class PluginManager extends TypedEventEmitter<PluginManagerEvents> {
  private apiServer: ApiServer;
  private roomManager: RoomManager;
  private databaseManager: DatabaseManager;
  private configManager: ConfigManager;

  constructor(opts: {
    apiServer: ApiServer;
    roomManager: RoomManager;
    databaseManager: DatabaseManager;
    configManager: ConfigManager;
  }) {
    super();
    this.apiServer = opts.apiServer;
    this.roomManager = opts.roomManager;
    this.databaseManager = opts.databaseManager;
    this.configManager = opts.configManager;
  }

  /**
   * 为指定插件返回受控 API（带上下文）。
   */
  public getApi(pluginId: string): PluginAPI {
    return new ApiBridge({
      pluginId,
      apiServer: this.apiServer,
      roomManager: this.roomManager,
      databaseManager: this.databaseManager,
      configManager: this.configManager,
      onPluginFault: (reason: string) => this.emit('plugin.suspended', { id: pluginId, reason })
    });
  }

  /**
   * 供内部或测试用的路由注册代理（统一走 ApiServer）。
   */
  public registerHttpRoute(
    pluginId: string,
    def: { method: 'GET' | 'POST'; path: string },
    handler: Parameters<ApiServer['registerPluginRoute']>[2]
  ): void {
    this.apiServer.registerPluginRoute(pluginId, def, handler);
  }
}