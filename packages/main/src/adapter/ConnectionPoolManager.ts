import { EventEmitter } from 'events';
import { AcFunLiveApi, createApi, ApiConfig } from 'acfunlive-http-api';
import { TokenManager } from '../services/TokenManager';

/**
 * 连接池配置接口
 * 定义连接池的各种配置参数
 */
export interface ConnectionPoolConfig {
  /** 最大连接数 */
  maxConnections: number;
  /** 每种类型的最大连接数 */
  maxConnectionsPerType: number;
  /** 连接超时时间（毫秒） */
  connectionTimeout: number;
  /** 空闲超时时间（毫秒） */
  idleTimeout: number;
  /** API重试次数（传递给acfunlive-http-api） */
  apiRetryCount: number;
  /** 是否启用健康检查 */
  enableHealthCheck: boolean;
  /** 健康检查间隔（毫秒） */
  healthCheckInterval: number;
  /** 是否启用熔断器 */
  enableCircuitBreaker: boolean;
  /** 熔断器阈值（连续失败次数） */
  circuitBreakerThreshold: number;
  /** 熔断器重置超时时间（毫秒） */
  circuitBreakerResetTimeout: number;
}

/**
 * 池化连接接口
 * 表示连接池中的一个连接实例
 */
export interface PooledConnection {
  /** 连接唯一标识符 */
  id: string;
  /** AcFun Live API 实例 */
  api: AcFunLiveApi;
  /** 连接类型 */
  type: 'danmu' | 'auth' | 'live';
  /** 房间ID（可选，用于弹幕连接） */
  roomId?: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后使用时间戳 */
  lastUsed: number;
  /** 是否处于活跃状态 */
  isActive: boolean;
  /** 健康检查次数 */
  healthCheckCount: number;
  /** 是否健康 */
  isHealthy: boolean;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 连接统计信息接口
 * 提供连接池的运行状态和性能指标
 */
export interface ConnectionStats {
  /** 总连接数 */
  totalConnections: number;
  /** 活跃连接数 */
  activeConnections: number;
  /** 空闲连接数 */
  idleConnections: number;
  /** 按类型分组的连接数 */
  connectionsByType: Record<string, number>;
  /** 平均连接年龄（毫秒） */
  averageConnectionAge: number;
  /** 健康检查失败次数 */
  healthCheckFailures: number;
  /** 熔断器是否开启 */
  circuitBreakerOpen: boolean;
  /** 总请求数 */
  totalRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 平均响应时间（毫秒） */
  averageResponseTime: number;
}

/**
 * 连接错误类型枚举
 * 定义各种可能的连接错误类型
 */
export enum ConnectionErrorType {
  /** 超时错误 */
  TIMEOUT = 'TIMEOUT',
  /** 网络错误 */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 认证错误 */
  AUTH_ERROR = 'AUTH_ERROR',
  /** 速率限制错误 */
  RATE_LIMIT = 'RATE_LIMIT',
  /** 服务器错误 */
  SERVER_ERROR = 'SERVER_ERROR',
  /** 未知错误 */
  UNKNOWN = 'UNKNOWN'
}

/**
 * 连接错误接口
 * 扩展标准 Error 接口，添加连接相关的错误信息
 */
export interface ConnectionError extends Error {
  /** 错误类型 */
  type: ConnectionErrorType;
  /** 是否可重试 */
  retryable: boolean;
  /** 连接ID（可选） */
  connectionId?: string;
}

/**
 * 连接池管理器类
 * 负责管理 AcFun Live API 连接的生命周期，提供连接复用、健康检查、熔断器等功能
 * 
 * 主要功能：
 * - 连接池管理：创建、复用、释放连接
 * - 健康检查：定期检查连接健康状态
 * - 熔断器：在连续失败时暂停请求
 * - 性能监控：收集连接和请求统计信息
 * - 自动清理：清理空闲和不健康的连接
 * 
 * @extends EventEmitter
 * @emits connection-created - 创建新连接时触发
 * @emits connection-destroyed - 销毁连接时触发
 * @emits health-check-failed - 健康检查失败时触发
 * @emits circuit-breaker-opened - 熔断器开启时触发
 * @emits circuit-breaker-closed - 熔断器关闭时触发
 */
export class ConnectionPoolManager extends EventEmitter {
  /** 连接池配置 */
  private config: ConnectionPoolConfig;
  /** 连接映射表 */
  private connections: Map<string, PooledConnection> = new Map();
  /** 按类型分组的连接ID集合 */
  private connectionsByType: Map<string, Set<string>> = new Map();
  /** 健康检查定时器 */
  private healthCheckTimer: NodeJS.Timeout | null = null;
  /** 清理定时器 */
  private cleanupTimer: NodeJS.Timeout | null = null;
  /** 熔断器是否开启 */
  private circuitBreakerOpen: boolean = false;
  /** 熔断器开启时间 */
  private circuitBreakerOpenTime: Date | null = null;
  /** 连续失败次数 */
  private consecutiveFailures: number = 0;
  /** 请求时间记录（用于计算平均响应时间） */
  private requestTimes: number[] = [];
  /** 连接统计信息 */
  private stats: ConnectionStats;

