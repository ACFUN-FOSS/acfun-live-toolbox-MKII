import { EventEmitter } from 'events';
import { pluginLogger } from './PluginLogger';

export enum ErrorType {
  LOAD_FAILED = 'load_failed',
  INSTALL_FAILED = 'install_failed',
  UNINSTALL_FAILED = 'uninstall_failed',
  ENABLE_FAILED = 'enable_failed',
  DISABLE_FAILED = 'disable_failed',
  RUNTIME_ERROR = 'runtime_error',
  DEPENDENCY_ERROR = 'dependency_error',
  MANIFEST_ERROR = 'manifest_error',
  PERMISSION_ERROR = 'permission_error',
  NETWORK_ERROR = 'network_error'
}

export enum RecoveryAction {
  RETRY = 'retry',
  DISABLE = 'disable',
  UNINSTALL = 'uninstall',
  IGNORE = 'ignore',
  REINSTALL = 'reinstall'
}

export interface PluginError {
  pluginId: string;
  type: ErrorType;
  message: string;
  error: Error;
  timestamp: number;
  context?: Record<string, any>;
  recoveryActions?: RecoveryAction[];
}

export interface RecoveryStrategy {
  errorType: ErrorType;
  maxRetries: number;
  retryDelay: number;
  autoRecovery: boolean;
  fallbackAction: RecoveryAction;
}

/**
 * 插件错误处理和恢复机制管理器
 */
export class PluginErrorHandler extends EventEmitter {
  private errorHistory: Map<string, PluginError[]> = new Map();
  private retryCount: Map<string, number> = new Map();
  private recoveryStrategies: Map<ErrorType, RecoveryStrategy> = new Map();

  constructor() {
    super();
    this.initializeRecoveryStrategies();
  }

  /**
   * 初始化恢复策略
   */
  private initializeRecoveryStrategies(): void {
    const strategies: Array<[ErrorType, RecoveryStrategy]> = [
      [ErrorType.LOAD_FAILED, {
        errorType: ErrorType.LOAD_FAILED,
        maxRetries: 3,
        retryDelay: 1000,
        autoRecovery: true,
        fallbackAction: RecoveryAction.DISABLE
      }],
      [ErrorType.INSTALL_FAILED, {
        errorType: ErrorType.INSTALL_FAILED,
        maxRetries: 2,
        retryDelay: 2000,
        autoRecovery: false,
        fallbackAction: RecoveryAction.IGNORE
      }],
      [ErrorType.RUNTIME_ERROR, {
        errorType: ErrorType.RUNTIME_ERROR,
        maxRetries: 1,
        retryDelay: 500,
        autoRecovery: true,
        fallbackAction: RecoveryAction.DISABLE
      }],
      [ErrorType.DEPENDENCY_ERROR, {
        errorType: ErrorType.DEPENDENCY_ERROR,
        maxRetries: 0,
        retryDelay: 0,
        autoRecovery: false,
        fallbackAction: RecoveryAction.DISABLE
      }],
      [ErrorType.MANIFEST_ERROR, {
        errorType: ErrorType.MANIFEST_ERROR,
        maxRetries: 0,
        retryDelay: 0,
        autoRecovery: false,
        fallbackAction: RecoveryAction.UNINSTALL
      }],
      [ErrorType.PERMISSION_ERROR, {
        errorType: ErrorType.PERMISSION_ERROR,
        maxRetries: 1,
        retryDelay: 1000,
        autoRecovery: false,
        fallbackAction: RecoveryAction.DISABLE
      }],
      [ErrorType.NETWORK_ERROR, {
        errorType: ErrorType.NETWORK_ERROR,
        maxRetries: 3,
        retryDelay: 5000,
        autoRecovery: true,
        fallbackAction: RecoveryAction.IGNORE
      }]
    ];

    for (const [errorType, strategy] of strategies) {
      this.recoveryStrategies.set(errorType, strategy);
    }
  }

  /**
   * 处理插件错误
   */
  async handleError(
    pluginId: string,
    errorType: ErrorType,
    message: string,
    error: Error,
    context?: Record<string, any>
  ): Promise<RecoveryAction> {
    const pluginError: PluginError = {
      pluginId,
      type: errorType,
      message,
      error,
      timestamp: Date.now(),
      context,
      recoveryActions: this.getAvailableRecoveryActions(errorType)
    };

    // 记录错误
    this.recordError(pluginError);
    
    // 记录日志
    pluginLogger.error(
      `Plugin error: ${message}`,
      pluginId,
      error,
      { errorType, context }
    );

    // 发出错误事件
    this.emit('error', pluginError);

    // 尝试自动恢复
    const recoveryAction = await this.attemptRecovery(pluginError);
    
    return recoveryAction;
  }

