import { Module } from '@app/core/interfaces/Module';
import { DanmuDatabaseService } from '../services/DanmuDatabaseService';
import { AcfunDanmuModule } from '@app/acfundanmu';
import { logger } from '@app/utils/logger';
import { ModuleContext } from '@app/core/interfaces/ModuleContext';

// 弹幕连接管理器 - 处理多直播间弹幕流分发
export class DanmuConnectionManager {
  private static instance: DanmuConnectionManager;
  private roomConnections: Map<number, AcfunDanmuModule> = new Map();
  private dbService: DanmuDatabaseService;

  private constructor() {
    this.dbService = DanmuDatabaseService.getInstance();
  }

  public static getInstance(): DanmuConnectionManager {
    if (!DanmuConnectionManager.instance) {
      DanmuConnectionManager.instance = new DanmuConnectionManager();
    }
    return DanmuConnectionManager.instance;
  }

  // 连接到直播间弹幕流
  async connectToRoom(roomId: number): Promise<boolean> {
    if (this.roomConnections.has(roomId)) {
      logger.warn(`Already connected to room ${roomId}`);
      return true;
    }

    try {
      const danmuModule = new AcfunDanmuModule();
      await danmuModule.connect(roomId);

      // 监听弹幕事件并存储到数据库
      danmuModule.on('danmu', (danmu) => this.handleDanmu(roomId, danmu));
      danmuModule.on('error', (error) => this.handleConnectionError(roomId, error));
      danmuModule.on('close', () => this.handleConnectionClose(roomId));

      this.roomConnections.set(roomId, danmuModule);
      logger.info(`Successfully connected to room ${roomId} danmu stream`);
      return true;
    } catch (error) {
      logger.error(`Failed to connect to room ${roomId}:`, error);
      return false;
    }
  }

  // 断开直播间弹幕流连接
  disconnectFromRoom(roomId: number): void {
    const connection = this.roomConnections.get(roomId);
    if (connection) {
      connection.removeAllListeners();
      connection.disconnect();
      this.roomConnections.delete(roomId);
      logger.info(`Disconnected from room ${roomId} danmu stream`);
    }
  }

  // 断开所有直播间连接
  disconnectAll(): void {
    this.roomConnections.forEach((_, roomId) => this.disconnectFromRoom(roomId));
  }

  // 处理接收到的弹幕
  private handleDanmu(roomId: number, danmu: any): void {
    try {
      // 存储弹幕到数据库
      this.dbService.insertDanmu({
        roomId,
        userId: danmu.userId,
        username: danmu.username,
        content: danmu.content,
        type: danmu.type,
        color: danmu.color,
        fontSize: danmu.fontSize,
        isGift: danmu.isGift || false,
        giftValue: danmu.giftValue || 0
      });

      // TODO: 实现弹幕分发逻辑，发送到前端
    } catch (error) {
      logger.error(`Failed to process danmu for room ${roomId}:`, error);
    }
  }

  // 处理连接错误
  private handleConnectionError(roomId: number, error: Error): void {
    logger.error(`Danmu connection error for room ${roomId}:`, error);
    // 自动重连逻辑
    setTimeout(() => this.connectToRoom(roomId), 5000);
  }

  // 处理连接关闭
  private handleConnectionClose(roomId: number): void {
    logger.warn(`Danmu connection closed for room ${roomId}`);
    this.roomConnections.delete(roomId);
    // 自动重连
    setTimeout(() => this.connectToRoom(roomId), 3000);
  }

  // 获取活跃的直播间连接
  getActiveRooms(): number[] {
    return Array.from(this.roomConnections.keys());
  }
}

// 弹幕模块 - 实现多直播间弹幕流分发机制
export default class DanmuModule implements Module {
  private connectionManager: DanmuConnectionManager;

  enable(context: ModuleContext): void {
    this.connectionManager = DanmuConnectionManager.getInstance();
    logger.info('DanmuModule enabled with multi-room support');

    // 注册应用退出时的清理函数
    context.app.on('will-quit', () => {
      this.connectionManager.disconnectAll();
    });
  }

  disable(): void {
    this.connectionManager.disconnectAll();
    logger.info('DanmuModule disabled');
  }

  // 提供API方法供前端调用
  getApi() {
    return {
      connectToRoom: (roomId: number) => this.connectionManager.connectToRoom(roomId),
      disconnectFromRoom: (roomId: number) => this.connectionManager.disconnectFromRoom(roomId),
      getActiveRooms: () => this.connectionManager.getActiveRooms()
    };
  }
}