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

// 简化的API选项，移除重试相关配置（由acfunlive-http-api处理）
export interface ApiCallOptions {
  // 保留认证相关选项
  requireAuth?: boolean;
  // 移除重试相关选项，使用API内置重试
}

export interface ApiCallStats {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  authRefreshCount: number;
  lastCallTime?: number;
}

export interface ApiRetryManagerEvents {
  'api-call': (data: { key: string; success: boolean; duration: number }) => void;
  'auth-token-refreshed': (data: { key: string; tokenInfo: ExtendedTokenInfo }) => void;
  'auth-refresh-failed': (data: { key: string; error: string }) => void;
}

/**
 * API调用管理器
 * 简化版本，专注于认证管理和统计，重试逻辑由acfunlive-http-api内置处理
 */
export class ApiRetryManager extends EventEmitter {
  private callStats: Map<string, ApiCallStats> = new Map();
  private authManager?: AuthManager;

  constructor(authManager?: AuthManager) {
    super();
    this.authManager = authManager;
  }

  /**
   * 执行API调用（简化版本，不包含重试逻辑）
   * 重试逻辑由acfunlive-http-api的retryCount配置处理
   */
  async executeApiCall<T>(
    key: string,
    operation: () => Promise<T>,
    options?: ApiCallOptions
  ): Promise<T> {
    const startTime = Date.now();
    
    // 初始化统计信息
    this.initializeStats(key);
    
    try {
      // 检查认证状态（如果需要）
      if (options?.requireAuth && this.authManager) {
        await this.ensureAuthenticated(key);
      }
      
      const result = await operation();
      
      // 记录成功调用
      this.updateStats(key, 'success');
      const duration = Date.now() - startTime;
      this.emit('api-call', { key, success: true, duration });
      
      return result;
    } catch (error: any) {
      // 记录失败调用
      this.updateStats(key, 'failure');
      const duration = Date.now() - startTime;
      this.emit('api-call', { key, success: false, duration });
      
      // 处理认证错误
      if (this.isAuthError(error) && this.authManager) {
        await this.handleAuthError(key, error);
      }
      
      throw error;
    }
  }

  /**
   * 确保认证状态有效
   */
  private async ensureAuthenticated(key: string): Promise<void> {
    if (!this.authManager?.isAuthenticated()) {
      throw new Error('Authentication required but not authenticated');
    }
  }

  /**
   * 处理认证错误
   */
  private async handleAuthError(key: string, error: Error): Promise<void> {
    try {
      console.log(`[ApiRetryManager] 检测到认证错误，尝试刷新token: ${key}`);
      
      const refreshResult = await this.authManager!.refreshToken();
      
      if (refreshResult.success && refreshResult.qrCode) {
        // 由于acfunlive-http-api不支持自动刷新，需要用户重新扫码
        this.emit('auth-refresh-failed', { 
          key, 
          error: 'Token expired. Please scan the new QR code to re-authenticate.' 
        });
      } else {
        this.emit('auth-refresh-failed', { 
          key, 
          error: refreshResult.message || 'Failed to refresh authentication token' 
        });
      }
      
      this.updateStats(key, 'auth-refresh');
    } catch (authError) {
      console.error(`[ApiRetryManager] 认证刷新失败: ${authError}`);
      this.emit('auth-refresh-failed', { 
        key, 
        error: `Authentication refresh failed: ${authError instanceof Error ? authError.message : String(authError)}` 
      });
    }
  }

  /**
   * 判断是否为认证错误
   */
  private isAuthError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('auth') || 
           errorMessage.includes('token') || 
           errorMessage.includes('unauthorized') ||
           errorMessage.includes('401');
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: Error): ApiErrorType {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return ApiErrorType.NETWORK_ERROR;
    }
    if (errorMessage.includes('timeout')) {
      return ApiErrorType.TIMEOUT_ERROR;
    }
    if (errorMessage.includes('auth') || errorMessage.includes('token') || errorMessage.includes('401')) {
      return ApiErrorType.AUTH_ERROR;
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return ApiErrorType.RATE_LIMIT_ERROR;
    }
    if (errorMessage.includes('server') || errorMessage.includes('5')) {
      return ApiErrorType.SERVER_ERROR;
    }
    if (errorMessage.includes('client') || errorMessage.includes('4')) {
      return ApiErrorType.CLIENT_ERROR;
    }
    
    return ApiErrorType.UNKNOWN_ERROR;
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(key: string): void {
    if (!this.callStats.has(key)) {
      this.callStats.set(key, {
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        authRefreshCount: 0
      });
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(key: string, type: 'success' | 'failure' | 'auth-refresh'): void {
    const stats = this.callStats.get(key);
    if (!stats) return;

    stats.totalCalls++;
    stats.lastCallTime = Date.now();

    switch (type) {
      case 'success':
        stats.successCount++;
        break;
      case 'failure':
        stats.failureCount++;
        break;
      case 'auth-refresh':
        stats.authRefreshCount++;
        break;
    }
  }

  /**
   * 获取调用统计信息
   */
  getCallStats(key: string): ApiCallStats | undefined {
    return this.callStats.get(key);
  }

  /**
   * 获取所有统计信息
   */
  getAllStats(): Map<string, ApiCallStats> {
    return new Map(this.callStats);
  }

  /**
   * 清理所有统计信息
   */
  clearAll(): void {
    this.callStats.clear();
  }

  /**
   * 设置认证管理器
   */
  setAuthManager(authManager: AuthManager): void {
    this.authManager = authManager;
  }

  /**
   * 获取认证管理器
   */
  getAuthManager(): AuthManager | undefined {
    return this.authManager;
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return this.authManager?.isAuthenticated() ?? false;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.clearAll();
    this.removeAllListeners();
  }
}

// 单例实例
export const apiRetryManager = new ApiRetryManager();