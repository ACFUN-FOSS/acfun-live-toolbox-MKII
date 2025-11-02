import { EventEmitter } from 'events';
import type { RoomStatus, NormalizedEvent } from '../types';
import {  DanmuMessage, Comment, Like, EnterRoom, FollowAuthor, ThrowBanana, Gift, RichText, JoinClub, ShareLive } from 'acfunlive-http-api';
import { ConnectionErrorHandler, ConnectionErrorType } from './ConnectionErrorHandler';
import { connectionPool, PooledConnection } from './ConnectionPoolManager';
import { AuthManager } from '../services/AuthManager';
import { EventFilterManager } from '../events/EventFilterManager';
import { ConfigManager } from '../config/ConfigManager';
import { ApiRetryManager } from '../services/ApiRetryManager';

export interface AcfunAdapterEvents {
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: Error) => void;
  'event': (event: NormalizedEvent) => void;
  'statusChange': (status: RoomStatus) => void;
}

export class AcfunAdapter extends EventEmitter {
  private roomId: string;
  private status: RoomStatus = 'closed';
  private connectionTimeout: NodeJS.Timeout | null = null;
  private connectionStartTime: number = 0;
  private isShuttingDown: boolean = false;
  private pooledConnection: PooledConnection | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private errorHandler: ConnectionErrorHandler;
  private authManager: AuthManager;
  private filterManager: EventFilterManager;
  private apiRetryManager: ApiRetryManager;

  // 连接配置常量
  private readonly CONNECTION_TIMEOUT = 30000; // 30秒
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_BASE_DELAY = 1000; // 1秒基础延迟

  constructor(roomId: string, authManager?: AuthManager, configManager?: ConfigManager) {
    super();
    this.roomId = roomId;
    this.authManager = authManager || new AuthManager();
    this.filterManager = new EventFilterManager(configManager || new ConfigManager());
    
    // 初始化API重试管理器，并与AuthManager集成
    this.apiRetryManager = new ApiRetryManager(this.authManager);
    
    // 初始化错误处理器
    this.errorHandler = new ConnectionErrorHandler();
    this.setupErrorHandling();
    this.setupApiRetryHandling();
  }

  private setupApiRetryHandling(): void {
    // 监听API重试事件
    this.apiRetryManager.on('retry-attempt', (data) => {
      console.log(`[AcfunAdapter] API retry attempt ${data.attempt}/${data.maxAttempts} for ${data.key}, delay: ${data.delay}ms`);
    });

    this.apiRetryManager.on('retry-success', (data) => {
      console.log(`[AcfunAdapter] API retry succeeded for ${data.key} after ${data.attempts} attempts, total time: ${data.totalTime}ms`);
    });

    this.apiRetryManager.on('retry-failed', (data) => {
      console.error(`[AcfunAdapter] API retry failed for ${data.key} after ${data.attempts} attempts:`, data.finalError.message);
    });

    this.apiRetryManager.on('auth-refresh-failed', (data) => {
      console.error(`[AcfunAdapter] Authentication refresh failed for ${data.key}:`, data.error);
      // 认证刷新失败时，可能需要用户重新登录
      this.emit('error', new Error(`Authentication failed: ${data.error}`));
    });

    this.apiRetryManager.on('max-retries-exceeded', (data) => {
      console.error(`[AcfunAdapter] Max retries exceeded for ${data.key}, error type: ${data.errorType}`);
    });
  }

