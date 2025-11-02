/**
 * 连接池管理器 - 为插件提供高效的连接管理
 */

import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { pluginLogger } from './PluginLogger';
import * as net from 'net';
import * as http from 'http';
import * as https from 'https';

export interface ConnectionPoolConfig {
  /** 最大连接数 */
  maxConnections: number;
  /** 连接超时时间 (毫秒) */
  connectionTimeout: number;
  /** 空闲连接超时时间 (毫秒) */
  idleTimeout: number;
  /** 连接重试次数 */
  maxRetries: number;
  /** 重试延迟 (毫秒) */
  retryDelay: number;
  /** 连接健康检查间隔 (毫秒) */
  healthCheckInterval: number;
}

export interface Connection {
  id: string;
  type: 'http' | 'https' | 'tcp' | 'ipc';
  target: string;
  socket?: net.Socket;
  agent?: http.Agent | https.Agent;
  inUse: boolean;
  lastUsed: number;
  createdAt: number;
  pluginId?: string;
  retryCount: number;
  isHealthy: boolean;
}

export interface ConnectionRequest {
  id: string;
  type: 'http' | 'https' | 'tcp' | 'ipc';
  target: string;
  pluginId: string;
  options?: any;
  resolve: (connection: Connection) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  failedConnections: number;
  connectionsByType: Record<string, number>;
  connectionsByPlugin: Record<string, number>;
}

export interface ConnectionPoolEvents {
  'connection-created': { connectionId: string; type: string; target: string; pluginId?: string };
  'connection-acquired': { connectionId: string; pluginId: string };
  'connection-released': { connectionId: string; pluginId: string };
  'connection-closed': { connectionId: string; reason: string };
  'connection-failed': { target: string; error: string; pluginId?: string };
  'pool-exhausted': { maxConnections: number; pendingRequests: number };
}

export class ConnectionPoolManager extends TypedEventEmitter<ConnectionPoolEvents> {
  private config: ConnectionPoolConfig;
  private connections: Map<string, Connection> = new Map();
  private connectionsByTarget: Map<string, Set<string>> = new Map();
  private pendingRequests: Map<string, ConnectionRequest> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private nextConnectionId = 1;
  private nextRequestId = 1;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    super();
    
    this.config = {
      maxConnections: config.maxConnections || 100,
      connectionTimeout: config.connectionTimeout || 30000, // 30 seconds
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000, // 1 second
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
    };