  /**
   * 记录错误
   */
  private recordError(pluginError: PluginError): void {
    if (!this.errorHistory.has(pluginError.pluginId)) {
      this.errorHistory.set(pluginError.pluginId, []);
    }
    
    const errors = this.errorHistory.get(pluginError.pluginId)!;
    errors.push(pluginError);
    
    // 保留最近的50个错误
    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }
  }

  /**
   * 尝试自动恢复
   */
  private async attemptRecovery(pluginError: PluginError): Promise<RecoveryAction> {
    const strategy = this.recoveryStrategies.get(pluginError.type);
    if (!strategy) {
      pluginLogger.warn(`No recovery strategy for error type: ${pluginError.type}`, pluginError.pluginId);
      return RecoveryAction.IGNORE;
    }

    const retryKey = `${pluginError.pluginId}:${pluginError.type}`;
    const currentRetries = this.retryCount.get(retryKey) || 0;

    // 检查是否可以重试
    if (strategy.autoRecovery && currentRetries < strategy.maxRetries) {
      this.retryCount.set(retryKey, currentRetries + 1);
      
      pluginLogger.info(
        `Attempting auto-recovery for plugin (attempt ${currentRetries + 1}/${strategy.maxRetries})`,
        pluginError.pluginId,
        { errorType: pluginError.type, strategy: 'retry' }
      );

      // 延迟后重试
      if (strategy.retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, strategy.retryDelay));
      }

      this.emit('recovery-attempt', {
        pluginId: pluginError.pluginId,
        action: RecoveryAction.RETRY,
        attempt: currentRetries + 1,
        maxAttempts: strategy.maxRetries
      });

      return RecoveryAction.RETRY;
    }

    // 重试次数已用完或不支持自动恢复，执行回退操作
    pluginLogger.warn(
      `Auto-recovery failed or not available, executing fallback action: ${strategy.fallbackAction}`,
      pluginError.pluginId,
      { errorType: pluginError.type, retries: currentRetries }
    );

    this.emit('recovery-fallback', {
      pluginId: pluginError.pluginId,
      action: strategy.fallbackAction,
      reason: currentRetries >= strategy.maxRetries ? 'max_retries_exceeded' : 'auto_recovery_disabled'
    });

    return strategy.fallbackAction;
  }

  /**
   * 获取可用的恢复操作
   */
  private getAvailableRecoveryActions(errorType: ErrorType): RecoveryAction[] {
    const baseActions = [RecoveryAction.IGNORE];
    
    switch (errorType) {
      case ErrorType.LOAD_FAILED:
      case ErrorType.RUNTIME_ERROR:
        return [...baseActions, RecoveryAction.RETRY, RecoveryAction.DISABLE, RecoveryAction.REINSTALL];
      
      case ErrorType.INSTALL_FAILED:
        return [...baseActions, RecoveryAction.RETRY];
      
      case ErrorType.DEPENDENCY_ERROR:
        return [...baseActions, RecoveryAction.DISABLE, RecoveryAction.UNINSTALL];
      
      case ErrorType.MANIFEST_ERROR:
        return [...baseActions, RecoveryAction.UNINSTALL];
      
      case ErrorType.PERMISSION_ERROR:
        return [...baseActions, RecoveryAction.RETRY, RecoveryAction.DISABLE];
      
      case ErrorType.NETWORK_ERROR:
        return [...baseActions, RecoveryAction.RETRY];
      
      default:
        return baseActions;
    }
  }

  /**
   * 手动执行恢复操作
   */
  async executeRecoveryAction(
    pluginId: string,
    action: RecoveryAction,
    context?: Record<string, any>
  ): Promise<boolean> {
    try {
      pluginLogger.info(
        `Executing manual recovery action: ${action}`,
        pluginId,
        context
      );

      this.emit('recovery-execute', {
        pluginId,
        action,
        manual: true,
        context
      });

      // 这里应该调用相应的插件管理器方法
      // 由于我们需要与PluginManager集成，这里先返回成功
      // 实际实现中需要注入PluginManager的引用
      
      return true;
    } catch (error) {
      pluginLogger.error(
        `Failed to execute recovery action: ${action}`,
        pluginId,
        error as Error,
        context
      );
      return false;
    }
  }

  /**
   * 重置插件的重试计数
   */
  resetRetryCount(pluginId: string, errorType?: ErrorType): void {
    if (errorType) {
      const retryKey = `${pluginId}:${errorType}`;
      this.retryCount.delete(retryKey);
    } else {
      // 重置该插件的所有重试计数
      for (const key of this.retryCount.keys()) {
        if (key.startsWith(`${pluginId}:`)) {
          this.retryCount.delete(key);
        }
      }
    }
    
    pluginLogger.info(
      `Reset retry count for plugin`,
      pluginId,
      { errorType: errorType || 'all' }
    );
  }

  /**
   * 获取插件的错误历史
   */
  getErrorHistory(pluginId: string): PluginError[] {
    return this.errorHistory.get(pluginId) || [];
  }

  /**
   * 获取所有插件的错误统计
   */
  getErrorStats(): Record<string, { total: number; byType: Record<ErrorType, number> }> {
    const stats: Record<string, { total: number; byType: Record<ErrorType, number> }> = {};
    
    for (const [pluginId, errors] of this.errorHistory.entries()) {
      const pluginStats = {
        total: errors.length,
        byType: {} as Record<ErrorType, number>
      };
      
      for (const error of errors) {
        pluginStats.byType[error.type] = (pluginStats.byType[error.type] || 0) + 1;
      }
      
      stats[pluginId] = pluginStats;
    }
    
    return stats;
  }

  /**
   * 清理旧的错误记录
   */
  cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): void { // 默认7天
    const cutoffTime = Date.now() - maxAge;
    
    for (const [pluginId, errors] of this.errorHistory.entries()) {
      const filteredErrors = errors.filter(error => error.timestamp > cutoffTime);
      
      if (filteredErrors.length === 0) {
        this.errorHistory.delete(pluginId);
      } else {
        this.errorHistory.set(pluginId, filteredErrors);
      }
    }
    
    pluginLogger.info('Cleaned up old error records', undefined, { cutoffTime, maxAge });
  }

  /**
   * 更新恢复策略
   */
  updateRecoveryStrategy(errorType: ErrorType, strategy: Partial<RecoveryStrategy>): void {
    const currentStrategy = this.recoveryStrategies.get(errorType);
    if (currentStrategy) {
      this.recoveryStrategies.set(errorType, { ...currentStrategy, ...strategy });
      pluginLogger.info(
        `Updated recovery strategy for error type: ${errorType}`,
        undefined,
        { strategy }
      );
    }
  }
}

// 单例实例
export const pluginErrorHandler = new PluginErrorHandler();