  public async connect(): Promise<void> {
    if (this.status === 'connecting' || this.status === 'open') {
      return;
    }

    this.setStatus('connecting');
    this.connectionStartTime = Date.now();
    this.isShuttingDown = false;

    try {
      // 设置连接超时
      this.connectionTimeout = setTimeout(async () => {
        await this.handleConnectionError(new Error('Connection timeout'));
      }, this.CONNECTION_TIMEOUT);

      await this.establishRealConnection();
      
      this.clearTimers();
      this.setStatus('open');
      this.reconnectAttempts = 0;
      
      console.log(`[AcfunAdapter] Successfully connected to room ${this.roomId}`);
      
    } catch (error) {
      this.clearTimers();
      this.setStatus('closed');
      
      if (!this.isShuttingDown) {
        await this.handleConnectionError(error as Error);
      }
      
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    this.isShuttingDown = true;
    this.clearTimers();
    
    if (this.sessionId && this.pooledConnection) {
      try {
        await this.pooledConnection.api.danmu.stopDanmu(this.sessionId);
        console.log(`[AcfunAdapter] Stopped danmu session: ${this.sessionId}`);
      } catch (error) {
        console.error(`[AcfunAdapter] Error stopping danmu session:`, error);
      }
      this.sessionId = null;
    }
    
    // 释放连接池中的连接
    if (this.pooledConnection) {
      connectionPool.release(this.pooledConnection.id);
      this.pooledConnection = null;
    }
    
    this.setStatus('closed');
    console.log(`[AcfunAdapter] Disconnected from room ${this.roomId}`);
  }

  public async reconnect(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
      const error = new Error(`Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) exceeded`);
      this.handleConnectionError(error);
      throw error;
    }

    // 指数退避延迟
    const delay = this.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[AcfunAdapter] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        if (!this.isShuttingDown) {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  public getStatus(): RoomStatus {
    return this.status;
  }

  public getRoomId(): string {
    return this.roomId;
  }

  public getConnectionDuration(): number {
    if (this.status === 'open' && this.connectionStartTime > 0) {
      return Date.now() - this.connectionStartTime;
    }
    return 0;
  }

  public getAuthManager(): AuthManager {
    return this.authManager;
  }

  public getApiRetryManager(): ApiRetryManager {
    return this.apiRetryManager;
  }

  public async destroy(): Promise<void> {
    this.isShuttingDown = true;
    
    // 清理定时器
    this.clearTimers();
    
    // 断开连接
    await this.disconnect();
    
    // 销毁连接池中的连接
    if (this.pooledConnection) {
      connectionPool.destroy(this.pooledConnection.id);
      this.pooledConnection = null;
    }
    
    // 清理API重试管理器
    this.apiRetryManager.cleanup();
    
    // 销毁错误处理器
    this.errorHandler.destroy();
    
    // 移除所有监听器
    this.removeAllListeners();
  }

  private setupErrorHandling(): void {
    this.errorHandler.on('recovery-attempt', (roomId, attempt, maxAttempts) => {
      console.log(`[AcfunAdapter] Recovery attempt ${attempt}/${maxAttempts} for room ${roomId}`);
    });

    this.errorHandler.on('recovery-success', (roomId, attempts) => {
      console.log(`[AcfunAdapter] Recovery successful for room ${roomId} after ${attempts} attempts`);
      this.reconnectAttempts = 0; // 重置重连计数
    });

    this.errorHandler.on('recovery-failed', (roomId, finalError) => {
      console.error(`[AcfunAdapter] Recovery failed for room ${roomId}:`, finalError.message);
      this.setStatus('error');
    });

    this.errorHandler.on('max-retries-exceeded', (roomId, errorType) => {
      console.error(`[AcfunAdapter] Max retries exceeded for ${errorType} in room ${roomId}`);
      this.setStatus('error');
    });
  }

  private setStatus(status: RoomStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit('statusChange', status);
    }
  }

  private async handleConnectionError(error: Error): Promise<void> {
    console.error(`[AcfunAdapter] Connection error for room ${this.roomId}:`, error.message);
    
    this.setStatus('error');
    this.emit('error', error);
    
    // 使用错误处理器处理错误
    const shouldRetry = await this.errorHandler.handleConnectionError(
      this.roomId,
      error,
      {
        connectionType: 'danmu',
        sessionId: this.sessionId,
        reconnectAttempts: this.reconnectAttempts
      }
    );
    
    if (shouldRetry && !this.isShuttingDown) {
      // 错误处理器会处理延迟，这里直接尝试重连
      try {
        await this.connect();
        // 标记恢复成功
        const errorType = this.classifyError(error);
        this.errorHandler.markRecoverySuccess(this.roomId, errorType);
      } catch (retryError) {
        // 标记恢复失败
        this.errorHandler.markRecoveryFailed(this.roomId, {
          roomId: this.roomId,
          type: this.classifyError(retryError as Error),
          message: (retryError as Error).message,
          error: retryError as Error,
          timestamp: Date.now()
        });
      }
    }
  }

  private classifyError(error: Error): ConnectionErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('enotfound') || 
        message.includes('econnrefused')) {
      return ConnectionErrorType.NETWORK_ERROR;
    }
    
    if (message.includes('auth') || message.includes('unauthorized') || 
        message.includes('forbidden')) {
      return ConnectionErrorType.AUTH_ERROR;
    }
    
    if (message.includes('room not found') || message.includes('404')) {
      return ConnectionErrorType.ROOM_NOT_FOUND;
    }
    
    if (message.includes('rate limit') || message.includes('429')) {
      return ConnectionErrorType.RATE_LIMITED;
    }
    