    this.startHealthCheck();
    pluginLogger.info('ConnectionPoolManager initialized', undefined, { config: this.config });
  }

  /**
   * 获取连接
   */
  public async getConnection(
    type: 'http' | 'https' | 'tcp' | 'ipc',
    target: string,
    pluginId: string,
    options?: any
  ): Promise<Connection> {
    return new Promise((resolve, reject) => {
      // 检查是否有可用的空闲连接
      const availableConnection = this.findAvailableConnection(type, target);
      if (availableConnection) {
        availableConnection.inUse = true;
        availableConnection.lastUsed = Date.now();
        availableConnection.pluginId = pluginId;
        
        this.emit('connection-acquired', { 
          connectionId: availableConnection.id, 
          pluginId 
        });
        
        pluginLogger.debug('Connection reused', pluginId, { 
          connectionId: availableConnection.id, 
          type, 
          target 
        });
        
        resolve(availableConnection);
        return;
      }

      // 检查连接池是否已满
      if (this.connections.size >= this.config.maxConnections) {
        // 尝试清理空闲连接
        this.cleanupIdleConnections();
        
        // 如果仍然满了，加入等待队列
        if (this.connections.size >= this.config.maxConnections) {
          const requestId = `req_${this.nextRequestId++}`;
          const request: ConnectionRequest = {
            id: requestId,
            type,
            target,
            pluginId,
            options,
            resolve,
            reject,
            createdAt: Date.now()
          };
          
          this.pendingRequests.set(requestId, request);
          
          this.emit('pool-exhausted', { 
            maxConnections: this.config.maxConnections, 
            pendingRequests: this.pendingRequests.size 
          });
          
          pluginLogger.warn('Connection pool exhausted, request queued', pluginId, { 
            requestId, 
            type, 
            target 
          });
          
          // 设置超时
          setTimeout(() => {
            if (this.pendingRequests.has(requestId)) {
              this.pendingRequests.delete(requestId);
              reject(new Error('Connection request timeout'));
            }
          }, this.config.connectionTimeout);
          
          return;
        }
      }

      // 创建新连接
      this.createConnection(type, target, pluginId, options)
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * 释放连接
   */
  public releaseConnection(connectionId: string, pluginId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      pluginLogger.warn('Connection not found for release', pluginId, { connectionId });
      return false;
    }

    if (!connection.inUse) {
      pluginLogger.warn('Attempting to release already released connection', pluginId, { connectionId });
      return false;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();
    connection.pluginId = undefined;

    this.emit('connection-released', { connectionId, pluginId });
    
    pluginLogger.debug('Connection released', pluginId, { connectionId });

    // 处理等待队列
    this.processPendingRequests();

    return true;
  }

  /**
   * 查找可用连接
   */
  private findAvailableConnection(type: string, target: string): Connection | null {
    const targetConnections = this.connectionsByTarget.get(target);
    if (!targetConnections) {
      return null;
    }

    for (const connectionId of targetConnections) {
      const connection = this.connections.get(connectionId);
      if (connection && !connection.inUse && connection.type === type && connection.isHealthy) {
        return connection;
      }
    }

    return null;
  }

  /**
   * 创建新连接
   */
  private async createConnection(
    type: 'http' | 'https' | 'tcp' | 'ipc',
    target: string,
    pluginId: string,
    options?: any
  ): Promise<Connection> {
    const connectionId = `conn_${this.nextConnectionId++}`;
    
    try {
      const connection: Connection = {
        id: connectionId,
        type,
        target,
        inUse: true,
        lastUsed: Date.now(),
        createdAt: Date.now(),
        pluginId,
        retryCount: 0,
        isHealthy: true
      };

      // 根据类型创建连接
      switch (type) {
        case 'http':
          connection.agent = new http.Agent({
            keepAlive: true,
            timeout: this.config.connectionTimeout,
            ...options
          });
          break;
          
        case 'https':
          connection.agent = new https.Agent({
            keepAlive: true,
            timeout: this.config.connectionTimeout,
            ...options
          });
          break;
          
        case 'tcp':
          connection.socket = await this.createTcpConnection(target, options);
          break;
          
        case 'ipc':
          connection.socket = await this.createIpcConnection(target, options);
          break;
          
        default:
          throw new Error(`Unsupported connection type: ${type}`);
      }

      // 添加到连接池
      this.connections.set(connectionId, connection);
      
      // 添加到目标连接映射
      if (!this.connectionsByTarget.has(target)) {
        this.connectionsByTarget.set(target, new Set());
      }
      this.connectionsByTarget.get(target)!.add(connectionId);

      this.emit('connection-created', { connectionId, type, target, pluginId });
      
      pluginLogger.debug('New connection created', pluginId, { connectionId, type, target });

      return connection;
    } catch (error) {
      this.emit('connection-failed', { 
        target, 
        error: (error as Error).message, 
        pluginId 
      });
      
      pluginLogger.error('Failed to create connection', pluginId, error as Error);
      throw error;
    }
  }

  /**
   * 创建TCP连接
   */
  private async createTcpConnection(target: string, options?: any): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const [host, portStr] = target.split(':');
      const port = parseInt(portStr, 10);
      
      const socket = new net.Socket();
      
      socket.setTimeout(this.config.connectionTimeout);
      
      socket.on('connect', () => {
        socket.setTimeout(0); // 清除连接超时
        resolve(socket);
      });
      
      socket.on('error', (error) => {
        reject(error);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
      
      socket.connect(port, host, options);
    });
  }

  /**
   * 创建IPC连接
   */
  private async createIpcConnection(target: string, options?: any): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      
      socket.setTimeout(this.config.connectionTimeout);
      
      socket.on('connect', () => {
        socket.setTimeout(0);
        resolve(socket);
      });
      
      socket.on('error', (error) => {
        reject(error);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('IPC connection timeout'));
      });
      
      socket.connect(target, options);
    });
  }

  /**
   * 处理等待队列
   */
  private processPendingRequests(): void {
    for (const [requestId, request] of this.pendingRequests) {
      const availableConnection = this.findAvailableConnection(request.type, request.target);
      if (availableConnection) {
        availableConnection.inUse = true;
        availableConnection.lastUsed = Date.now();
        availableConnection.pluginId = request.pluginId;
        
        this.pendingRequests.delete(requestId);
        
        this.emit('connection-acquired', { 
          connectionId: availableConnection.id, 
          pluginId: request.pluginId 
        });
        
        request.resolve(availableConnection);
        return; // 一次只处理一个请求
      }
    }
  }

  /**
   * 清理空闲连接
   */
  public cleanupIdleConnections(): void {
    const now = Date.now();
    const closedConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      if (!connection.inUse && (now - connection.lastUsed) > this.config.idleTimeout) {
        this.closeConnection(connectionId, 'idle_timeout');
        closedConnections.push(connectionId);
      }
    }

    if (closedConnections.length > 0) {
      pluginLogger.info('Idle connections cleaned up', undefined, { 
        count: closedConnections.length 
      });
    }
  }

  /**
   * 关闭连接
   */
  public closeConnection(connectionId: string, reason: string = 'manual'): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // 关闭底层连接
    if (connection.socket) {
      connection.socket.destroy();
    }
    if (connection.agent) {
      connection.agent.destroy();
    }

    // 从连接池中移除
    this.connections.delete(connectionId);
    
    // 从目标连接映射中移除
    const targetConnections = this.connectionsByTarget.get(connection.target);
    if (targetConnections) {
      targetConnections.delete(connectionId);
      if (targetConnections.size === 0) {
        this.connectionsByTarget.delete(connection.target);
      }
    }

    this.emit('connection-closed', { connectionId, reason });
    
    pluginLogger.debug('Connection closed', connection.pluginId, { connectionId, reason });

    return true;
  }

  /**
   * 释放插件的所有连接
   */
  public closePluginConnections(pluginId: string): void {
    const closedConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      if (connection.pluginId === pluginId) {
        this.closeConnection(connectionId, 'plugin_cleanup');
        closedConnections.push(connectionId);
      }
    }

    if (closedConnections.length > 0) {
      pluginLogger.info('Plugin connections closed', pluginId, { 
        count: closedConnections.length 
      });
    }
  }

  /**
   * 健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const unhealthyConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      if (!connection.inUse) {
        try {
          // 简单的健康检查
          if (connection.socket && connection.socket.destroyed) {
            connection.isHealthy = false;
            unhealthyConnections.push(connectionId);
          }
        } catch (error) {
          connection.isHealthy = false;
          unhealthyConnections.push(connectionId);
        }
      }
    }

    // 关闭不健康的连接
    for (const connectionId of unhealthyConnections) {
      this.closeConnection(connectionId, 'health_check_failed');
    }

    if (unhealthyConnections.length > 0) {
      pluginLogger.info('Unhealthy connections removed', undefined, { 
        count: unhealthyConnections.length 
      });
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * 获取连接池统计信息
   */
  public getStats(): ConnectionPoolStats {
    let activeConnections = 0;
    const connectionsByType: Record<string, number> = {};
    const connectionsByPlugin: Record<string, number> = {};

    for (const connection of this.connections.values()) {
      if (connection.inUse) {
        activeConnections++;
      }

      connectionsByType[connection.type] = (connectionsByType[connection.type] || 0) + 1;
      
      if (connection.pluginId) {
        connectionsByPlugin[connection.pluginId] = (connectionsByPlugin[connection.pluginId] || 0) + 1;
      }
    }

    return {
      totalConnections: this.connections.size,
      activeConnections,
      idleConnections: this.connections.size - activeConnections,
      pendingRequests: this.pendingRequests.size,
      failedConnections: 0, // TODO: 实现失败连接计数
      connectionsByType,
      connectionsByPlugin
    };
  }

  /**
   * 销毁连接池
   */
  public destroy(): void {
    this.stopHealthCheck();
    
    // 关闭所有连接
    for (const connectionId of this.connections.keys()) {
      this.closeConnection(connectionId, 'pool_destroyed');
    }
    
    // 拒绝所有等待的请求
    for (const request of this.pendingRequests.values()) {
      request.reject(new Error('Connection pool destroyed'));
    }
    this.pendingRequests.clear();
    
    pluginLogger.info('ConnectionPoolManager destroyed');
  }
}

// 全局连接池实例
export const connectionPoolManager = new ConnectionPoolManager();