  /**
   * 构造函数
   * @param config 连接池配置（可选，使用默认配置）
   */
  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    super();
    
    // 合并默认配置和用户配置
    this.config = {
      maxConnections: 50,
      maxConnectionsPerType: 20,
      connectionTimeout: 30000,
      idleTimeout: 300000, // 5 minutes
      apiRetryCount: 3,
      enableHealthCheck: true,
      healthCheckInterval: 60000, // 1 minute
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 60000,
      ...config
    };

    // 初始化统计信息
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      connectionsByType: {},
      averageConnectionAge: 0,
      healthCheckFailures: 0,
      circuitBreakerOpen: false,
      totalRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };

    // 初始化定时器
    this.initializeTimers();
  }

  /**
   * 初始化定时器
   * 设置健康检查和清理定时器
   * @private
   */
  private initializeTimers(): void {
    // 启用健康检查定时器
    if (this.config.enableHealthCheck) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck();
      }, this.config.healthCheckInterval);
    }

    // 启用清理定时器，定期清理空闲连接
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.config.idleTimeout / 2);
  }

  /**
   * 获取连接（带熔断器支持）
   * 
   * 此方法是连接池的核心功能，负责：
   * 1. 检查熔断器状态
   * 2. 验证连接池限制
   * 3. 尝试复用现有连接
   * 4. 创建新连接（如果需要）
   * 
   * @param type 连接类型
   * @param options 连接选项
   * @returns Promise<PooledConnection> 池化连接实例
   * @throws {ConnectionError} 当连接获取失败时抛出
   */
  async acquire(type: 'danmu' | 'auth' | 'live', options: { roomId?: string } = {}): Promise<PooledConnection> {
    // 检查熔断器状态
    if (this.isCircuitBreakerOpen()) {
      throw this.createConnectionError(
        'Circuit breaker is open, rejecting requests',
        ConnectionErrorType.SERVER_ERROR,
        false
      );
    }

    const startTime = Date.now();
    
    try {
      // 检查连接池限制
      if (this.connections.size >= this.config.maxConnections) {
        throw new Error('Connection pool is full');
      }

      const typeConnections = this.connectionsByType.get(type) || new Set();
      if (typeConnections.size >= this.config.maxConnectionsPerType) {
        throw new Error(`Too many connections of type: ${type}`);
      }

      // 尝试复用现有连接
      const existingConnection = this.findReusableConnection(type, options.roomId);
      if (existingConnection) {
        existingConnection.lastUsed = Date.now();
        existingConnection.isActive = true;
        this.updateStats(startTime);
        return existingConnection;
      }

      // 创建新连接
      const connection = await this.createConnection(type, options.roomId);
      this.updateStats(startTime);
      return connection;
    } catch (error) {
      this.handleConnectionError(error);
      throw error;
    }
  }

  /**
   * 检查熔断器是否开启
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.config.enableCircuitBreaker) {
      return false;
    }

    // 如果熔断器开启，检查是否可以重置
    if (this.circuitBreakerOpen && this.circuitBreakerOpenTime) {
      const timeSinceOpen = Date.now() - this.circuitBreakerOpenTime.getTime();
      if (timeSinceOpen >= this.config.circuitBreakerResetTimeout) {
        this.resetCircuitBreaker();
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * 重置熔断器
   */
  private resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.circuitBreakerOpenTime = null;
    this.consecutiveFailures = 0;
    this.stats.circuitBreakerOpen = false;
    console.log('[ConnectionPool] Circuit breaker reset');
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: any): void {
    this.stats.failedRequests++;
    this.consecutiveFailures++;

    // 检查是否需要开启熔断器
    if (this.config.enableCircuitBreaker && 
        this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    }
  }

  /**
   * 开启熔断器
   */
  private openCircuitBreaker(): void {
    this.circuitBreakerOpen = true;
    this.circuitBreakerOpenTime = new Date();
    this.stats.circuitBreakerOpen = true;
    console.log('[ConnectionPool] Circuit breaker opened due to consecutive failures');
  }

  /**
   * 创建连接错误
   */
  private createConnectionError(
    message: string, 
    type: ConnectionErrorType, 
    retryable: boolean,
    connectionId?: string
  ): ConnectionError {
    const error = new Error(message) as ConnectionError;
    error.type = type;
    error.retryable = retryable;
    error.connectionId = connectionId;
    return error;
  }

  /**
   * 更新统计信息
   */
  private updateStats(startTime: number): void {
    this.stats.totalRequests++;
    const responseTime = Date.now() - startTime;
    this.requestTimes.push(responseTime);
    
    // 保持最近100个请求的时间记录
    if (this.requestTimes.length > 100) {
      this.requestTimes.shift();
    }
    
    // 计算平均响应时间
    this.stats.averageResponseTime = 
      this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length;
    
    // 重置连续失败计数（成功请求）
    this.consecutiveFailures = 0;
  }

  /**
   * 释放连接
   */
  release(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.isActive = false;
    connection.lastUsed = Date.now();
    
    this.emit('connection-released', connection);
    return true;
  }

  /**
   * 销毁连接
   */
  destroy(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // 从类型映射中移除
    const typeConnections = this.connectionsByType.get(connection.type);
    if (typeConnections) {
      typeConnections.delete(connectionId);
    }

    // 销毁 API 实例
    if (connection.api && typeof connection.api.destroy === 'function') {
      try {
        connection.api.destroy();
      } catch (error) {
        console.warn(`[ConnectionPool] Error destroying API instance:`, error);
      }
    }

    // 从连接池中移除
    this.connections.delete(connectionId);
    
    this.emit('connection-destroyed', connection);
    return true;
  }

  /**
   * 查找可复用的连接
   */
  private findReusableConnection(type: string, roomId?: string): PooledConnection | null {
    const typeConnections = this.connectionsByType.get(type);
    if (!typeConnections) {
      return null;
    }

    for (const connectionId of typeConnections) {
      const connection = this.connections.get(connectionId);
      if (!connection || connection.isActive) {
        continue;
      }

      // 对于 danmu 类型，需要匹配房间ID
      if (type === 'danmu' && connection.roomId !== roomId) {
        continue;
      }

      // 检查连接是否还有效
      const age = Date.now() - connection.lastUsed;
      if (age > this.config.idleTimeout) {
        continue;
      }

      return connection;
    }

    return null;
  }

  /**
   * 创建新连接
   */
  private async createConnection(type: 'danmu' | 'auth' | 'live', roomId?: string): Promise<PooledConnection> {
    const connectionId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 使用 TokenManager 提供的统一 API 实例
      const tokenManager = TokenManager.getInstance();
      const api = tokenManager.getApiInstance();
      
      const connection: PooledConnection = {
        id: connectionId,
        api,
        type,
        roomId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: true,
        healthCheckCount: 0,
        isHealthy: true,
        retryCount: 0
      };

      // 添加到连接池
      this.connections.set(connectionId, connection);
      
      // 添加到类型映射
      let typeConnections = this.connectionsByType.get(type);
      if (!typeConnections) {
        typeConnections = new Set();
        this.connectionsByType.set(type, typeConnections);
      }
      typeConnections.add(connectionId);

      this.emit('connection-created', connection);
      return connection;
      
    } catch (error) {
      console.error(`[ConnectionPool] Failed to create ${type} connection:`, error);
      throw error;
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const connections = Array.from(this.connections.values());
    const healthCheckPromises = connections.map(async (connection) => {
      try {
        // 执行健康检查
        const isHealthy = await this.checkConnectionHealth(connection);
        connection.isHealthy = isHealthy;
        connection.healthCheckCount++;
        
        if (!isHealthy) {
          this.stats.healthCheckFailures++;
          console.log(`[ConnectionPool] Health check failed for connection ${connection.id}`);
          
          // 如果连接不健康，尝试重新创建
          if (connection.retryCount < this.config.apiRetryCount) {
            connection.retryCount++;
            await this.recreateConnection(connection);
          } else {
            // 超过重试次数，销毁连接
            this.destroy(connection.id);
          }
        } else {
          // 健康检查成功，重置重试计数
          connection.retryCount = 0;
        }
      } catch (error) {
        console.error(`[ConnectionPool] Health check error for connection ${connection.id}:`, error);
        this.stats.healthCheckFailures++;
        
        // 健康检查异常，标记为不健康
        connection.isHealthy = false;
        connection.retryCount++;
        
        if (connection.retryCount >= this.config.apiRetryCount) {
          this.destroy(connection.id);
        }
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * 检查单个连接的健康状态
   */
  private async checkConnectionHealth(connection: PooledConnection): Promise<boolean> {
    try {
      // 简单的健康检查：尝试获取用户信息
      const startTime = Date.now();
      await Promise.race([
        connection.api.user.getUserInfo('123456'), // 使用一个测试用户ID
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);
      
      const responseTime = Date.now() - startTime;
      
      // 如果响应时间过长，认为连接不健康
      if (responseTime > 10000) {
        return false;
      }
      
      // 检查连接年龄
      const age = Date.now() - connection.createdAt;
      const maxAge = this.config.idleTimeout * 3;
      if (age > maxAge) {
        console.log(`[ConnectionPool] Connection ${connection.id} is too old`);
        return false;
      }

      // 检查是否长时间未使用
      const idleTime = Date.now() - connection.lastUsed;
      if (idleTime > this.config.idleTimeout) {
        console.log(`[ConnectionPool] Connection ${connection.id} has been idle too long`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`[ConnectionPool] Health check failed for ${connection.id}:`, error);
      return false;
    }
  }

  /**
   * 重新创建连接
   */
  private async recreateConnection(connection: PooledConnection): Promise<void> {
    try {
      console.log(`[ConnectionPool] Recreating connection ${connection.id}`);
      
      // 使用 TokenManager 提供的统一 API 实例
      const tokenManager = TokenManager.getInstance();
      const newApi = tokenManager.getApiInstance();
      
      // 更新连接
      connection.api = newApi;
      connection.createdAt = Date.now();
      connection.isHealthy = true;
      connection.lastUsed = Date.now();
      
      console.log(`[ConnectionPool] Successfully recreated connection ${connection.id}`);
    } catch (error) {
      console.error(`[ConnectionPool] Failed to recreate connection ${connection.id}:`, error);
      connection.isHealthy = false;
      throw error;
    }
  }

  /**
   * 清理空闲连接
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToDestroy: string[] = [];

    for (const connection of this.connections.values()) {
      if (connection.isActive) {
        continue;
      }

      const idleTime = now - connection.lastUsed;
      if (idleTime > this.config.idleTimeout) {
        connectionsToDestroy.push(connection.id);
      }
    }

    for (const connectionId of connectionsToDestroy) {
      this.destroy(connectionId);
    }

    if (connectionsToDestroy.length > 0) {
      console.log(`[ConnectionPool] Cleaned up ${connectionsToDestroy.length} idle connections`);
    }
  }

  /**
   * 获取连接池统计信息
   */
  getStats(): ConnectionStats {
    const totalConnections = this.connections.size;
    let activeConnections = 0;
    let totalAge = 0;
    let healthCheckFailures = 0;
    const connectionsByType: Record<string, number> = {};

    const now = Date.now();

    for (const connection of this.connections.values()) {
      if (connection.isActive) {
        activeConnections++;
      }
      
      totalAge += now - connection.createdAt;
      
      if (connection.healthCheckCount > 1) {
        healthCheckFailures++;
      }

      connectionsByType[connection.type] = (connectionsByType[connection.type] || 0) + 1;
    }

    return {
      totalConnections,
      activeConnections,
      idleConnections: totalConnections - activeConnections,
      connectionsByType,
      averageConnectionAge: totalConnections > 0 ? totalAge / totalConnections : 0,
      healthCheckFailures,
      circuitBreakerOpen: this.circuitBreakerOpen,
      totalRequests: this.stats.totalRequests,
      failedRequests: this.stats.failedRequests,
      averageResponseTime: this.stats.averageResponseTime
    };
  }

  /**
   * 获取详细的性能指标
   */
  getPerformanceMetrics(): {
    connectionPool: ConnectionStats;
    performance: {
      requestsPerSecond: number;
      averageWaitTime: number;
      connectionUtilization: number;
      errorRate: number;
      circuitBreakerStatus: {
        isOpen: boolean;
        consecutiveFailures: number;
        openTime: Date | null;
      };
    };
    health: {
      healthyConnections: number;
      unhealthyConnections: number;
      totalHealthChecks: number;
      healthCheckFailureRate: number;
    };
  } {
    const stats = this.getStats();
    const totalConnections = this.connections.size;
    const healthyConnections = Array.from(this.connections.values())
      .filter(conn => conn.isHealthy).length;
    const totalHealthChecks = Array.from(this.connections.values())
      .reduce((sum, conn) => sum + conn.healthCheckCount, 0);

    return {
      connectionPool: stats,
      performance: {
        requestsPerSecond: this.calculateRequestsPerSecond(),
        averageWaitTime: this.calculateAverageWaitTime(),
        connectionUtilization: totalConnections > 0 ? 
          stats.activeConnections / totalConnections : 0,
        errorRate: stats.totalRequests > 0 ? 
          stats.failedRequests / stats.totalRequests : 0,
        circuitBreakerStatus: {
          isOpen: this.circuitBreakerOpen,
          consecutiveFailures: this.consecutiveFailures,
          openTime: this.circuitBreakerOpenTime
        }
      },
      health: {
        healthyConnections,
        unhealthyConnections: totalConnections - healthyConnections,
        totalHealthChecks,
        healthCheckFailureRate: totalHealthChecks > 0 ? 
          stats.healthCheckFailures / totalHealthChecks : 0
      }
    };
  }

  /**
   * 计算每秒请求数
   */
  private calculateRequestsPerSecond(): number {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // 这里简化实现，实际应该维护一个时间窗口内的请求计数
    return this.stats.totalRequests; // 简化版本
  }

  /**
   * 计算平均等待时间
   */
  private calculateAverageWaitTime(): number {
    // 这里简化实现，实际应该跟踪连接获取的等待时间
    return this.stats.averageResponseTime;
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring(callback: (metrics: any) => void, interval: number = 30000): void {
    setInterval(() => {
      const metrics = this.getPerformanceMetrics();
      callback(metrics);
    }, interval);
  }

  /**
   * 获取指定类型的连接数量
   */
  getConnectionCount(type?: string): number {
    if (type) {
      const typeConnections = this.connectionsByType.get(type);
      return typeConnections ? typeConnections.size : 0;
    }
    return this.connections.size;
  }

  /**
   * 清理所有连接
   */
  cleanup(): void {
    // 清理定时器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 销毁所有连接
    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      this.destroy(connectionId);
    }

    // 清理映射
    this.connectionsByType.clear();
    
    // 移除所有监听器
    this.removeAllListeners();
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 重新初始化定时器
    this.cleanup();
    this.initializeTimers();
  }
}

// 单例实例
export const connectionPool = new ConnectionPoolManager();