import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { NormalizedEvent } from '../types/contracts';

/**
 * WebSocket 消息类型
 */
export interface WsMessage {
  op: 'event' | 'room_status' | 'ping' | 'pong';
  d?: any;
}

/**
 * 事件推送消息
 */
export interface EventMessage extends WsMessage {
  op: 'event';
  d: NormalizedEvent;
}

/**
 * 房间状态消息
 */
export interface RoomStatusMessage extends WsMessage {
  op: 'room_status';
  d: {
    room_id: string;
    status: string;
    timestamp: number;
  };
}

/**
 * WebSocket Hub - 负责管理 WebSocket 连接和广播消息
 */
export class WsHub {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * 初始化 WebSocket 服务器
   */
  public initialize(server: Server): void {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[WsHub] 新的 WebSocket 连接');
      this.clients.add(ws);

      // 发送欢迎消息
      this.sendToClient(ws, { op: 'ping' });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WsMessage;
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('[WsHub] 解析消息失败:', error);
        }
      });

      ws.on('close', () => {
        console.log('[WsHub] WebSocket 连接关闭');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[WsHub] WebSocket 错误:', error);
        this.clients.delete(ws);
      });
    });

    // 启动心跳检测
    this.startPingInterval();

    console.log('[WsHub] WebSocket 服务器已初始化');
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(ws: WebSocket, message: WsMessage): void {
    switch (message.op) {
      case 'ping':
        this.sendToClient(ws, { op: 'pong' });
        break;
      case 'pong':
        // 客户端响应心跳，无需处理
        break;
      default:
        console.warn('[WsHub] 未知消息类型:', message.op);
    }
  }

  /**
   * 广播事件到所有连接的客户端
   */
  public broadcastEvent(event: NormalizedEvent): void {
    const message: EventMessage = {
      op: 'event',
      d: event
    };
    this.broadcast(message);
  }

  /**
   * 广播房间状态更新
   */
  public broadcastRoomStatus(roomId: string, status: string): void {
    const message: RoomStatusMessage = {
      op: 'room_status',
      d: {
        room_id: roomId,
        status,
        timestamp: Date.now()
      }
    };
    this.broadcast(message);
  }

  /**
   * 广播消息到所有客户端
   */
  private broadcast(message: WsMessage): void {
    const data = JSON.stringify(message);
    const deadClients: WebSocket[] = [];

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (error) {
          console.error('[WsHub] 发送消息失败:', error);
          deadClients.push(client);
        }
      } else {
        deadClients.push(client);
      }
    });

    // 清理死连接
    deadClients.forEach((client) => {
      this.clients.delete(client);
    });
  }

  /**
   * 发送消息到指定客户端
   */
  private sendToClient(client: WebSocket, message: WsMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WsHub] 发送消息到客户端失败:', error);
        this.clients.delete(client);
      }
    }
  }

  /**
   * 启动心跳检测
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const pingMessage: WsMessage = { op: 'ping' };
      this.broadcast(pingMessage);
    }, 30000); // 每30秒发送一次心跳
  }

  /**
   * 获取连接数
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * 关闭 WebSocket 服务器
   */
  public close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('[WsHub] WebSocket 服务器已关闭');
  }
}