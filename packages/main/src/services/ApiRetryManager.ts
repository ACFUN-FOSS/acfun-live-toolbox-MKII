import { EventEmitter } from 'events';
import { AuthManager, ExtendedTokenInfo } from './AuthManager';

export enum ApiErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  SERVER_ERROR = 'server_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  AUTH_ERROR = 'auth_error',
  CLIENT_ERROR = 'client_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  FIXED_DELAY = 'fixed_delay',
  NO_RETRY = 'no_retry'
}

export interface RetryConfig {
  errorType: ApiErrorType;
  strategy: RetryStrategy;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean; // 添加随机抖动
  retryCondition?: (error: Error, attempt: number) => boolean;
}

export interface ApiRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  strategy?: RetryStrategy;
  jitter?: boolean;
  retryCondition?: (error: Error, attempt: number) => boolean;
}

export interface RetryAttempt {
  attempt: number;
  delay: number;
  error: Error;
  timestamp: number;
}

export interface RetryStats {
  totalAttempts: number;
  totalRetries: number;
  successCount: number;
  failureCount: number;
  lastAttemptTime?: number;
  averageDelay?: number;
}

export interface ApiRetryManagerEvents {
  'retry-attempt': (data: { key: string; attempt: number; maxAttempts: number; delay: number }) => void;
  'retry-success': (data: { key: string; attempts: number; totalTime: number }) => void;
  'retry-failed': (data: { key: string; finalError: Error; attempts: number; totalTime: number }) => void;
  'max-retries-exceeded': (data: { key: string; errorType: ApiErrorType }) => void;
  'auth-token-refreshed': (data: { key: string; tokenInfo: ExtendedTokenInfo }) => void;
  'auth-refresh-failed': (data: { key: string; error: string }) => void;
}

/**
 * API重试管理器
 * 提供智能的错误重试机制，支持多种退避策略
 * 集成认证管理，自动处理token过期和刷新
 */
export class ApiRetryManager extends EventEmitter {
  private retryConfigs: Map<ApiErrorType, RetryConfig> = new Map();
  private activeRetries: Map<string, RetryAttempt[]> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private retryStats: Map<string, RetryStats> = new Map();
  private authManager?: AuthManager;

