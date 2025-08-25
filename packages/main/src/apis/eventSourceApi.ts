import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { ServerResponse } from 'http';
import { Readable } from 'stream';

/**
 * EventSource连接管理器
 * 负责管理与客户端的EventSource连接
 */
class EventSourceManager {
  private connections: Map<string, ServerResponse>;
  private eventEmitter: EventEmitter;

  constructor() {
    this.connections = new Map();
    this.eventEmitter = new EventEmitter();
  }

  /**
   * 创建一个新的EventSource连接
   * @param req - HTTP请求对象
   * @param res - HTTP响应对象
   * @param clientId - 客户端ID
   */
  createConnection(req: IncomingMessage, res: ServerResponse, clientId: string): void {
    // 设置响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // 存储连接
    this.connections.set(clientId, res);

    // 发送一个初始事件
    this.sendEvent(clientId, 'open', { message: '连接已建立' });

    // 监听连接关闭事件
    req.on('close', () => {
      this.connections.delete(clientId);
      this.eventEmitter.emit('disconnect', clientId);
      console.log(`Client ${clientId} disconnected`);
    });

    console.log(`New EventSource connection from client ${clientId}`);
  }

  /**
   * 向指定客户端发送事件
   * @param clientId - 客户端ID
   * @param eventName - 事件名称
   * @param data - 事件数据
   */
  sendEvent(clientId: string, eventName: string, data: any): void {
    const res = this.connections.get(clientId);
    if (res) {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`event: ${eventName}
`);
      res.write(`data: ${dataString}

`);
    }
  }

  /**
   * 向所有客户端广播事件
   * @param eventName - 事件名称
   * @param data - 事件数据
   */
  broadcastEvent(eventName: string, data: any): void {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    this.connections.forEach((res) => {
      res.write(`event: ${eventName}
`);
      res.write(`data: ${dataString}

`);
    });
  }

  /**
   * 关闭指定客户端的连接
   * @param clientId - 客户端ID
   */
  closeConnection(clientId: string): void {
    const res = this.connections.get(clientId);
    if (res) {
      res.end();
      this.connections.delete(clientId);
    }
  }

  /**
   * 关闭所有连接
   */
  closeAllConnections(): void {
    this.connections.forEach((res) => {
      res.end();
    });
    this.connections.clear();
  }

  /**
   * 获取当前连接数
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 监听事件
   * @param eventName - 事件名称
   * @param listener - 事件监听器
   */
  on(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(eventName, listener);
  }
}

// 创建单例实例
const eventSourceManager = new EventSourceManager();

export default eventSourceManager;

export function setupEventSourceRoutes(app: any) {
  /**
   * 弹幕流EventSource连接
   */
  app.get('/api/events/danmaku', (req: IncomingMessage, res: ServerResponse) => {
    const clientId = req.headers['client-id'] || `client_${Date.now()}`;
    eventSourceManager.createConnection(req, res, clientId as string);
  });

  /**
   * 推流状态EventSource连接
   */
  app.get('/api/events/stream-status', (req: IncomingMessage, res: ServerResponse) => {
    const clientId = req.headers['client-id'] || `client_${Date.now()}`;
    eventSourceManager.createConnection(req, res, clientId as string);
  });

  /**
   * 房间信息EventSource连接
   */
  app.get('/api/events/room-info', (req: IncomingMessage, res: ServerResponse) => {
    const clientId = req.headers['client-id'] || `client_${Date.now()}`;
    eventSourceManager.createConnection(req, res, clientId as string);
  });
}