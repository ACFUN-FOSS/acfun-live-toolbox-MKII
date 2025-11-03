import { EventEmitter } from 'events';
import { AcFunLiveApi, createApi, ApiConfig, DanmuMessage as StandardDanmuMessage, UserInfo, ManagerType } from 'acfunlive-http-api';
import { AuthManager } from '../services/AuthManager';
import { TokenManager } from '../services/TokenManager';
import { ConnectionPoolManager } from './ConnectionPoolManager';
import { ApiRetryManager } from '../services/ApiRetryManager';
import { ConnectionErrorHandler } from './ConnectionErrorHandler';

/**
 * 弹幕消息接口（扩展标准接口）
 * 基于 acfunlive-http-api 的标准 DanmuMessage 接口
 */
export interface DanmuMessage extends StandardDanmuMessage {
  /** 消息类型 */
  type: 'comment' | 'gift' | 'like' | 'enter' | 'follow' | 'throwBanana' | 'joinClub' | 'shareLive';
  /** 房间ID */
  roomId: string;
}

/**
 * 连接状态枚举
 * 定义适配器的各种连接状态
 */
export enum ConnectionState {
  /** 已断开连接 */
  DISCONNECTED = 'DISCONNECTED',
  /** 连接中 */
  CONNECTING = 'CONNECTING',
  /** 已连接 */
  CONNECTED = 'CONNECTED',
  /** 重连中 */
  RECONNECTING = 'RECONNECTING',
  /** 连接失败 */
  FAILED = 'FAILED'
}

/**
 * 适配器配置接口
 * 定义 AcfunAdapter 的配置选项
 */
export interface AdapterConfig {
  /** 房间ID */
  roomId: string;
  /** 是否自动重连 */
  autoReconnect: boolean;
  /** 重连间隔（毫秒） */
  reconnectInterval: number;
  /** 最大重连次数 */
  maxReconnectAttempts: number;
  /** 连接超时时间（毫秒） */
  connectionTimeout: number;
  /** 心跳间隔（毫秒） */
  heartbeatInterval: number;
  /** 是否启用调试模式 */
  debug: boolean;
  /** API配置 */
  apiConfig?: Partial<ApiConfig>;
}

/**
 * 适配器事件接口
 * 定义适配器可以触发的所有事件类型
 */
export interface AdapterEvents {
  /** 连接状态变化事件 */
  'connection-state-changed': (state: ConnectionState, previousState: ConnectionState) => void;
  /** 弹幕消息事件 */
  'danmu': (message: DanmuMessage) => void;
  /** 礼物消息事件 */
  'gift': (message: DanmuMessage) => void;
  /** 点赞消息事件 */
  'like': (message: DanmuMessage) => void;
  /** 用户进入房间事件 */
  'enter': (message: DanmuMessage) => void;
  /** 用户关注事件 */
  'follow': (message: DanmuMessage) => void;
  /** 连接错误事件 */
  'error': (error: Error) => void;
  /** 重连事件 */
  'reconnect': (attempt: number) => void;
  /** 认证成功事件 */
  'authenticated': () => void;
  /** 认证失败事件 */
  'auth-failed': (error: Error) => void;
}

/**
 * AcFun 直播适配器类
 * 
 * 这是一个高级适配器，封装了与 AcFun 直播平台的交互逻辑，提供以下功能：
 * - 自动认证管理
 * - 连接池管理
 * - 弹幕消息处理
 * - 自动重连机制
 * - 错误处理和恢复
 * - 性能监控
 * 
 * 主要特性：
 * - 使用连接池提高性能和资源利用率
 * - 集成认证管理器处理登录状态
 * - 支持多种消息类型（弹幕、礼物、点赞等）
 * - 提供详细的事件系统用于状态监控
 * - 自动处理网络异常和重连逻辑
 * 
 * @extends EventEmitter
 * @emits connection-state-changed - 连接状态变化时触发
 * @emits danmu - 收到弹幕消息时触发
 * @emits gift - 收到礼物消息时触发
 * @emits like - 收到点赞消息时触发
 * @emits enter - 用户进入房间时触发
 * @emits follow - 用户关注时触发
 * @emits error - 发生错误时触发
 * @emits reconnect - 重连时触发
 * @emits authenticated - 认证成功时触发
 * @emits auth-failed - 认证失败时触发
 */