  constructor(authManager?: AuthManager) {
    super();
    this.authManager = authManager;
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs(): void {
    const configs: Array<[ApiErrorType, RetryConfig]> = [
      [ApiErrorType.NETWORK_ERROR, {
        errorType: ApiErrorType.NETWORK_ERROR,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        jitter: true
      }],
      [ApiErrorType.TIMEOUT_ERROR, {
        errorType: ApiErrorType.TIMEOUT_ERROR,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 2,
        baseDelay: 2000,
        maxDelay: 8000,
        jitter: true
      }],
      [ApiErrorType.SERVER_ERROR, {
        errorType: ApiErrorType.SERVER_ERROR,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 3,
        baseDelay: 2000,
        maxDelay: 15000,
        jitter: true
      }],
      [ApiErrorType.RATE_LIMIT_ERROR, {
        errorType: ApiErrorType.RATE_LIMIT_ERROR,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 2,
        baseDelay: 5000,
        maxDelay: 30000,
        jitter: false // 速率限制不需要抖动
      }],
      [ApiErrorType.AUTH_ERROR, {
        errorType: ApiErrorType.AUTH_ERROR,
        strategy: RetryStrategy.NO_RETRY,
        maxRetries: 0,
        baseDelay: 0,
        maxDelay: 0,
        jitter: false
      }],
      [ApiErrorType.CLIENT_ERROR, {
        errorType: ApiErrorType.CLIENT_ERROR,
        strategy: RetryStrategy.NO_RETRY,
        maxRetries: 0,
        baseDelay: 0,
        maxDelay: 0,
        jitter: false
      }],
      [ApiErrorType.UNKNOWN_ERROR, {
        errorType: ApiErrorType.UNKNOWN_ERROR,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 1,
        baseDelay: 1000,
        maxDelay: 5000,
        jitter: true
      }]
    ];

    for (const [errorType, config] of configs) {
      this.retryConfigs.set(errorType, config);
    }
  }

  /**
   * 执行带重试的API调用
   */
  async executeWithRetry<T>(
    key: string,
    operation: () => Promise<T>,
    options?: ApiRetryOptions
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error;
    let errorType: ApiErrorType | undefined;
    let config: RetryConfig | undefined;
    let maxRetries = options?.maxRetries ?? 3; // 默认值

    // 清理之前的重试记录
    this.clearRetryHistory(key);
    // 初始化统计信息
    this.initializeStats(key);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      this.updateStats(key, 'attempt');
      
      try {
        const result = await operation();
        
        // 成功时清理重试记录并发出事件
        this.updateStats(key, 'success');
        if (attempt > 0) {
          const totalTime = Date.now() - startTime;
          this.emit('retry-success', { key, attempts: attempt + 1, totalTime });
          this.clearRetryHistory(key);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // 第一次错误时，分类错误并获取配置
        if (attempt === 0) {
          errorType = this.classifyError(error);
          config = this.retryConfigs.get(errorType);
          // 更新maxRetries，优先使用options，然后是config，最后是默认值
          maxRetries = options?.maxRetries ?? config?.maxRetries ?? 3;
        }
        
        // 特殊处理认证错误
        if (errorType === ApiErrorType.AUTH_ERROR && this.authManager) {
          try {
            console.log(`[ApiRetryManager] 检测到认证错误，尝试刷新token: ${key}`);
            
            // 尝试刷新token
            const refreshResult = await this.authManager.refreshToken();
            
            if (refreshResult.success && refreshResult.qrCode) {
              // 由于acfunlive-http-api不支持自动刷新，需要用户重新扫码
              this.emit('auth-refresh-failed', { 
                key, 
                error: 'Token expired. Please scan the new QR code to re-authenticate.' 
              });
              
              // 不继续重试，需要用户干预
              break;
            } else {
              this.emit('auth-refresh-failed', { 
                key, 
                error: refreshResult.message || 'Failed to refresh authentication token' 
              });
              
              // 认证刷新失败，不继续重试
              break;
            }
          } catch (authError) {
            console.error(`[ApiRetryManager] 认证刷新失败: ${authError}`);
            this.emit('auth-refresh-failed', { 
              key, 
              error: `Authentication refresh failed: ${authError instanceof Error ? authError.message : String(authError)}` 
            });
            
            // 认证刷新异常，不继续重试
            break;
          }
        }
        
        // 记录重试尝试
        const retryAttempt: RetryAttempt = {
          attempt,
          delay: 0,
          error,
          timestamp: Date.now()
        };
        
        if (!this.activeRetries.has(key)) {
          this.activeRetries.set(key, []);
        }
        this.activeRetries.get(key)!.push(retryAttempt);

        // 如果是最后一次尝试，不再重试
        if (attempt >= maxRetries) {
          break;
        }
        
        // 检查是否应该重试
        if (!this.shouldRetry(error, attempt, config, options)) {
          break;
        }

        // 计算延迟时间
        const delay = this.calculateDelay(errorType!, attempt, options);
        retryAttempt.delay = delay;

        // 记录重试统计
        this.updateStats(key, 'retry');

        this.emit('retry-attempt', { 
          key, 
          attempt: attempt + 1, 
          maxAttempts: maxRetries + 1, 
          delay 
        });

        // 等待延迟
        await this.delay(delay);
      }
    }

    // 所有重试都失败了
    const totalTime = Date.now() - startTime;
    const attempts = this.activeRetries.get(key)?.length ?? 0;
    
    this.updateStats(key, 'failure');
    this.emit('retry-failed', { key, finalError: lastError!, attempts, totalTime });
    this.clearRetryHistory(key);
    
    throw lastError!;
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: Error): ApiErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('etimedout')) {
      return ApiErrorType.TIMEOUT_ERROR;
    }
    
    if (message.includes('network') || message.includes('econnrefused') || 
        message.includes('enotfound') || message.includes('econnreset')) {
      return ApiErrorType.NETWORK_ERROR;
    }
    
    if (message.includes('429') || message.includes('rate limit') || 
        message.includes('too many requests')) {
      return ApiErrorType.RATE_LIMIT_ERROR;
    }
    
    if (message.includes('401') || message.includes('403') || 
        message.includes('unauthorized') || message.includes('forbidden')) {
      return ApiErrorType.AUTH_ERROR;
    }
    
    if (message.includes('400') || message.includes('404') || 
        message.includes('bad request') || message.includes('not found')) {
      return ApiErrorType.CLIENT_ERROR;
    }
    
    if (message.includes('500') || message.includes('502') || 
        message.includes('503') || message.includes('504') ||
        message.includes('internal server error') || 
        message.includes('bad gateway') || 
        message.includes('service unavailable') ||
        message.includes('gateway timeout')) {
      return ApiErrorType.SERVER_ERROR;
    }
    
