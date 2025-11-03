import { EventEmitter } from 'events';

export enum ConnectionErrorType {
  NETWORK_ERROR = 'network_error',
  AUTH_ERROR = 'auth_error',
  ROOM_NOT_FOUND = 'room_not_found',
  RATE_LIMITED = 'rate_limited',
  SERVER_ERROR = 'server_error',
  WEBSOCKET_ERROR = 'websocket_error',
  TIMEOUT_ERROR = 'timeout_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export enum RecoveryStrategy {
  IMMEDIATE_RETRY = 'immediate_retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  NO_RETRY = 'no_retry',
  RESET_CONNECTION = 'reset_connection'
}

export interface ConnectionError {
  roomId: string;
  type: ConnectionErrorType;
  message: string;
  error: Error;
  timestamp: number;
  context?: Record<string, any>;
}

export interface RecoveryConfig {
  errorType: ConnectionErrorType;
  strategy: RecoveryStrategy;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  timeoutMs: number;
}

export interface ConnectionErrorHandlerEvents {
  'error': (error: ConnectionError) => void;
  'recovery-attempt': (roomId: string, attempt: number, maxAttempts: number) => void;
  'recovery-success': (roomId: string, attempts: number) => void;
  'recovery-failed': (roomId: string, finalError: ConnectionError) => void;
  'max-retries-exceeded': (roomId: string, errorType: ConnectionErrorType) => void;
}

/**
 * 连接错误处理器
 * 提供智能的连接错误恢复机制，支持多种恢复策略
 * 自动分类错误类型并执行相应的恢复操作
 */
export class ConnectionErrorHandler extends EventEmitter {
  /** 恢复配置映射 */
  private recoveryConfigs: Map<ConnectionErrorType, RecoveryConfig> = new Map();
  /** 重试尝试次数记录 */
  private retryAttempts: Map<string, number> = new Map();
  /** 错误历史记录 */
  private errorHistory: Map<string, ConnectionError[]> = new Map();
  /** 恢复定时器映射 */
  private recoveryTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 构造函数
   * 初始化错误处理器并设置默认恢复配置
   */
  constructor() {
    super();
    this.initializeRecoveryConfigs();
  }

  private initializeRecoveryConfigs(): void {
    const configs: Array<[ConnectionErrorType, RecoveryConfig]> = [
      [ConnectionErrorType.NETWORK_ERROR, {
        errorType: ConnectionErrorType.NETWORK_ERROR,
        strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        timeoutMs: 10000
      }],
      [ConnectionErrorType.AUTH_ERROR, {
        errorType: ConnectionErrorType.AUTH_ERROR,
        strategy: RecoveryStrategy.NO_RETRY,
        maxRetries: 0,
        baseDelay: 0,
        maxDelay: 0,
        timeoutMs: 5000
      }],
      [ConnectionErrorType.ROOM_NOT_FOUND, {
        errorType: ConnectionErrorType.ROOM_NOT_FOUND,
        strategy: RecoveryStrategy.LINEAR_BACKOFF,
        maxRetries: 3,
        baseDelay: 5000,
        maxDelay: 15000,
        timeoutMs: 8000
      }],
      [ConnectionErrorType.RATE_LIMITED, {
        errorType: ConnectionErrorType.RATE_LIMITED,
        strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 3,
        baseDelay: 10000,
        maxDelay: 60000,
        timeoutMs: 15000
      }],
      [ConnectionErrorType.SERVER_ERROR, {
        errorType: ConnectionErrorType.SERVER_ERROR,
        strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 4,
        baseDelay: 2000,
        maxDelay: 20000,
        timeoutMs: 12000
      }],
      [ConnectionErrorType.WEBSOCKET_ERROR, {
        errorType: ConnectionErrorType.WEBSOCKET_ERROR,
        strategy: RecoveryStrategy.RESET_CONNECTION,
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        timeoutMs: 8000
      }],
      [ConnectionErrorType.TIMEOUT_ERROR, {
        errorType: ConnectionErrorType.TIMEOUT_ERROR,
        strategy: RecoveryStrategy.IMMEDIATE_RETRY,
        maxRetries: 2,
        baseDelay: 500,
        maxDelay: 2000,
        timeoutMs: 15000
      }],
      [ConnectionErrorType.UNKNOWN_ERROR, {
        errorType: ConnectionErrorType.UNKNOWN_ERROR,
        strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 2,
        baseDelay: 2000,
        maxDelay: 10000,
        timeoutMs: 10000
      }]
    ];

    for (const [errorType, config] of configs) {
      this.recoveryConfigs.set(errorType, config);
    }
  }

