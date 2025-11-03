import { EventEmitter } from 'events';
import { AcfunAdapter } from '../adapter/AcfunAdapter';
import { EventWriter } from '../persistence/EventWriter';
import { RoomStatus, NormalizedEvent } from '../types';
import { ensureNormalized } from '../events/normalize';

/** 最大房间数量限制 */
const MAX_ROOMS = 3;

/**
 * 房间信息接口
 * 包含房间的基本信息和运行状态
 */
export interface RoomInfo {
  /** 房间ID */
  roomId: string;
  /** 适配器实例 */
  adapter: AcfunAdapter;
  /** 房间状态 */
  status: RoomStatus;
  /** 连接时间戳 */
  connectedAt?: number;
  /** 最后事件时间戳 */
  lastEventAt?: number;
  /** 事件计数 */
  eventCount: number;
  /** 重连尝试次数 */
  reconnectAttempts: number;
  /** 房间优先级 */
  priority?: number;
  /** 房间标签 */
  label?: string;
}

/**
 * 房间管理器类
 * 负责管理多个直播房间的连接和事件处理
 * 
 * 主要功能：
 * - 房间连接管理：添加、移除、重连房间
 * - 事件处理：监听和转发房间事件
 * - 状态监控：跟踪房间连接状态和统计信息
 * - 自动重连：处理连接失败和自动重连逻辑
 * - 优先级管理：支持房间优先级设置
 * 
 * @extends EventEmitter
 * @emits roomStatusChange - 房间状态变化时触发
 * @emits event - 收到房间事件时触发
 * @emits roomError - 房间发生错误时触发
 */
export class RoomManager extends EventEmitter {
  private rooms: Map<string, RoomInfo> = new Map();
  private eventWriter: EventWriter;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 构造函数
   * @param eventWriter 事件写入器实例
   */
  constructor(eventWriter: EventWriter) {
    super();
    this.eventWriter = eventWriter;
  }

