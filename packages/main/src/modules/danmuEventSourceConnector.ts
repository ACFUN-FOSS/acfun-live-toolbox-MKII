import { acfunDanmuModule } from './AcfunDanmuModule.js';
import eventSourceManager from '../apis/eventSourceApi.js';
import { EventEmitter } from 'events';

/**
 * 弹幕EventSource连接器
 * 负责连接弹幕模块和EventSource管理器
 */
class DanmuEventSourceConnector {
  private eventEmitter: EventEmitter;
  private isConnected: boolean;
  private roomId: string | null;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.isConnected = false;
    this.roomId = null;
    this.initListeners();
  }

  /**
   * 初始化监听器
   */
  private initListeners(): void {
    // 监听EventSource连接事件
    eventSourceManager.on('connect', (clientId: string) => {
      console.log(`Client ${clientId} connected to EventSource`);
      this.eventEmitter.emit('clientConnected', clientId);
    });

    // 监听EventSource断开连接事件
    eventSourceManager.on('disconnect', (clientId: string) => {
      console.log(`Client ${clientId} disconnected from EventSource`);
      this.eventEmitter.emit('clientDisconnected', clientId);
    });

    // 监听弹幕模块的日志输出
    acfunDanmuModule.setLogCallback((message: string, type: 'info' | 'error') => {
      if (type === 'info') {
        try {
          // 尝试解析日志消息，提取有用信息
          const data = this.parseDanmuMessage(message);
          if (data) {
            this.handleDanmuData(data);
          }
        } catch (error) {
          console.error('Failed to parse danmu message:', error);
        }
      }
    });
  }

  /**
   * 解析弹幕消息
   * @param message - 原始消息
   * @returns 解析后的数据或null
   */
  private parseDanmuMessage(message: string): any | null {
    // 根据实际的弹幕消息格式进行解析
    // 这里只是一个示例实现
    try {
      // 检查是否是JSON格式
      if (message.startsWith('{') && message.endsWith('}')) {
        return JSON.parse(message);
      }

      // 检查是否是特定格式的弹幕消息
      if (message.includes('danmu')) {
        // 提取关键信息
        const parts = message.split('|');
        if (parts.length >= 3) {
          return {
            type: 'danmu',
            user: parts[0],
            content: parts[1],
            time: parts[2]
          };
        }
      }

      // 检查是否是礼物消息
      if (message.includes('gift')) {
        // 提取关键信息
        const parts = message.split('|');
        if (parts.length >= 4) {
          return {
            type: 'gift',
            user: parts[0],
            giftName: parts[1],
            amount: parts[2],
            time: parts[3]
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error parsing message:', error);
      return null;
    }
  }

  /**
   * 处理弹幕数据
   * @param data - 解析后的弹幕数据
   */
  private handleDanmuData(data: any): void {
    if (!this.isConnected) {
      return;
    }

    // 根据数据类型发送不同的事件
    switch (data.type) {
      case 'danmu':
        eventSourceManager.broadcastEvent('danmu', data);
        break;
      case 'gift':
        eventSourceManager.broadcastEvent('gift', data);
        break;
      case 'live_status':
        eventSourceManager.broadcastEvent('live_status', data);
        break;
      case 'room_info':
        eventSourceManager.broadcastEvent('room_info', data);
        break;
      default:
        // 发送通用事件
        eventSourceManager.broadcastEvent('data', data);
    }
  }

  /**
   * 连接到指定房间
   * @param roomId - 房间ID
   */
  async connectToRoom(roomId: string): Promise<void> {
    try {
      this.roomId = roomId;
      this.isConnected = true;

      // 获取房间信息并发送给所有连接的客户端
      const roomInfo = await acfunDanmuModule.getLiveStatus(parseInt(roomId));
      eventSourceManager.broadcastEvent('room_info', roomInfo);

      console.log(`Connected to room ${roomId} for EventSource broadcasting`);
    } catch (error) {
      console.error(`Failed to connect to room ${roomId}:`, error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * 断开与房间的连接
   */
  disconnectFromRoom(): void {
    this.isConnected = false;
    this.roomId = null;
    console.log('Disconnected from room for EventSource broadcasting');
  }

  /**
   * 获取当前连接状态
   */
  getStatus(): { isConnected: boolean, roomId: string | null } {
    return { isConnected: this.isConnected, roomId: this.roomId };
  }
}

// 创建单例实例
const danmuEventSourceConnector = new DanmuEventSourceConnector();

export default danmuEventSourceConnector;