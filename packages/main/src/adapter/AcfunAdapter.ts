import { EventEmitter } from 'events';
import { AcFunLiveApi } from 'acfunlive-http-api';
import { AuthManager } from '../services/AuthManager';
import { ConnectionPoolManager } from './ConnectionPoolManager';
import { ApiRetryManager } from '../services/ApiRetryManager';
import { ConnectionErrorHandler } from './ConnectionErrorHandler';

/**
 * 弹幕消息接口
 * 定义从 AcFun 直播间接收到的弹幕消息结构
 */
export interface DanmuMessage {
  /** 消息唯一标识符 */
  id: string;
  /** 用户ID */
  userId: string;
  /** 用户昵称 */
  nickname: string;
  /** 弹幕内容 */
  content: string;
  /** 发送时间戳 */
  timestamp: number;
  /** 消息类型 */
  type: 'danmu' | 'gift' | 'like' | 'enter' | 'follow';
  /** 房间ID */
  roomId: string;
  /** 额外数据（可选） */
  extra?: any;
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
  /** 认证管理器实例 */
  private authManager: AuthManager;
  /** 连接池管理器实例 */
  private connectionPool: ConnectionPoolManager;
  /** API 重试管理器实例 */
  private apiRetryManager: ApiRetryManager;
  /** 连接错误处理器实例 */
  private connectionErrorHandler: ConnectionErrorHandler;
  /** 重连定时器 */
  private reconnectTimer: NodeJS.Timeout | null = null;
  /** 心跳定时器 */
  private heartbeatTimer: NodeJS.Timeout | null = null;
  /** 当前重连尝试次数 */
  private reconnectAttempts: number = 0;
  /** 是否正在连接中 */
  private isConnecting: boolean = false;
  /** 是否已销毁 */
  private isdestroyed: boolean = false;
  /** 消息处理器映射 */
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  /**
   * 构造函数
   * @param config 适配器配置
   * @param authManager 认证管理器实例（可选）
   * @param connectionPool 连接池管理器实例（可选）
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
      ...config
    };

    // 初始化依赖组件
    this.authManager = authManager || new AuthManager();
    this.connectionPool = connectionPool || new ConnectionPoolManager();
    this.apiRetryManager = new ApiRetryManager();
    this.connectionErrorHandler = new ConnectionErrorHandler();

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

    // API 重试管理器事件
    this.apiRetryManager.on('retryAttempt', (attempt: number, error: Error) => {
      if (this.config.debug) {
        console.log(`[AcfunAdapter] Retry attempt ${attempt}:`, error.message);
      }
    });

    this.apiRetryManager.on('retryFailed', (error: Error) => {
      console.error('[AcfunAdapter] All retry attempts failed:', error);
      this.handleConnectionError(error);
    });

    // 连接错误处理器事件
    this.connectionErrorHandler.on('connectionLost', () => {
      this.setConnectionState(ConnectionState.DISCONNECTED);
      if (this.config.autoReconnect && !this.isDestroyed) {
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
        id: data.id || `${Date.now()}_${Math.random()}`,
        userId: data.userId,
        nickname: data.nickname,
        content: data.content,
        timestamp: data.timestamp || Date.now(),
        type: 'danmu',
        roomId: this.config.roomId,
        extra: data.extra
      };
      this.emit('danmu', message);
    });

    // 礼物消息处理器
    this.messageHandlers.set('gift', (data: any) => {
      const message: DanmuMessage = {
        id: data.id || `${Date.now()}_${Math.random()}`,
        userId: data.userId,
        nickname: data.nickname,
        content: `送出了 ${data.giftName} x${data.count}`,
        timestamp: data.timestamp || Date.now(),
        type: 'gift',
        roomId: this.config.roomId,
        extra: {
          giftId: data.giftId,
          giftName: data.giftName,
          count: data.count,
          value: data.value
        }
      };
      this.emit('gift', message);
    });

    // 点赞消息处理器
    this.messageHandlers.set('like', (data: any) => {
      const message: DanmuMessage = {
        id: data.id || `${Date.now()}_${Math.random()}`,
        userId: data.userId,
        nickname: data.nickname,
        content: '点赞了直播间',
        timestamp: data.timestamp || Date.now(),
        type: 'like',
        roomId: this.config.roomId,
        extra: data.extra
      };
      this.emit('like', message);
    });

    // 用户进入房间处理器
    this.messageHandlers.set('enter', (data: any) => {
      const message: DanmuMessage = {
        id: data.id || `${Date.now()}_${Math.random()}`,
        userId: data.userId,
        nickname: data.nickname,
        content: '进入了直播间',
        timestamp: data.timestamp || Date.now(),
        type: 'enter',
        roomId: this.config.roomId,
        extra: data.extra
      };
      this.emit('enter', message);
    });

    // 用户关注处理器
    this.messageHandlers.set('follow', (data: any) => {
      const message: DanmuMessage = {
        id: data.id || `${Date.now()}_${Math.random()}`,
        userId: data.userId,
        nickname: data.nickname,
        content: '关注了主播',
        timestamp: data.timestamp || Date.now(),
        type: 'follow',
        roomId: this.config.roomId,
        extra: data.extra
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
    const isAuthenticated = await this.authManager.isAuthenticated();
    
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

    // 启动弹幕服务的具体实现
    // 这里需要根据实际的 API 接口进行调用
  }

  /**
   * 停止弹幕服务
   * @private
   */
  private async stopDanmuService(): Promise<void> {
    if (!this.api) {
      return;
    }

    // 停止弹幕服务的具体实现
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
      // 发送心跳的具体实现
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
    
    if (this.config.autoReconnect && !this.isDestroyed) {
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