  /**
   * 处理连接错误并尝试恢复
   * @param roomId 房间ID
   * @param error 错误对象
   * @param context 错误上下文信息
   * @returns 是否成功启动恢复流程
   */
  async handleConnectionError(
    roomId: string,
    error: Error,
    context?: Record<string, any>
  ): Promise<boolean> {
    const errorType = this.classifyError(error, context);
    const connectionError: ConnectionError = {
      roomId,
      type: errorType,
      message: error.message,
      error,
      timestamp: Date.now(),
      context
    };

    // 记录错误
    this.recordError(connectionError);
    this.emit('error', connectionError);

    // 获取恢复配置
    const config = this.recoveryConfigs.get(errorType);
    if (!config || config.strategy === RecoveryStrategy.NO_RETRY) {
      console.log(`[ConnectionErrorHandler] No recovery strategy for ${errorType} in room ${roomId}`);
      return false;
    }

    // 检查重试次数
    const retryKey = `${roomId}:${errorType}`;
    const currentAttempts = this.retryAttempts.get(retryKey) || 0;

    if (currentAttempts >= config.maxRetries) {
      console.log(`[ConnectionErrorHandler] Max retries exceeded for ${errorType} in room ${roomId}`);
      this.emit('max-retries-exceeded', roomId, errorType);
      this.retryAttempts.delete(retryKey);
      return false;
    }

    // 计算延迟时间
    const delay = this.calculateDelay(config, currentAttempts);
    
    // 更新重试次数
    this.retryAttempts.set(retryKey, currentAttempts + 1);

    console.log(`[ConnectionErrorHandler] Scheduling recovery for ${errorType} in room ${roomId} (attempt ${currentAttempts + 1}/${config.maxRetries}) after ${delay}ms`);
    
    this.emit('recovery-attempt', roomId, currentAttempts + 1, config.maxRetries);

    // 清除之前的定时器
    const existingTimer = this.recoveryTimers.get(retryKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置恢复定时器
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.recoveryTimers.delete(retryKey);
        resolve(true);
      }, delay);