export class AcfunAdapter extends EventEmitter {
  /** 适配器配置 */
  private config: AdapterConfig;
  /** 当前连接状态 */
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  /** AcFun Live API 实例 */
  private api: AcFunLiveApi | null = null;
  /** Token管理器 */
  private tokenManager: TokenManager;
  /** 认证管理器 */
  private authManager: AuthManager;
  /** 连接池管理器 */
  private connectionPool: ConnectionPoolManager;
  /** API 重试管理器 */
  private apiRetryManager: ApiRetryManager;
  /** 连接错误处理器 */
  private connectionErrorHandler: ConnectionErrorHandler;
  /** 重连定时器 */
  private reconnectTimer: NodeJS.Timeout | null = null;
  /** 心跳定时器 */
  private heartbeatTimer: NodeJS.Timeout | null = null;
  /** 重连尝试次数 */
  private reconnectAttempts: number = 0;
  /** 是否正在连接中 */
  private isConnecting: boolean = false;
  /** 是否已销毁 */
  private isdestroyed: boolean = false;
  /** 弹幕会话ID */
  private danmuSessionId: string | null = null;
  /** 消息处理器映射 */
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  /**
   * 构造函数
   * @param config 适配器配置
   * @param authManager 认证管理器（可选）
   * @param connectionPool 连接池管理器（可选）
   */
  constructor(
    config: Partial<AdapterConfig> = {},
    authManager?: AuthManager,
    connectionPool?: ConnectionPoolManager
  ) {
    super();

    // 合并默认配置和用户配置
    this.config = {
      roomId: '',
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      connectionTimeout: 30000,
      heartbeatInterval: 30000,
      debug: false,
      apiConfig: {
        timeout: 30000,
        retryCount: 3,
        baseUrl: 'https://api-new.acfunchina.com',
        headers: {
          'User-Agent': 'AcFun-Live-Toolbox/2.0'
        }
      },
      ...config
    };

    // 初始化依赖组件
    this.tokenManager = TokenManager.getInstance();
    this.authManager = authManager || new AuthManager();
    this.connectionPool = connectionPool || new ConnectionPoolManager();
    this.apiRetryManager = new ApiRetryManager();
    this.connectionErrorHandler = new ConnectionErrorHandler();

    // 使用TokenManager提供的统一API实例
    this.api = this.tokenManager.getApiInstance();

    // 设置事件监听器
    this.setupEventListeners();
    
    // 初始化消息处理器
    this.initializeMessageHandlers();

    if (this.config.debug) {
      console.log('[AcfunAdapter] Initialized with config:', this.config);
    }
  }

  /**
   * 设置事件监听器
   * 配置各个组件之间的事件通信
   * @private
   */
  private setupEventListeners(): void {
    // 认证管理器事件
    this.authManager.on('loginSuccess', () => {
      this.emit('authenticated');
      if (this.config.debug) {
        console.log('[AcfunAdapter] Authentication successful');
      }
    });

    this.authManager.on('loginFailed', (error: Error) => {
      this.emit('auth-failed', error);
      this.handleConnectionError(error);
    });

    this.authManager.on('tokenExpiring', () => {
      if (this.config.debug) {
        console.log('[AcfunAdapter] Token expiring, refreshing...');
      }
    });

    // API 调用管理器事件
    this.apiRetryManager.on('api-call', (event: { key: string; success: boolean; duration: number }) => {
      if (this.config.debug) {
        console.log(`[AcfunAdapter] API call ${event.key}: ${event.success ? 'success' : 'failed'} (${event.duration}ms)`);
      }
    });

    this.apiRetryManager.on('auth-refresh-failed', (event: { key: string; error: string }) => {
      console.error('[AcfunAdapter] Authentication refresh failed:', event.error);
      this.handleConnectionError(new Error(event.error));
    });

    // 连接错误处理器事件
    this.connectionErrorHandler.on('connectionLost', () => {
      this.setConnectionState(ConnectionState.DISCONNECTED);
      if (this.config.autoReconnect && !this.isdestroyed) {
        this.scheduleReconnect();
      }
    });

    this.connectionErrorHandler.on('connectionRecovered', () => {
      this.reconnectAttempts = 0;
      this.setConnectionState(ConnectionState.CONNECTED);
    });
  }

