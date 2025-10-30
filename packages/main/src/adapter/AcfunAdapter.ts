import { EventEmitter } from 'events';
import { AcFunLiveApi, createApi } from '@app/acfundanmu';
import { DanmuEvent, CommentEvent, GiftEvent, LikeEvent } from '@app/acfundanmu';
import { RoomStatus, NormalizedEvent } from '../types';

export class AcfunAdapter extends EventEmitter {
  private roomId: string;
  private status: RoomStatus = 'closed';
  private connectionTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  private connectionStartTime: number = 0;
  private isShuttingDown: boolean = false;
  private acfunApi: AcFunLiveApi;

  // 连接配置
  private readonly CONNECTION_TIMEOUT = 30000; // 30秒
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒
  private readonly HEARTBEAT_TIMEOUT = 10000; // 10秒

  constructor(roomId: string) {
    super();
    this.roomId = roomId;
    this.acfunApi = createApi();
  }

  public async connect(): Promise<void> {
    if (this.status === 'open' || this.status === 'connecting') {
      console.log(`[AcfunAdapter] Room ${this.roomId} is already connected or connecting`);
      return;
    }

    this.isShuttingDown = false;
    this.setStatus('connecting');
    this.connectionStartTime = Date.now();

    return new Promise((resolve, reject) => {
      // 设置连接超时
      this.connectionTimeout = setTimeout(() => {
        this.handleConnectionError(new Error('Connection timeout'));
        reject(new Error('Connection timeout'));
      }, this.CONNECTION_TIMEOUT);

      try {
        console.log(`[AcfunAdapter] Connecting to room ${this.roomId}...`);
        
        // TODO: 这里应该集成真实的 acfundanmu.js 连接逻辑
        // 目前使用模拟连接
        this.simulateConnection()
          .then(() => {
            if (this.connectionTimeout) {
              clearTimeout(this.connectionTimeout);
              this.connectionTimeout = null;
            }
            
            this.setStatus('open');
            this.startHeartbeat();
            this.startEventSimulation(); // 模拟事件，实际应该是真实的事件监听
            
            console.log(`[AcfunAdapter] Successfully connected to room ${this.roomId}`);
            resolve();
          })
          .catch((error) => {
            this.handleConnectionError(error);
            reject(error);
          });
      } catch (error) {
        this.handleConnectionError(error as Error);
        reject(error);
      }
    });
  }

  public async disconnect(): Promise<void> {
    console.log(`[AcfunAdapter] Disconnecting from room ${this.roomId}...`);
    
    this.isShuttingDown = true;
    
    // 清除所有定时器
    this.clearTimers();
    
    // TODO: 这里应该添加真实的断开连接逻辑
    
    this.setStatus('closed');
    console.log(`[AcfunAdapter] Disconnected from room ${this.roomId}`);
  }

  public async reconnect(): Promise<void> {
    console.log(`[AcfunAdapter] Reconnecting room ${this.roomId}...`);
    
    await this.disconnect();
    
    // 等待一小段时间再重连
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.connect();
  }

  public getStatus(): RoomStatus {
    return this.status;
  }

  public getRoomId(): string {
    return this.roomId;
  }

  public getConnectionDuration(): number {
    if (this.status !== 'open' || this.connectionStartTime === 0) {
      return 0;
    }
    return Date.now() - this.connectionStartTime;
  }

  private setStatus(status: RoomStatus): void {
    if (this.status !== status) {
      const oldStatus = this.status;
      this.status = status;
      
      console.log(`[AcfunAdapter] Room ${this.roomId} status changed: ${oldStatus} -> ${status}`);
      this.emit('statusChange', status, oldStatus);
    }
  }

  private handleConnectionError(error: Error): void {
    console.error(`[AcfunAdapter] Connection error for room ${this.roomId}:`, error);
    
    this.clearTimers();
    this.setStatus('error');
    this.emit('error', error);
  }