    return ApiErrorType.UNKNOWN_ERROR;
  }

  /**
   * 检查是否应该重试
   */
  /**
   * 检查是否应该重试
   */
  private shouldRetry(
    error: Error, 
    attempt: number, 
    config?: RetryConfig, 
    options?: ApiRetryOptions
  ): boolean {
    // 检查自定义重试条件
    if (options?.retryCondition) {
      return options.retryCondition(error, attempt);
    }
    
    // 检查配置的重试条件
    if (config?.retryCondition) {
      return config.retryCondition(error, attempt);
    }
    
    // 默认策略：根据错误类型决定
    const errorType = this.classifyError(error);
    const retryConfig = this.retryConfigs.get(errorType);
    
    return retryConfig?.strategy !== RetryStrategy.NO_RETRY;
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(
    errorType: ApiErrorType, 
    attempt: number, 
    options?: ApiRetryOptions
  ): number {
    const config = this.retryConfigs.get(errorType);
    const strategy = options?.strategy || config?.strategy || RetryStrategy.EXPONENTIAL_BACKOFF;
    const baseDelay = options?.baseDelay || config?.baseDelay || 1000;
    const maxDelay = options?.maxDelay || config?.maxDelay || 10000;
    const jitter = options?.jitter ?? config?.jitter ?? true;

    let delay: number;

    switch (strategy) {
      case RetryStrategy.EXPONENTIAL_BACKOFF:
        delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        break;
      
      case RetryStrategy.LINEAR_BACKOFF:
        delay = Math.min(baseDelay * (attempt + 1), maxDelay);
        break;
      
      case RetryStrategy.FIXED_DELAY:
        delay = baseDelay;
        break;
      
      default:
        delay = baseDelay;
    }

    // 添加抖动以避免雷群效应
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理重试历史
   */
  private clearRetryHistory(key: string): void {
    this.activeRetries.delete(key);
    
    const timer = this.retryTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(key);
    }
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(key: string): void {
    if (!this.retryStats.has(key)) {
      this.retryStats.set(key, {
        totalAttempts: 0,
        totalRetries: 0,
        successCount: 0,
        failureCount: 0
      });
    }
  }

  /**
    * 更新统计信息
    */
   private updateStats(key: string, type: 'attempt' | 'success' | 'failure' | 'retry'): void {
     const stats = this.retryStats.get(key);
     if (!stats) return;

     switch (type) {
       case 'attempt':
         stats.totalAttempts++;
         break;
       case 'retry':
         stats.totalRetries++;
         break;
       case 'success':
         stats.successCount++;
         stats.lastAttemptTime = Date.now();
         break;
       case 'failure':
         stats.failureCount++;
         stats.lastAttemptTime = Date.now();
         break;
     }
   }

  /**
   * 获取重试统计信息
   */
  getRetryStats(key: string): RetryStats | undefined {
    return this.retryStats.get(key);
  }

  /**
   * 获取所有统计信息
   */
  getAllStats(): Map<string, RetryStats> {
    return new Map(this.retryStats);
  }

  /**
   * 清理所有重试记录和统计信息
   */
  clearAll(): void {
    this.activeRetries.clear();
    this.retryStats.clear();
    // 清理所有定时器
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
  }

  /**
   * 更新重试配置
   */
  updateRetryConfig(errorType: ApiErrorType, config: Partial<RetryConfig>): void {
    const currentConfig = this.retryConfigs.get(errorType);
    if (currentConfig) {
      this.retryConfigs.set(errorType, { ...currentConfig, ...config });
    } else {
      // 如果配置不存在，创建默认配置并应用更新
      const defaultConfig: RetryConfig = {
        errorType,
        strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        jitter: true
      };
      this.retryConfigs.set(errorType, { ...defaultConfig, ...config });
    }
  }

  /**
   * 取消指定的重试操作
   */
  cancelRetry(key: string): void {
    this.clearRetryHistory(key);
  }

  /**
   * 设置AuthManager实例
   */
  setAuthManager(authManager: AuthManager): void {
    this.authManager = authManager;
  }

  /**
   * 获取AuthManager实例
   */
  getAuthManager(): AuthManager | undefined {
    return this.authManager;
  }

  /**
   * 检查是否有有效的认证
   */
  isAuthenticated(): boolean {
    return this.authManager?.isAuthenticated() ?? false;
  }

  /**
   * 清理所有重试操作
   */
  cleanup(): void {
    for (const key of this.activeRetries.keys()) {
      this.clearRetryHistory(key);
    }
  }
}

// 单例实例
export const apiRetryManager = new ApiRetryManager();