  /**
   * 初始化消息处理器
   * 设置不同类型消息的处理函数
   * @private
   */
  private initializeMessageHandlers(): void {
    // 弹幕消息处理器
    this.messageHandlers.set('danmu', (data: any) => {
      const message: DanmuMessage = {
        sendTime: data.timestamp || Date.now(),
        userInfo: {
          userID: Number(data.userId) || 0,
          nickname: data.nickname || '',
          avatar: data.avatar || '',
          medal: { uperID: 0, userID: Number(data.userId) || 0, clubName: '', level: 0 },
          managerType: ManagerType.NotManager
        },
        type: 'comment',
        roomId: this.config.roomId
      };
      this.emit('danmu', message);
    });

    // 礼物消息处理器
    this.messageHandlers.set('gift', (data: any) => {
      const message: DanmuMessage = {
        sendTime: data.timestamp || Date.now(),
        userInfo: {
          userID: Number(data.userId) || 0,
          nickname: data.nickname || '',
          avatar: data.avatar || '',
          medal: { uperID: 0, userID: Number(data.userId) || 0, clubName: '', level: 0 },
          managerType: ManagerType.NotManager
        },
        type: 'gift',
        roomId: this.config.roomId
      };
      this.emit('gift', message);
    });

    // 点赞消息处理器
    this.messageHandlers.set('like', (data: any) => {
      const message: DanmuMessage = {
        sendTime: data.timestamp || Date.now(),
        userInfo: {
          userID: Number(data.userId) || 0,
          nickname: data.nickname || '',
          avatar: data.avatar || '',
          medal: { uperID: 0, userID: Number(data.userId) || 0, clubName: '', level: 0 },
          managerType: ManagerType.NotManager
        },
        type: 'like',
        roomId: this.config.roomId
      };
      this.emit('like', message);
    });

    // 用户进入房间处理器
    this.messageHandlers.set('enter', (data: any) => {
      const message: DanmuMessage = {
        sendTime: data.timestamp || Date.now(),
        userInfo: {
          userID: Number(data.userId) || 0,
          nickname: data.nickname || '',
          avatar: data.avatar || '',
          medal: { uperID: 0, userID: Number(data.userId) || 0, clubName: '', level: 0 },
          managerType: ManagerType.NotManager
        },
        type: 'enter',
        roomId: this.config.roomId
      };
      this.emit('enter', message);
    });

    // 用户关注处理器
    this.messageHandlers.set('follow', (data: any) => {
      const message: DanmuMessage = {
        sendTime: data.timestamp || Date.now(),
        userInfo: {
          userID: Number(data.userId) || 0,
          nickname: data.nickname || '',
          avatar: data.avatar || '',
          medal: { uperID: 0, userID: Number(data.userId) || 0, clubName: '', level: 0 },
          managerType: ManagerType.NotManager
        },
        type: 'follow',
        roomId: this.config.roomId
      };
      this.emit('follow', message);
    });
  }