  private clearTimers(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startHeartbeat(): void {
    this.lastHeartbeat = Date.now();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isShuttingDown) {
        return;
      }

      const now = Date.now();
      
      // 检查是否超过心跳超时时间
      if (now - this.lastHeartbeat > this.HEARTBEAT_TIMEOUT + this.HEARTBEAT_INTERVAL) {
        console.warn(`[AcfunAdapter] Heartbeat timeout for room ${this.roomId}`);
        this.handleConnectionError(new Error('Heartbeat timeout'));
        return;
      }

      // 发送心跳 (模拟)
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  private sendHeartbeat(): void {
    // TODO: 实现真实的心跳发送逻辑
    this.lastHeartbeat = Date.now();
    console.debug(`[AcfunAdapter] Heartbeat sent for room ${this.roomId}`);
  }

  // 模拟连接过程
  private async simulateConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 模拟连接延迟
      const delay = Math.random() * 2000 + 1000; // 1-3秒
      
      setTimeout(() => {
        // 模拟连接成功率 (95%)
        if (Math.random() < 0.95) {
          resolve();
        } else {
          reject(new Error('Simulated connection failure'));
        }
      }, delay);
    });
  }

  // 模拟事件生成 (实际应该是从 acfundanmu.js 接收真实事件)
  private startEventSimulation(): void {
    if (this.isShuttingDown) {
      return;
    }

    // 模拟不同类型的事件
    const eventTypes = ['comment', 'gift', 'like', 'follow', 'enter'];
    
    const generateEvent = () => {
      if (this.status !== 'open' || this.isShuttingDown) {
        return;
      }

      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const event = this.createMockEvent(eventType);
      
      this.emit('event', event);
      
      // 随机间隔生成下一个事件 (1-10秒)
      const nextDelay = Math.random() * 9000 + 1000;
      setTimeout(generateEvent, nextDelay);
    };

    // 开始生成事件
    setTimeout(generateEvent, 2000);
  }

  private createMockEvent(type: string): NormalizedEvent {
    const baseEvent: NormalizedEvent = {
      ts: Date.now(),
      room_id: this.roomId,
      event_type: type as any, // 临时类型断言，下面会设置正确的值
      user_id: `user_${Math.floor(Math.random() * 10000)}`,
      user_name: `用户${Math.floor(Math.random() * 10000)}`,
      content: null,
      raw: {}
    };

    switch (type) {
      case 'comment':
        return {
          ...baseEvent,
          event_type: 'danmaku',
          content: `这是一条模拟弹幕消息 ${Math.floor(Math.random() * 1000)}`
        };
      
      case 'gift':
        return {
          ...baseEvent,
          event_type: 'gift',
          content: '小心心'
        };
      
      case 'like':
        return {
          ...baseEvent,
          event_type: 'like',
          content: null
        };
      
      case 'follow':
        return {
          ...baseEvent,
          event_type: 'follow',
          content: null
        };
      
      case 'enter':
        return {
          ...baseEvent,
          event_type: 'enter',
          content: null
        };
      
      default:
        return {
          ...baseEvent,
          event_type: 'system',
          content: null
        };
    }
  }

  // 真实的事件标准化方法 (当集成 acfundanmu.js 时使用)
  private normalizeAcfunEvent(rawEvent: DanmuEvent): NormalizedEvent {
    const baseEvent: NormalizedEvent = {
      ts: rawEvent.timestamp || Date.now(),
      room_id: this.roomId,
      user_id: rawEvent.userId || null,
      user_name: rawEvent.userName || null,
      content: null,
      event_type: 'system', // 默认值，下面会根据类型修改
      raw: rawEvent
    };

    switch (rawEvent.type) {
      case 'comment':
        const commentEvent = rawEvent as CommentEvent;
        return {
          ...baseEvent,
          event_type: 'danmaku',
          content: commentEvent.data?.content || null
        };

      case 'gift':
        const giftEvent = rawEvent as GiftEvent;
        return {
          ...baseEvent,
          event_type: 'gift',
          content: giftEvent.data?.giftName || null
        };

      case 'like':
        return {
          ...baseEvent,
          event_type: 'like',
          content: null
        };

      default:
        return {
          ...baseEvent,
          event_type: 'system',
          content: null
        };
    }
  }
}