  /**
   * 添加房间到管理器
   * @param roomId 房间ID
   * @returns 是否成功添加
   */
  public async addRoom(roomId: string): Promise<boolean> {
    if (this.rooms.size >= MAX_ROOMS) {
      console.warn(`[RoomManager] Maximum number of rooms (${MAX_ROOMS}) reached.`);
      this.emit('error', new Error(`Maximum number of rooms (${MAX_ROOMS}) reached`));
      return false;
    }

    if (this.rooms.has(roomId)) {
      console.warn(`[RoomManager] Room ${roomId} is already being managed.`);
      return false;
    }

    try {
      const adapter = new AcfunAdapter({ roomId });
      const roomInfo: RoomInfo = {
        roomId,
        adapter,
        status: 'closed',
        eventCount: 0,
        reconnectAttempts: 0,
        priority: 0,
        label: ''
      };

      this.rooms.set(roomId, roomInfo);
      this.setupAdapterListeners(roomInfo);

      await adapter.connect();
      
      console.log(`[RoomManager] Successfully added room ${roomId}`);
      this.emit('roomAdded', roomId);
      return true;
    } catch (error) {
      console.error(`[RoomManager] Failed to add room ${roomId}:`, error);
      this.rooms.delete(roomId);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * 从管理器中移除房间
   * @param roomId 房间ID
   * @returns 是否成功移除
   */
  public async removeRoom(roomId: string): Promise<boolean> {
    const roomInfo = this.rooms.get(roomId);
    if (!roomInfo) {
      console.warn(`[RoomManager] Room ${roomId} not found.`);
      return false;
    }

    try {
      // 清除重连定时器
      const timer = this.reconnectTimers.get(roomId);
      if (timer) {
        clearTimeout(timer);
        this.reconnectTimers.delete(roomId);
      }

      // 断开连接并销毁适配器
      await roomInfo.adapter.disconnect();
      await roomInfo.adapter.destroy();
      
      // 移除监听器
      roomInfo.adapter.removeAllListeners();
      
      // 从管理器中移除
      this.rooms.delete(roomId);
      
      console.log(`[RoomManager] Successfully removed room ${roomId}`);
      this.emit('roomRemoved', roomId);
      return true;
    } catch (error) {
      console.error(`[RoomManager] Failed to remove room ${roomId}:`, error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * 获取房间信息
   * @param roomId 房间ID
   * @returns 房间信息对象，如果不存在则返回 undefined
   */
  public getRoomInfo(roomId: string): RoomInfo | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * 获取所有房间信息
   * @returns 所有房间信息数组
   */
  public getAllRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  /**
   * 获取房间总数
   * @returns 房间总数
   */
  public getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * 获取已连接房间数量
   * @returns 已连接房间数量
   */
  public getConnectedRoomCount(): number {
    return Array.from(this.rooms.values()).filter(room => room.status === 'open').length;
  }

  /**
   * 手动重连指定房间
   * @param roomId 房间ID
   * @returns 是否成功重连
   */
  public async reconnectRoom(roomId: string): Promise<boolean> {
    const roomInfo = this.rooms.get(roomId);
    if (!roomInfo) {
      console.warn(`[RoomManager] Room ${roomId} not found for reconnection.`);
      return false;
    }

    try {
      console.log(`[RoomManager] Manually reconnecting room ${roomId}`);
      await roomInfo.adapter.reconnect();
      return true;
    } catch (error) {
      console.error(`[RoomManager] Failed to manually reconnect room ${roomId}:`, error);
      return false;
    }
  }

  /**
   * 设置房间优先级
   * @param roomId 房间ID
   * @param priority 优先级数值
   * @returns 是否成功设置
   */
  public setRoomPriority(roomId: string, priority: number): boolean {
    const roomInfo = this.rooms.get(roomId);
    if (!roomInfo) return false;
    roomInfo.priority = priority;
    this.emit('roomPriorityChange', roomId, priority);
    return true;
  }

  /**
   * 设置房间标签
   * @param roomId 房间ID
   * @param label 房间标签
   * @returns 是否成功设置
   */
  public setRoomLabel(roomId: string, label: string): boolean {
    const roomInfo = this.rooms.get(roomId);
    if (!roomInfo) return false;
    roomInfo.label = label;
    this.emit('roomLabelChange', roomId, label);
    return true;
  }

  /**
   * 断开所有房间连接
   */
  public async disconnectAllRooms(): Promise<void> {
    const disconnectPromises = Array.from(this.rooms.keys()).map(roomId => 
      this.removeRoom(roomId)
    );
    
    await Promise.allSettled(disconnectPromises);
    console.log('[RoomManager] All rooms disconnected');
  }

  private setupAdapterListeners(roomInfo: RoomInfo): void {
    const { adapter, roomId } = roomInfo;

    adapter.on('statusChange', (status: RoomStatus) => {
      roomInfo.status = status;
      
      if (status === 'open') {
        roomInfo.connectedAt = Date.now();
        roomInfo.reconnectAttempts = 0;
        console.log(`[RoomManager] Room ${roomId} connected successfully`);
      } else if (status === 'error' || status === 'closed') {
        this.handleRoomDisconnection(roomInfo);
      }

      this.emit('roomStatusChange', roomId, status);
    });

    adapter.on('event', (event: NormalizedEvent) => {
      roomInfo.eventCount++;
      roomInfo.lastEventAt = Date.now();

      // 统一标准化并补全房间ID与时间戳
      const enriched: NormalizedEvent = ensureNormalized({
        ...event,
        room_id: roomId,
        ts: event.ts || Date.now(),
        received_at: event.received_at || Date.now()
      });

      this.eventWriter.enqueue(enriched);
      this.emit('event', enriched);
    });

    adapter.on('error', (error: Error) => {
      console.error(`[RoomManager] Error in room ${roomId}:`, error);
      this.emit('roomError', roomId, error);
    });
  }

  private handleRoomDisconnection(roomInfo: RoomInfo): void {
    const { roomId } = roomInfo;
    
    // 清除之前的重连定时器
    const existingTimer = this.reconnectTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 实现指数退避重连策略
    const baseDelay = 1000; // 1秒
    const maxDelay = 300000; // 5分钟
    const maxAttempts = 10;

    if (roomInfo.reconnectAttempts >= maxAttempts) {
      console.error(`[RoomManager] Room ${roomId} exceeded maximum reconnection attempts (${maxAttempts})`);
      this.emit('roomReconnectFailed', roomId);
      return;
    }

    const delay = Math.min(
      baseDelay * Math.pow(2, roomInfo.reconnectAttempts),
      maxDelay
    );

    console.log(`[RoomManager] Scheduling reconnection for room ${roomId} in ${delay}ms (attempt ${roomInfo.reconnectAttempts + 1})`);

    const timer = setTimeout(async () => {
      roomInfo.reconnectAttempts++;
      
      try {
        console.log(`[RoomManager] Attempting to reconnect room ${roomId} (attempt ${roomInfo.reconnectAttempts})`);
        await roomInfo.adapter.reconnect();
      } catch (error) {
        console.error(`[RoomManager] Reconnection attempt ${roomInfo.reconnectAttempts} failed for room ${roomId}:`, error);
        // 如果重连失败，会触发状态变化，进而再次调用此方法
      }
      
      this.reconnectTimers.delete(roomId);
    }, delay);

    this.reconnectTimers.set(roomId, timer);
  }

  public async shutdown(): Promise<void> {
    console.log('[RoomManager] Shutting down...');
    
    // 清除所有重连定时器
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // 断开所有房间连接
    await this.disconnectAllRooms();
    
    // 移除所有监听器
    this.removeAllListeners();
    
    console.log('[RoomManager] Shutdown complete');
  }
}