  /**
   * 连接到直播间
   * 
   * 此方法执行完整的连接流程：
   * 1. 验证配置和状态
   * 2. 确保用户已认证
   * 3. 从连接池获取 API 实例
   * 4. 启动弹幕服务
   * 5. 设置心跳机制
   * 
   * @returns Promise<void> 连接完成的 Promise
   * @throws {Error} 当连接失败时抛出错误
   */
  async connect(): Promise<void> {
    if (this.isdestroyed) {
      throw new Error('Adapter has been destroyed');
    }

    if (this.isConnecting) {
      if (this.config.debug) {
        console.log('[AcfunAdapter] Already connecting, skipping...');
      }
      return;
    }

    if (this.connectionState === ConnectionState.CONNECTED) {
      if (this.config.debug) {
        console.log('[AcfunAdapter] Already connected, skipping...');
      }
      return;
    }

    if (!this.config.roomId) {
      throw new Error('Room ID is required');
    }

    this.isConnecting = true;
    this.setConnectionState(ConnectionState.CONNECTING);

    try {
      // 确保用户已认证
      await this.ensureAuthentication();

      // 从连接池获取 API 实例
      const connection = await this.connectionPool.acquire('danmu', {
        roomId: this.config.roomId
      });
      
      this.api = connection.api;

      // 启动弹幕服务
      await this.startDanmuService();

      // 设置心跳
      this.startHeartbeat();

      // 连接成功
      this.reconnectAttempts = 0;
      this.setConnectionState(ConnectionState.CONNECTED);

      if (this.config.debug) {
        console.log(`[AcfunAdapter] Successfully connected to room ${this.config.roomId}`);
      }

    } catch (error) {
      this.handleConnectionError(error as Error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 断开连接
   * 
   * 清理所有资源并断开与直播间的连接
   * 
   * @returns Promise<void> 断开完成的 Promise
   */
  async disconnect(): Promise<void> {
    if (this.connectionState === ConnectionState.DISCONNECTED) {
      return;
    }

    this.setConnectionState(ConnectionState.DISCONNECTED);

    // 清理定时器
    this.clearTimers();

    // 停止弹幕服务
    if (this.api) {
      try {
        await this.stopDanmuService();
      } catch (error) {
        console.warn('[AcfunAdapter] Error stopping danmu service:', error);
      }
    }

    // 释放 API 实例
    this.api = null;
    
    // 清理弹幕会话ID
    this.danmuSessionId = null;

    if (this.config.debug) {
      console.log('[AcfunAdapter] Disconnected successfully');
    }
  }

  /**
   * 重新连接
   * 
   * 断开当前连接并重新建立连接
   * 
   * @returns Promise<void> 重连完成的 Promise
   */
  async reconnect(): Promise<void> {
    if (this.isdestroyed) {
      return;
    }

    this.setConnectionState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    this.emit('reconnect', this.reconnectAttempts);

    if (this.config.debug) {
      console.log(`[AcfunAdapter] Reconnecting... (attempt ${this.reconnectAttempts})`);
    }

    try {
      await this.disconnect();
      await this.connect();
    } catch (error) {
      console.error('[AcfunAdapter] Reconnection failed:', error);
      
      if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        console.error('[AcfunAdapter] Max reconnection attempts reached');
        this.setConnectionState(ConnectionState.FAILED);
        this.emit('error', new Error('Max reconnection attempts reached'));
      }
    }
  }

  /**
   * 销毁适配器
   * 
   * 清理所有资源并销毁适配器实例
   * 
   * @returns Promise<void> 销毁完成的 Promise
   */
  async destroy(): Promise<void> {
    this.isdestroyed = true;

    // 断开连接
    await this.disconnect();

    // 清理定时器
    this.clearTimers();

    // 销毁组件
    this.apiRetryManager.cleanup();
    this.connectionErrorHandler.destroy();

    // 移除所有事件监听器
    this.removeAllListeners();

    if (this.config.debug) {
      console.log('[AcfunAdapter] Adapter destroyed');
    }
  }

  // 私有辅助方法

  /**
   * 设置连接状态
   * @param newState 新的连接状态
   * @private
   */
  private setConnectionState(newState: ConnectionState): void {
    const previousState = this.connectionState;
    if (previousState !== newState) {
      this.connectionState = newState;
      this.emit('connection-state-changed', newState, previousState);
    }
  }

  /**
   * 确保认证状态有效
   * @private
   */
  private async ensureAuthentication(): Promise<void> {
    // 检查认证状态并处理
    const isAuthenticated = await this.tokenManager.isAuthenticated();
    
    if (!isAuthenticated) {
      if (this.config.debug) {
        console.log('[AcfunAdapter] Authentication required but not available');
      }
      // 可以选择抛出错误或继续匿名访问
    }
  }

  /**
   * 启动弹幕服务
   * @private
   */
  private async startDanmuService(): Promise<void> {
    if (!this.api) {
      throw new Error('API instance not available');
    }

    try {
      // 获取认证令牌信息
      const tokenInfo = await this.tokenManager.getTokenInfo();
      
      if (tokenInfo) {
        // 设置认证令牌到API实例
        this.api.setAuthToken(tokenInfo.serviceToken);
      }

      // 启动弹幕服务 - 使用标准的 startDanmu 方法
      if (this.api.danmu && typeof this.api.danmu.startDanmu === 'function') {
        const result = await this.api.danmu.startDanmu(this.config.roomId, (event: any) => {
          // 处理弹幕事件回调
          this.handleDanmuEvent(event);
        });
        
        if (result.success && result.data) {
          // 保存会话ID用于后续停止操作
          this.danmuSessionId = result.data.sessionId;
          
          if (this.config.debug) {
            console.log('[AcfunAdapter] Danmu service started with session ID:', this.danmuSessionId);
          }
        } else {
          throw new Error(result.error || 'Failed to start danmu service');
        }
      } else {
        throw new Error('DanmuService.startDanmu method not available');
      }
    } catch (error) {
      console.error('[AcfunAdapter] Failed to start danmu service:', error);
      throw error;
    }
  }

  /**
   * 停止弹幕服务
   * @private
   */
  private async stopDanmuService(): Promise<void> {
    if (!this.api) {
      return;
    }

    try {
      // 停止弹幕服务 - 使用标准的 stopDanmu 方法
      if (this.api.danmu && typeof this.api.danmu.stopDanmu === 'function' && this.danmuSessionId) {
        const result = await this.api.danmu.stopDanmu(this.danmuSessionId);
        
        if (result.success) {
          if (this.config.debug) {
            console.log('[AcfunAdapter] Danmu service stopped for session:', this.danmuSessionId);
          }
        } else {
          console.warn('[AcfunAdapter] Failed to stop danmu service:', result.error);
        }
        
        // 清除会话ID
        this.danmuSessionId = null;
      }
      
      // 清除认证令牌
      this.api.clearAuthToken();
    } catch (error) {
      console.error('[AcfunAdapter] Failed to stop danmu service:', error);
    }
  }

  /**
   * 处理弹幕事件回调
   * @private
   */
  private handleDanmuEvent(event: any): void {
    if (!event || typeof event !== 'object') {
      return;
    }

    try {
      // 根据事件类型分发处理
      switch (event.type) {
        case 'comment':
        case 'danmu':
          this.handleDanmuMessage(event);
          break;
        case 'gift':
          this.handleGiftMessage(event);
          break;
        case 'like':
          this.handleLikeMessage(event);
          break;
        case 'enter':
          this.handleEnterMessage(event);
          break;
        case 'follow':
          this.handleFollowMessage(event);
          break;
        case 'error':
          this.handleConnectionError(new Error(event.message || 'Danmu service error'));
          break;
        default:
          if (this.config.debug) {
            console.log('[AcfunAdapter] Unknown danmu event type:', event.type, event);
          }
          break;
      }
    } catch (error) {
      console.error('[AcfunAdapter] Error handling danmu event:', error);
    }
  }



  /**
   * 安全地发射事件，捕获监听器中的错误
   * @private
   */
  private safeEmit(eventName: string, ...args: any[]): void {
    try {
      // 检查是否已销毁
      if (this.isdestroyed) {
        if (this.config.debug) {
          console.warn(`[AcfunAdapter] Attempted to emit ${eventName} on destroyed adapter`);
        }
        return;
      }

      // 检查是否有监听器
      if (this.listenerCount(eventName) === 0) {
        return;
      }

      // 获取所有监听器
      const listeners = this.listeners(eventName);
      
      // 逐个调用监听器，捕获每个监听器的错误
      for (const listener of listeners) {
        try {
          if (typeof listener === 'function') {
            listener.apply(this, args);
          }
        } catch (error) {
          console.error(`[AcfunAdapter] Error in event listener for ${eventName}:`, error);
          
          // 发射错误事件，但避免无限递归
          if (eventName !== 'error') {
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    } catch (error) {
      console.error(`[AcfunAdapter] Critical error in safeEmit for ${eventName}:`, error);
    }
  }

  /**
   * 处理弹幕消息
   * @private
   */
  private handleDanmuMessage(data: any): void {
    try {
      // 直接使用标准的 DanmuMessage 结构
      const message: DanmuMessage = {
        ...data,
        type: 'comment',
        roomId: this.config.roomId
      };
      
      this.safeEmit('danmu', message);
    } catch (error) {
      console.error('[AcfunAdapter] Error handling danmu message:', error);
      this.safeEmit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 处理礼物消息
   * @private
   */
  private handleGiftMessage(data: any): void {
    try {
      // 直接使用标准的 DanmuMessage 结构
      const message: DanmuMessage = {
        ...data,
        type: 'gift',
        roomId: this.config.roomId
      };
      
      this.safeEmit('gift', message);
    } catch (error) {
      console.error('[AcfunAdapter] Error handling gift message:', error);
      this.safeEmit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 处理点赞消息
   * @private
   */
  private handleLikeMessage(data: any): void {
    try {
      // 直接使用标准的 DanmuMessage 结构
      const message: DanmuMessage = {
        ...data,
        type: 'like',
        roomId: this.config.roomId
      };
      
      this.safeEmit('like', message);
    } catch (error) {
      console.error('[AcfunAdapter] Error handling like message:', error);
      this.safeEmit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 处理进入房间消息
   * @private
   */
  private handleEnterMessage(data: any): void {
    try {
      // 直接使用标准的 DanmuMessage 结构
      const message: DanmuMessage = {
        ...data,
        type: 'enter',
        roomId: this.config.roomId
      };
      
      this.safeEmit('enter', message);
    } catch (error) {
      console.error('[AcfunAdapter] Error handling enter message:', error);
      this.safeEmit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 处理关注消息
   * @private
   */
  private handleFollowMessage(data: any): void {
    try {
      // 直接使用标准的 DanmuMessage 结构
      const message: DanmuMessage = {
        ...data,
        type: 'follow',
        roomId: this.config.roomId
      };
      
      this.safeEmit('follow', message);
    } catch (error) {
      console.error('[AcfunAdapter] Error handling follow message:', error);
      this.safeEmit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 启动心跳机制
   * @private
   */
  private startHeartbeat(): void {
    this.clearHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * 发送心跳
   * @private
   */
  private sendHeartbeat(): void {
    if (this.api && this.connectionState === ConnectionState.CONNECTED) {
      // DanmuService 内部已维护心跳；此处进行轻量健康检查以保持连接状态监控
      try {
        if (this.api.danmu && this.danmuSessionId) {
          const health = this.api.danmu.getSessionHealth(this.danmuSessionId);
          // 可根据需要使用 health 数据做日志或状态更新（省略）
        }
      } catch (error) {
        if (this.config.debug) {
          console.warn('[AcfunAdapter] Heartbeat/health check failed:', error);
        }
        this.handleConnectionError(error as Error);
      }
    }
  }

  /**
   * 清理心跳定时器
   * @private
   */
  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 处理连接错误
   * @param error 错误对象
   * @private
   */
  private handleConnectionError(error: Error): void {
    console.error('[AcfunAdapter] Connection error:', error);
    
    this.emit('error', error);
    
    if (this.config.autoReconnect && !this.isDestroyed()) {
      this.scheduleReconnect();
    }
  }

  /**
   * 安排重连
   * @private
   */
  private scheduleReconnect(): void {
    if (this.isdestroyed || this.reconnectTimer) {
      return;
    }

    if (this.config.debug) {
      console.log(`[AcfunAdapter] Scheduling reconnection in ${this.config.reconnectInterval}ms`);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnect().catch(error => {
        console.error('[AcfunAdapter] Scheduled reconnection failed:', error);
      });
    }, this.config.reconnectInterval);
  }

  /**
   * 清理所有定时器
   * @private
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.clearHeartbeat();
  }

  // 公共访问器方法

  /**
   * 获取当前连接状态
   * @returns 当前连接状态
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * 获取适配器配置
   * @returns 适配器配置
   */
  getConfig(): AdapterConfig {
    return { ...this.config };
  }

  /**
   * 获取认证管理器实例
   * @returns 认证管理器实例
   */
  getAuthManager(): AuthManager {
    return this.authManager;
  }

  /**
   * 获取Token管理器实例
   * @returns Token管理器实例
   */
  getTokenManager(): TokenManager {
    return this.tokenManager;
  }

  /**
   * 获取连接池管理器实例
   * @returns 连接池管理器实例
   */
  getConnectionPool(): ConnectionPoolManager {
    return this.connectionPool;
  }

  /**
   * 获取 API 重试管理器实例
   * @returns API 重试管理器实例
   */
  getApiRetryManager(): ApiRetryManager {
    return this.apiRetryManager;
  }

  /**
   * 检查适配器是否已销毁
   * @returns 是否已销毁
   */
  isDestroyed(): boolean {
    return this.isdestroyed;
  }
}

