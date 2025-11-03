import { ApiServer } from '../server/ApiServer';
import { RoomManager } from '../rooms/RoomManager';
import { DatabaseManager } from '../persistence/DatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import { PopupManager, PopupOptions, PopupInstance } from './PopupManager';
import type { NormalizedEvent, NormalizedEventType } from '../types';
import { TokenManager } from '../services/TokenManager';
import { rateLimitManager, RateLimitManager } from '../services/RateLimitManager';
import { EventFilter, DEFAULT_FILTERS, applyFilters, getEventQualityScore } from '../events/normalize';
import { apiRetryManager, ApiRetryManager, ApiCallOptions } from '../services/ApiRetryManager';

export interface PluginAPI {
  subscribeEvents(
    cb: (event: NormalizedEvent) => void,
    filter?: { room_id?: string; type?: NormalizedEventType }
  ): () => void;

  callAcfun(req: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: any }, options?: ApiCallOptions): Promise<any>;

  pluginStorage: {
    write(table: string, row: any): Promise<void>;
  };

  registerHttpRoute(
    def: { method: 'GET' | 'POST'; path: string },
    handler: Parameters<ApiServer['registerPluginRoute']>[2]
  ): void;

  // 认证API
  auth: {
    isAuthenticated(): boolean;
    getTokenInfo(): any;
    refreshToken(): Promise<any>;
  };

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
  private acfunApi: any;
  private tokenManager: TokenManager;

  constructor(opts: {
    pluginId: string;
    apiServer: ApiServer;
    roomManager: RoomManager;
    databaseManager: DatabaseManager;
    configManager: ConfigManager;
    popupManager: PopupManager;
    onPluginFault: (reason: string) => void;
    tokenManager?: TokenManager;
  }) {
    this.pluginId = opts.pluginId;
    this.apiServer = opts.apiServer;
    this.roomManager = opts.roomManager;
    this.databaseManager = opts.databaseManager;
    this.configManager = opts.configManager;
    this.popupManager = opts.popupManager;
    this.onPluginFault = opts.onPluginFault;
    this.tokenManager = opts.tokenManager || new TokenManager();
    
    // 使用TokenManager提供的统一API实例
    this.acfunApi = this.tokenManager.getApiInstance();
    
    // 初始化认证（如果需要）
    this.initializeAuthentication();
  }

  /**
   * 初始化认证
   */
  private async initializeAuthentication(): Promise<void> {
    try {
      // TokenManager已经处理了API实例的认证状态
      // 这里只需要检查是否已认证
      if (this.tokenManager.isAuthenticated()) {
        console.log(`[ApiBridge] Plugin ${this.pluginId} initialized with authenticated API instance`);
      } else {
        console.warn(`[ApiBridge] Plugin ${this.pluginId} initialized without authentication`);
      }
    } catch (error) {
      console.warn('[ApiBridge] Failed to initialize authentication:', error);
    }
  }

  /**
   * 订阅标准化事件，可选过滤；返回取消订阅函数。
   */
  subscribeEvents(
    cb: (event: NormalizedEvent) => void,
    filter?: { 
      room_id?: string; 
      type?: NormalizedEventType;
      user_id?: string;
      min_quality_score?: number;
      custom_filters?: string[];
      rate_limit?: {
        max_events_per_second?: number;
        max_events_per_minute?: number;
      };
    }
  ): () => void {
    // 事件速率限制状态
    let eventCount = 0;
    let lastResetTime = Date.now();
    let eventHistory: number[] = [];
    
    const listener = (event: NormalizedEvent) => {
      try {
        // 事件速率限制检查
        if (filter?.rate_limit) {
          const now = Date.now();
          
          // 每秒限制检查
          if (filter.rate_limit.max_events_per_second) {
            if (now - lastResetTime >= 1000) {
              eventCount = 0;
              lastResetTime = now;
            }
            
            if (eventCount >= filter.rate_limit.max_events_per_second) {
              console.warn(`[ApiBridge] Event rate limit exceeded for plugin ${this.pluginId}: ${eventCount} events/second`);
              this.onPluginFault('event-rate-limit-exceeded');
              return;
            }
            eventCount++;
          }
          
          // 每分钟限制检查
          if (filter.rate_limit.max_events_per_minute) {
            // 清理超过1分钟的历史记录
            eventHistory = eventHistory.filter(time => now - time < 60000);
            
            if (eventHistory.length >= filter.rate_limit.max_events_per_minute) {
              console.warn(`[ApiBridge] Event rate limit exceeded for plugin ${this.pluginId}: ${eventHistory.length} events/minute`);
              this.onPluginFault('event-rate-limit-exceeded');
              return;
            }
            eventHistory.push(now);
          }
        }
        
        // 事件数据验证
        if (!this.validateEvent(event)) {
          console.warn(`[ApiBridge] Invalid event data received for plugin ${this.pluginId}:`, event);
          this.onPluginFault('invalid-event-data');
          return;
        }
        
        // 基本过滤
        if (filter?.room_id && event.room_id !== filter.room_id) return;
        if (filter?.type && event.event_type !== filter.type) return;
        if (filter?.user_id && event.user_id !== filter.user_id) return;
        
        // 质量分数过滤
        if (filter?.min_quality_score) {
          const qualityScore = getEventQualityScore(event);
          if (qualityScore < filter.min_quality_score) return;
        }
        
        // 自定义过滤器
        if (filter?.custom_filters && filter.custom_filters.length > 0) {
          const availableFilters = DEFAULT_FILTERS.filter((f: EventFilter) => 
            filter.custom_filters!.includes(f.name)
          );
          const filterResult = applyFilters(event, availableFilters);
          if (!filterResult.passed) return;
        }
        
        // 安全地调用插件回调
        this.safePluginCallback(() => cb(event));
      } catch (err: any) {
        // 插件抛错不影响主进程，进行熔断计数（简化为直接通知）
        console.error(`[ApiBridge] Error in event handler for plugin ${this.pluginId}:`, err);
        this.onPluginFault('event-handler-error');
      }
    };
    
    this.roomManager.on('event', listener as any);
    return () => this.roomManager.off('event', listener as any);
  }

  /**
   * 验证事件数据的完整性和有效性
   */
  private validateEvent(event: NormalizedEvent): boolean {
    // 基本字段验证
    if (!event || typeof event !== 'object') return false;
    if (!event.event_type || typeof event.event_type !== 'string') return false;
    if (!event.ts || typeof event.ts !== 'number') return false;
    if (!event.room_id || typeof event.room_id !== 'string') return false;
    
    // 时间戳合理性检查（不能是未来时间，不能太久以前）
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    if (event.ts > now + 60000 || event.ts < now - maxAge) {
      return false;
    }
    
    // 根据事件类型进行特定验证
    switch (event.event_type) {
      case 'danmaku':
        return this.validateCommentEvent(event);
      case 'gift':
        return this.validateGiftEvent(event);
      case 'enter':
      case 'follow':
      case 'like':
        return this.validateUserEvent(event);
      default:
        return true; // 未知事件类型，允许通过
    }
  }

  /**
   * 验证评论事件
   */
  private validateCommentEvent(event: NormalizedEvent): boolean {
    if (!event.content || typeof event.content !== 'string') return false;
    if (!event.user_id || typeof event.user_id !== 'string') return false;
    if (!event.user_name || typeof event.user_name !== 'string') return false;
    
    // 内容长度检查
    if (event.content.length > 1000) return false;
    
    return true;
  }

  /**
   * 验证礼物事件
   */
  private validateGiftEvent(event: NormalizedEvent): boolean {
    if (!event.user_id || typeof event.user_id !== 'string') return false;
    if (!event.user_name || typeof event.user_name !== 'string') return false;
    // 礼物事件的具体礼物信息来自 raw，不在标准化事件合同中；此处仅做基本校验
    // 若需要更严格校验，应由上游解析器在 raw 中提供结构化数据
    if (event.content && typeof event.content !== 'string') return false;
    return true;
  }

  /**
   * 验证用户事件
   */
  private validateUserEvent(event: NormalizedEvent): boolean {
    if (!event.user_id || typeof event.user_id !== 'string') return false;
    if (!event.user_name || typeof event.user_name !== 'string') return false;
    
    return true;
  }

  /**
   * 安全地调用插件回调函数
   */
  private safePluginCallback(callback: () => void): void {
    try {
      // 使用 setTimeout 确保异步执行，避免阻塞主线程
      setTimeout(callback, 0);
    } catch (error) {
      console.error(`[ApiBridge] Plugin callback error for ${this.pluginId}:`, error);
      this.onPluginFault('callback-execution-error');
    }
  }

  /**
   * 代表插件调用 AcFun API。使用 acfunlive-http-api 进行统一的 API 调用。
   */
  async callAcfun(req: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: any }, options?: ApiCallOptions): Promise<any> {
    const callKey = `${this.pluginId}-${req.method}-${req.path}`;
    
    return await apiRetryManager.executeApiCall(
      callKey,
      async () => {
        // 检查速率限制
        const rateLimitCheck = await rateLimitManager.canMakeRequest();
        if (!rateLimitCheck.allowed) {
          const error = new Error(`RATE_LIMIT_EXCEEDED: ${rateLimitCheck.reason}`);
          (error as any).waitTime = rateLimitCheck.waitTime;
          this.onPluginFault('rate-limit-exceeded');
          throw error;
        }

        // 确保认证状态有效
        await this.ensureValidAuthentication();

        try {
          // 记录请求
          rateLimitManager.recordRequest();
          
          const httpClient = this.acfunApi.getHttpClient();
          let response;

          switch (req.method) {
            case 'GET':
              response = await httpClient.get(req.path);
              break;
            case 'POST':
              response = await httpClient.post(req.path, req.body);
              break;
            case 'PUT':
              response = await httpClient.put(req.path, req.body);
              break;
            case 'DELETE':
              response = await httpClient.delete(req.path);
              break;
            default:
              throw new Error(`Unsupported HTTP method: ${req.method}`);
          }

          if (!response.success) {
            // 记录错误状态码以便速率限制管理器处理
            const statusCode = response.statusCode || (response.error?.includes('429') ? 429 : 
                              response.error?.includes('503') ? 503 : undefined);
            if (statusCode) {
              rateLimitManager.recordError(statusCode);
            }

            // 检查是否是认证错误
            if (response.error && (response.error.includes('401') || response.error.includes('unauthorized'))) {
              // 由于无法自动刷新令牌，清除过期令牌并抛出错误
              console.warn('[ApiBridge] Authentication failed, clearing expired token');
              await this.authManager.logout();
              const err = new Error('ACFUN_TOKEN_EXPIRED');
              this.onPluginFault('token-expired');
              throw err;
            }
            
            const err = new Error(`ACFUN_API_ERROR: ${response.error || 'Unknown error'}`);
            this.onPluginFault(`acfun-api-error`);
            throw err;
          }

          return response.data;
        } catch (error: any) {
          // 如果是网络错误或服务器错误，记录到速率限制管理器
          if (error.message?.includes('503') || error.message?.includes('429')) {
            const statusCode = error.message.includes('429') ? 429 : 503;
            rateLimitManager.recordError(statusCode);
          }
          
          const err = new Error(`ACFUN_API_ERROR: ${error.message || 'Unknown error'}`);
          this.onPluginFault('acfun-api-error');
          throw err;
        }
      },
      options
    );
  }

  /**
   * 确保认证状态有效
   */
  private async ensureValidAuthentication(): Promise<void> {
    try {
      if (!this.tokenManager.isAuthenticated()) {
        const err = new Error('ACFUN_NOT_LOGGED_IN');
        this.onPluginFault('missing-token');
        throw err;
      }

      const tokenInfo = this.tokenManager.getTokenInfo();
      if (!tokenInfo || !tokenInfo.isValid) {
        // 令牌无效或过期，尝试刷新
        console.warn('[ApiBridge] Token invalid or expired, attempting refresh');
        const refreshResult = await this.tokenManager.refreshToken();
        if (!refreshResult.success) {
          const err = new Error('ACFUN_TOKEN_REFRESH_FAILED');
          this.onPluginFault('token-refresh-failed');
          throw err;
        }
      }

      // TokenManager已经确保API实例使用最新的认证状态
      console.log(`[ApiBridge] Authentication validated for plugin ${this.pluginId}`);
    } catch (error) {
      console.error('[ApiBridge] Authentication validation failed:', error);
      throw error;
    }
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
   * 认证API实现
   */
  public auth = {
    isAuthenticated: (): boolean => {
      return this.tokenManager.isAuthenticated();
    },

    getTokenInfo: (): any => {
      return this.tokenManager.getTokenInfo();
    },

    refreshToken: async (): Promise<any> => {
      return this.tokenManager.refreshToken();
    }
  };

  /**
   * 弹窗API实现
   */
  public popup = {
    create: async (options: PopupOptions): Promise<string> => {
      try {
        return this.popupManager.createPopup(this.pluginId, options);
      } catch (error: any) {
        this.onPluginFault('popup-creation-error');
        throw error;
      }
    },

    close: async (popupId: string): Promise<boolean> => {
      try {
        return this.popupManager.closePopup(popupId);
      } catch (error: any) {
        this.onPluginFault('popup-close-error');
        throw error;
      }
    },

    update: async (popupId: string, options: Partial<PopupOptions>): Promise<boolean> => {
      try {
        return this.popupManager.updatePopup(popupId, options);
      } catch (error: any) {
        this.onPluginFault('popup-update-error');
        throw error;
      }
    },

    show: async (popupId: string): Promise<boolean> => {
      try {
        return this.popupManager.showPopup(popupId);
      } catch (error: any) {
        this.onPluginFault('popup-show-error');
        throw error;
      }
    },

    hide: async (popupId: string): Promise<boolean> => {
      try {
        return this.popupManager.hidePopup(popupId);
      } catch (error: any) {
        this.onPluginFault('popup-hide-error');
        throw error;
      }
    },

    action: async (popupId: string, actionId: string): Promise<boolean> => {
      try {
        return this.popupManager.handlePopupAction(popupId, actionId);
      } catch (error: any) {
        this.onPluginFault('popup-action-error');
        throw error;
      }
    },

    bringToFront: async (popupId: string): Promise<boolean> => {
      try {
        return this.popupManager.bringToFront(popupId);
      } catch (error: any) {
        this.onPluginFault('popup-bring-to-front-error');
        throw error;
      }
    },

    getAll: async (): Promise<PopupInstance[]> => {
      try {
        return this.popupManager.getPluginPopups(this.pluginId);
      } catch (error: any) {
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
      } catch (error: any) {
        this.onPluginFault('popup-get-error');
        throw error;
      }
    },

    closeAll: async (): Promise<number> => {
      try {
        return this.popupManager.closePluginPopups(this.pluginId);
      } catch (error: any) {
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
          } catch (error: any) {
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
          } catch (error: any) {
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
          } catch (error: any) {
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
          } catch (error: any) {
            this.onPluginFault('popup-hide-callback-error');
          }
        }
      };
      this.popupManager.on('popup.hidden', listener);
      return () => this.popupManager.off('popup.hidden', listener);
    }
  };
}