      this.recoveryTimers.set(retryKey, timer);
    });
  }

  /**
   * 标记恢复成功
   * @param roomId 房间ID
   * @param errorType 错误类型
   */
  markRecoverySuccess(roomId: string, errorType: ConnectionErrorType): void {
    const retryKey = `${roomId}:${errorType}`;
    const attempts = this.retryAttempts.get(retryKey) || 0;
    
    this.retryAttempts.delete(retryKey);
    
    // 清除定时器
    const timer = this.recoveryTimers.get(retryKey);
    if (timer) {
      clearTimeout(timer);
      this.recoveryTimers.delete(retryKey);
    }

    console.log(`[ConnectionErrorHandler] Recovery successful for room ${roomId} after ${attempts} attempts`);
    this.emit('recovery-success', roomId, attempts);
  }

  /**
   * 标记恢复失败
   * @param roomId 房间ID
   * @param finalError 最终错误信息
   */
  markRecoveryFailed(roomId: string, finalError: ConnectionError): void {
    const retryKey = `${roomId}:${finalError.type}`;
    this.retryAttempts.delete(retryKey);
    
    // 清除定时器
    const timer = this.recoveryTimers.get(retryKey);
    if (timer) {
      clearTimeout(timer);
      this.recoveryTimers.delete(retryKey);
    }

    console.log(`[ConnectionErrorHandler] Recovery failed for room ${roomId}: ${finalError.message}`);
    this.emit('recovery-failed', roomId, finalError);
  }

  /**
   * 分类错误类型
   * 根据错误消息和上下文信息自动识别错误类型
   * @param error 错误对象
   * @param context 错误上下文信息
   * @returns 分类后的错误类型
   */
  private classifyError(error: Error, context?: Record<string, any>): ConnectionErrorType {
    const message = error.message.toLowerCase();
    
    // 网络相关错误
    if (message.includes('network') || message.includes('enotfound') || 
        message.includes('econnrefused') || message.includes('timeout')) {
      return ConnectionErrorType.NETWORK_ERROR;
    }
    
    // 认证错误
    if (message.includes('auth') || message.includes('unauthorized') || 
        message.includes('forbidden') || message.includes('token')) {
      return ConnectionErrorType.AUTH_ERROR;
    }
    
    // 房间不存在
    if (message.includes('room not found') || message.includes('invalid room') ||
        message.includes('404')) {
      return ConnectionErrorType.ROOM_NOT_FOUND;
    }
    
    // 限流错误
    if (message.includes('rate limit') || message.includes('too many requests') ||
        message.includes('429')) {
      return ConnectionErrorType.RATE_LIMITED;
    }
    
    // 服务器错误
    if (message.includes('server error') || message.includes('500') ||
        message.includes('502') || message.includes('503')) {
      return ConnectionErrorType.SERVER_ERROR;
    }
    
    // WebSocket 错误
    if (message.includes('websocket') || message.includes('ws') ||
        context?.connectionType === 'websocket') {
      return ConnectionErrorType.WEBSOCKET_ERROR;
    }
    
    // 超时错误
    if (message.includes('timeout') || message.includes('timed out')) {
      return ConnectionErrorType.TIMEOUT_ERROR;
    }
    
    return ConnectionErrorType.UNKNOWN_ERROR;
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(config: RecoveryConfig, attempt: number): number {
    switch (config.strategy) {
      case RecoveryStrategy.IMMEDIATE_RETRY:
        return 0;
      
      case RecoveryStrategy.LINEAR_BACKOFF:
        return Math.min(config.baseDelay * (attempt + 1), config.maxDelay);
      
      case RecoveryStrategy.EXPONENTIAL_BACKOFF:
        return Math.min(config.baseDelay * Math.pow(2, attempt), config.maxDelay);
      
      case RecoveryStrategy.RESET_CONNECTION:
        return config.baseDelay;
      
      default:
        return config.baseDelay;
    }
  }

  /**
   * 记录错误历史
   */
  private recordError(error: ConnectionError): void {
    const history = this.errorHistory.get(error.roomId) || [];
    history.push(error);
    
    // 只保留最近的50个错误
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    this.errorHistory.set(error.roomId, history);
  }

  /**
   * 获取错误统计
   */
  getErrorStats(roomId?: string): Record<string, any> {
    if (roomId) {
      const history = this.errorHistory.get(roomId) || [];
      const stats: Record<string, number> = {};
      
      for (const error of history) {
        stats[error.type] = (stats[error.type] || 0) + 1;
      }
      
      return {
        roomId,
        totalErrors: history.length,
        errorsByType: stats,
        lastError: history[history.length - 1]
      };
    }
    
    // 全局统计
    const globalStats: Record<string, number> = {};
    let totalErrors = 0;
    
    for (const history of this.errorHistory.values()) {
      totalErrors += history.length;
      for (const error of history) {
        globalStats[error.type] = (globalStats[error.type] || 0) + 1;
      }
    }
    
    return {
      totalErrors,
      errorsByType: globalStats,
      activeRetries: this.retryAttempts.size
    };
  }

  /**
   * 清理房间相关的错误处理状态
   */
  cleanup(roomId: string): void {
    // 清理错误历史
    this.errorHistory.delete(roomId);
    
    // 清理重试计数和定时器
    const keysToDelete: string[] = [];
    for (const key of this.retryAttempts.keys()) {
      if (key.startsWith(`${roomId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.retryAttempts.delete(key);
      
      const timer = this.recoveryTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.recoveryTimers.delete(key);
      }
    }
  }

  /**
   * 更新恢复配置
   */
  updateRecoveryConfig(errorType: ConnectionErrorType, config: Partial<RecoveryConfig>): void {
    const currentConfig = this.recoveryConfigs.get(errorType);
    if (currentConfig) {
      this.recoveryConfigs.set(errorType, { ...currentConfig, ...config });
    }
  }

  /**
   * 销毁错误处理器
   */
  destroy(): void {
    // 清理所有定时器
    for (const timer of this.recoveryTimers.values()) {
      clearTimeout(timer);
    }
    
    this.recoveryTimers.clear();
    this.retryAttempts.clear();
    this.errorHistory.clear();
    this.removeAllListeners();
  }
}