    if (message.includes('timeout')) {
      return ConnectionErrorType.TIMEOUT_ERROR;
    }
    
    if (message.includes('websocket') || message.includes('ws')) {
      return ConnectionErrorType.WEBSOCKET_ERROR;
    }
    
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return ConnectionErrorType.SERVER_ERROR;
    }
    
    return ConnectionErrorType.UNKNOWN_ERROR;
  }

  private clearTimers(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async establishRealConnection(): Promise<void> {
    try {
      console.log(`[AcfunAdapter] Establishing real connection to room ${this.roomId}`);
      
      // 从连接池获取连接
      this.pooledConnection = await connectionPool.acquire('danmu', { roomId: this.roomId });
      console.log(`[AcfunAdapter] Acquired connection from pool: ${this.pooledConnection.id}`);
      
      // 检查并设置认证令牌
      await this.ensureAuthentication();
      
      // 使用ApiRetryManager包装API调用 - 获取直播间信息
      const roomInfo = await this.apiRetryManager.executeWithRetry(
        `getRoomInfo_${this.roomId}`,
        () => this.pooledConnection!.api.danmu.getLiveRoomInfo(this.roomId),
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000
        }
      );
      
      if (!roomInfo.success) {
        throw new Error(`Failed to get room info: ${roomInfo.error || 'Unknown error'}`);
      }
      
      console.log(`[AcfunAdapter] Room info retrieved for ${this.roomId}:`, roomInfo.data);
      
      // 使用ApiRetryManager包装API调用 - 启动弹幕连接
      const danmuResponse = await this.apiRetryManager.executeWithRetry(
        `startDanmu_${this.roomId}`,
        () => this.pooledConnection!.api.danmu.startDanmu(this.roomId, (message: DanmuMessage) => {
          this.handleDanmuEvent(message);
        }),
        {
          maxRetries: 2,
          baseDelay: 2000,
          maxDelay: 15000
        }
      );
      
      if (!danmuResponse.success) {
        throw new Error(`Failed to start danmu: ${danmuResponse.error || 'Unknown error'}`);
      }
      
      this.sessionId = danmuResponse.data?.sessionId || null;
      console.log(`[AcfunAdapter] Danmu session started: ${this.sessionId}`);

    } catch (error) {
      console.error(`[AcfunAdapter] Failed to establish connection:`, error);
      
      // 如果连接失败，释放连接池中的连接
      if (this.pooledConnection) {
        connectionPool.release(this.pooledConnection.id);
        this.pooledConnection = null;
      }
      
      throw error;
    }
  }

  /**
   * 确保认证状态有效
   */
  private async ensureAuthentication(): Promise<void> {
    if (!this.pooledConnection) {
      throw new Error('No pooled connection available');
    }

    try {
      // 检查当前认证状态
      const isAuthenticated = this.pooledConnection.api.isAuthenticated();
      
      if (!isAuthenticated) {
        console.log(`[AcfunAdapter] No authentication found, attempting to authenticate...`);
        
        // 尝试从 AuthManager 获取令牌信息
        const tokenInfo = await this.authManager.getTokenInfo();
        
        if (tokenInfo && tokenInfo.isValid) {
          // 设置令牌到 API 实例 - 传递完整的TokenInfo对象的JSON字符串
          this.pooledConnection.api.setAuthToken(JSON.stringify(tokenInfo));
          console.log('[AcfunAdapter] Authentication restored from saved token');
        } else if (tokenInfo && !tokenInfo.isValid) {
          // 令牌过期，由于无法自动刷新，清除过期令牌并继续匿名访问
          console.log('[AcfunAdapter] Token expired, clearing expired token...');
          await this.authManager.logout();
          console.warn(`[AcfunAdapter] Token expired and cannot be refreshed automatically, continuing with anonymous access`);
        } else {
          console.warn(`[AcfunAdapter] No valid authentication token available, continuing with anonymous access`);
        }
      } else {
        console.log(`[AcfunAdapter] Authentication already established`);
        
        // 检查令牌是否即将过期
        const isExpiringSoon = await this.authManager.isTokenExpiringSoon();
        if (isExpiringSoon) {
          console.warn('[AcfunAdapter] Token expiring soon, but automatic refresh is not supported. Manual re-login may be required.');
        }
      }
    } catch (error) {
      console.warn(`[AcfunAdapter] Authentication check failed:`, error);
      // 继续执行，但可能功能受限
    }
  }

  private handleDanmuEvent(event: DanmuMessage): void {
    if (this.isShuttingDown || this.status !== 'open') {
      return;
    }

    try {
      const normalizedEvent = this.normalizeDanmuEvent(event);
      
      // 应用事件过滤和验证
      const { passed, failedFilters } = this.applyEventFilters(normalizedEvent);
      if (!passed) {
        console.debug(`[AcfunAdapter] Event filtered out by: ${failedFilters.join(', ')}`, normalizedEvent);
        return;
      }
      
      this.emit('event', normalizedEvent);
    } catch (error) {
      console.error(`[AcfunAdapter] Failed to process danmu event:`, error);
    }
  }

  /**
   * 应用事件过滤器
   */
  private applyEventFilters(event: NormalizedEvent): { passed: boolean; failedFilters: string[] } {
    const result = this.filterManager.processEvent(event);
    
    if (!result.passed) {
      return {
        passed: false,
        failedFilters: result.reason ? [result.reason] : ['unknown']
      };
    }
    
    return {
      passed: true,
      failedFilters: []
    };
  }

  /**
   * 获取过滤器统计信息
   */
  public getFilterStats() {
    return this.filterManager.getStats();
  }

  /**
   * 获取过滤器管理器实例
   */
  public getFilterManager(): EventFilterManager {
    return this.filterManager;
  }

  private normalizeDanmuEvent(event: DanmuMessage, eventType?: string): NormalizedEvent {
    const now = Date.now();
    
    // 提取用户信息
    const userInfo = event.danmuInfo?.userInfo;
    const userMedal = userInfo?.medal ? {
      uperID: userInfo.medal.uperID,
      userID: userInfo.medal.userID,
      clubName: userInfo.medal.clubName,
      level: userInfo.medal.level
    } : null;
    
    const userManagerType = userInfo?.managerType || 0;
    const userLevel = userInfo?.medal?.level || 0;
    
    // 提取用户头像URL（处理不同的头像格式）
    let userAvatar = '';
    if (userInfo?.avatar) {
      if (typeof userInfo.avatar === 'string') {
        userAvatar = userInfo.avatar;
      } else if (Array.isArray(userInfo.avatar) && userInfo.avatar.length > 0) {
        userAvatar = userInfo.avatar[0].url || userInfo.avatar[0];
      }
    }
    
    // 确定事件优先级（用于高频事件处理）
    const getEventPriority = (eventType: string): 'high' | 'medium' | 'low' => {
      switch (eventType) {
        case 'gift':
        case 'follow':
          return 'high';
        case 'like':
        case 'enter':
          return 'medium';
        case 'danmaku':
        case 'system':
        default:
          return 'low';
      }
    };
    
    // 构建增强的上下文信息
    const enrichedContext = {
      // 会话和连接信息
      sessionId: this.sessionId,
      connectionDuration: this.getConnectionDuration(),
      reconnectAttempts: this.reconnectAttempts,
      adapterVersion: '2.0.0',
      
      // 用户信息
      userAvatar,
      userMedal,
      userManagerType,
      userLevel,
      
      // 事件元数据
      eventSource: 'acfun-live-api',
      processingTimestamp: now,
      roomConnectionStatus: this.status,
      
      // 用户权限和身份信息
      isManager: userManagerType > 0,
      isVip: userLevel >= 10, // 假设10级以上为VIP
      hasMedal: userMedal !== null,
      medalLevel: userMedal?.level || 0,
      
      // 技术信息
      apiVersion: '1.0.0',
      eventId: `${this.roomId}_${now}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const baseEvent: Partial<NormalizedEvent> = {
      ts: event.sendTime || now,
      received_at: now,
      room_id: this.roomId,
      source: 'acfun',
      user_id: userInfo?.userID?.toString() || '',
      user_name: userInfo?.nickname || '',
      raw: {
        ...event,
        _context: enrichedContext
      }
    };

    // 根据事件类型进行转换并设置优先级
    if ('content' in event) {
      // Comment 类型
      const normalizedEvent = {
        ...baseEvent,
        event_type: 'danmaku',
        content: (event as Comment).content
      } as NormalizedEvent;
      
      normalizedEvent.raw._context.priority = getEventPriority('danmaku');
      return normalizedEvent;
    } else if ('bananaCount' in event) {
      // ThrowBanana 类型
      const normalizedEvent = {
        ...baseEvent,
        event_type: 'gift',
        content: `投蕉 x${(event as ThrowBanana).bananaCount}`
      } as NormalizedEvent;
      
      normalizedEvent.raw._context.priority = getEventPriority('gift');
      normalizedEvent.raw._context.giftType = 'banana';
      normalizedEvent.raw._context.giftCount = (event as ThrowBanana).bananaCount;
      return normalizedEvent;
    } else if ('giftDetail' in event) {
      // Gift 类型
      const giftEvent = event as Gift;
      const normalizedEvent = {
        ...baseEvent,
        event_type: 'gift',
        content: `${giftEvent.giftDetail.giftName} x${giftEvent.count}`
      } as NormalizedEvent;
      
      normalizedEvent.raw._context.priority = getEventPriority('gift');
      normalizedEvent.raw._context.giftType = 'gift';
      normalizedEvent.raw._context.giftName = giftEvent.giftDetail.giftName;
      normalizedEvent.raw._context.giftCount = giftEvent.count;
      normalizedEvent.raw._context.giftValue = giftEvent.giftDetail.giftPrice || 0;
      return normalizedEvent;
    } else if ('followAuthor' in event) {
      // FollowAuthor 类型
      const normalizedEvent = {
        ...baseEvent,
        event_type: 'follow',
        content: '关注了主播'
      } as NormalizedEvent;
      
      normalizedEvent.raw._context.priority = getEventPriority('follow');
      return normalizedEvent;
    } else if ('joinTime' in event && 'fansInfo' in event && 'uperInfo' in event) {
      // JoinClub 类型
      const normalizedEvent = {
        ...baseEvent,
        event_type: 'system',
        content: '加入了粉丝团'
      } as NormalizedEvent;
      
      normalizedEvent.raw._context.priority = getEventPriority('system');
      normalizedEvent.raw._context.actionType = 'join_club';
      return normalizedEvent;
    } else if ('segments' in event) {
      // RichText 类型
      const richTextEvent = event as RichText;
      const content = richTextEvent.segments
        .map(segment => {
          if (segment.type === 'plain') {
            return segment.text;
          } else if (segment.type === 'image') {
            return `[图片:${segment.alternativeText || '表情'}]`;
          } else if (segment.type === 'userInfo') {
            return `@${segment.userInfo.nickname}`;
          }
          return '';
        })
        .join('');
      
      const normalizedEvent = {
        ...baseEvent,
        event_type: 'danmaku',
        content
      } as NormalizedEvent;
      
      normalizedEvent.raw._context.priority = getEventPriority('danmaku');
      normalizedEvent.raw._context.messageType = 'rich_text';
      normalizedEvent.raw._context.segmentCount = richTextEvent.segments.length;
      return normalizedEvent;
    } else if ('sharePlatform' in event) {
      // ShareLive 类型
      const shareEvent = event as ShareLive;
      const normalizedEvent = {
        ...baseEvent,
        event_type: 'system',
        content: '分享了直播间'
      } as NormalizedEvent;
      
      normalizedEvent.raw._context.priority = getEventPriority('system');
      normalizedEvent.raw._context.actionType = 'share_live';
      normalizedEvent.raw._context.sharePlatform = shareEvent.sharePlatform;
      return normalizedEvent;
    } else if ('likeCount' in event) {
      // Like 类型
      const likeEvent = event as Like;
      const normalizedEvent = {
        ...baseEvent,
        event_type: 'like',
        content: `点赞 x${likeEvent.likeCount}`
      } as NormalizedEvent;
      
      normalizedEvent.raw._context.priority = getEventPriority('like');
      normalizedEvent.raw._context.likeCount = likeEvent.likeCount;
      return normalizedEvent;
    } else if ('enterRoomAttach' in event) {
      // EnterRoom 类型
      const normalizedEvent = {
        ...baseEvent,
        event_type: 'enter',
        content: '进入了直播间'
      } as NormalizedEvent;
      
      normalizedEvent.raw._context.priority = getEventPriority('enter');
      normalizedEvent.raw._context.actionType = 'enter_room';
      return normalizedEvent;
    }

    // 默认处理未知类型
    const normalizedEvent = {
      ...baseEvent,
      event_type: 'system',
      content: JSON.stringify(event)
    } as NormalizedEvent;
    
    normalizedEvent.raw._context.priority = getEventPriority('system');
    normalizedEvent.raw._context.actionType = 'unknown';
    normalizedEvent.raw._context.isUnknownEvent = true;
    return normalizedEvent;
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.reconnectTimer) {
      return;
    }

    console.log(`[AcfunAdapter] Scheduling reconnection for room ${this.roomId}`);
    this.setStatus('connecting');
    
    // 使用 setTimeout 而不是立即重连
    this.reconnectTimer = setTimeout(() => {
      this.reconnect().catch(error => {
        console.error(`[AcfunAdapter] Reconnection failed:`, error);
      });
    }, 1000);
  }
}

