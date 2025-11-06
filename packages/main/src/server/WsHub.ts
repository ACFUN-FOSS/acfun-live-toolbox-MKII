import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import * as http from 'http';
import { NormalizedEvent } from '../types/contracts';

/**
 * WebSocket 消息类型
 */
export interface WsMessage {
  op: 'event' | 'room_status' | 'activity' | 'ping' | 'pong';
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
 * 活动/业务状态消息（认证、房间、直播等高层事件）
 */
export interface ActivityMessage extends WsMessage {
  op: 'activity';
  d: {
    type: string; // e.g. 'auth.login', 'auth.logout', 'auth.tokenExpiring', 'room.added', 'room.removed', 'live.start', 'live.stop'
    payload: any;
    ts?: number;
  };
}

/**
 * WebSocket Hub - 负责管理 WebSocket 连接和广播消息
 */
export class WsHub {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map(); // 修改为Map以支持clientId
  private pingInterval: NodeJS.Timeout | null = null;

  // 添加生成客户端ID的方法
  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * 初始化 WebSocket 服务器
   */
  public initialize(server: Server): void {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const clientId = this.generateClientId();
      console.log(`[WsHub] Client connected: ${clientId} from ${req.socket.remoteAddress}`);

      // 存储客户端连接
      this.clients.set(clientId, ws);

      // 发送连接确认消息
      this.sendToClientMsg(clientId, {
        type: 'connected',
        clientId,
        timestamp: Date.now()
      });

      // 监听客户端消息
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error: any) {
          console.error(`[WsHub] Failed to parse message from client ${clientId}:`, error);
        }
      });

      // 监听连接关闭
      ws.on('close', () => {
        console.log(`[WsHub] Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      // 监听错误
      ws.on('error', (error: Error) => {
        console.error(`[WsHub] WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    // 启动心跳检测
    this.startPingInterval();

    console.log('[WsHub] WebSocket server initialized');
  }

  /**
   * 处理客户端消息
   */
  private handleClientMessage(clientId: string, message: any): void {
    // 根据需要处理客户端消息
    console.log(`[WsHub] Received message from client ${clientId}:`, message);
  }

  /**
   * 处理内部消息
   */
  private handleMessage(ws: WebSocket, message: WsMessage): void {
    switch (message.op) {
      case 'ping':
        this.sendToClientMsgByWs(ws, { op: 'pong' });
        break;
      case 'pong':
        // 客户端响应心跳，无需处理
        break;
      default:
        console.warn('[WsHub] Unknown message type:', message.op);
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
   * 广播高层活动事件（不含敏感信息）
   */
  public broadcastActivity(type: string, payload: any, ts?: number): void {
    const message: ActivityMessage = {
      op: 'activity',
      d: {
        type,
        payload,
        ts: ts ?? Date.now()
      }
    };
    this.broadcast(message);
  }

  /**
   * 广播消息到所有客户端
   */
  private broadcast(message: WsMessage): void {
    const data = JSON.stringify(message);
    const deadClients: string[] = []; // 存储失效的客户端ID

    this.clients.forEach((ws, clientId) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch (error: any) {
          console.error(`[WsHub] Failed to send message to client ${clientId}:`, error);
          deadClients.push(clientId);
        }
      } else {
        deadClients.push(clientId);
      }
    });

    // 清理死连接
    deadClients.forEach((clientId) => {
      this.clients.delete(clientId);
    });
  }

  /**
   * 发送消息到指定客户端 (通过WebSocket对象)
   */
  private sendToClientMsgByWs(client: WebSocket, message: WsMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error: any) {
        console.error('[WsHub] Failed to send message to client:', error);
      }
    }
  }

  /**
   * 发送消息到指定客户端 (通过clientId)
   */
  private sendToClientMsg(clientId: string, message: any): boolean {
    const ws = this.clients.get(clientId);
    if (!ws) {
      console.warn(`[WsHub] Attempted to send message to non-existent client: ${clientId}`);
      return false;
    }

    if (ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WsHub] Attempted to send message to closed connection: ${clientId}`);
      this.clients.delete(clientId);
      return false;
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error: any) {
      console.error(`[WsHub] Failed to send message to client ${clientId}:`, error);
      this.clients.delete(clientId);
      return false;
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

    console.log('[WsHub] WebSocket server closed');
  }
}
