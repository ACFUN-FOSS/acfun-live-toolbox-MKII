import { EventEmitter } from 'events';
import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { AppModule } from '../core/AppModule';
import { ModuleContext } from '../core/ModuleContext';

/**
 * 错误类型定义
 */
type ErrorType = 'network' | 'authentication' | 'validation' | 'runtime' | 'unknown';

/**
 * 错误信息接口
 */
interface ErrorInfo {
  type: ErrorType;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * 错误处理模块
 * 负责全局错误捕获、错误展示和用户反馈
 */
export class ErrorHandlingModule extends EventEmitter implements AppModule {
  private mainWindow: BrowserWindow | null = null;
  private errorHistory: ErrorInfo[] = [];
  private maxHistorySize = 50;
  private isEnabled = false;

  constructor() {
    super();
  }

  /**
   * 启用错误处理模块
   */
  async enable(context: ModuleContext): Promise<void> {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.mainWindow = context.mainWindow;
    if (!this.mainWindow) {
      throw new Error('主窗口未初始化，无法启用错误处理模块');
    }
    this.setupGlobalErrorHandlers();
    this.setupIpcListeners();
  }

  /**
   * 禁用错误处理模块
   */
  async disable(): Promise<void> {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    this.removeAllListeners();
    ipcMain.removeHandler('get-error-history');
    ipcMain.removeHandler('clear-error-history');
    // 移除全局错误监听器
    process.removeListener('unhandledRejection', this.handleUnhandledRejection.bind(this));
    process.removeListener('uncaughtException', this.handleUncaughtException.bind(this));
    this.errorHistory = [];
  }

  /**
   * 设置IPC监听器
   */
  private setupIpcListeners(): void {
    ipcMain.handle('get-error-history', () => this.getErrorHistory());
    ipcMain.handle('clear-error-history', () => this.clearErrorHistory());
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers(): void {
    // 捕获未处理的Promise拒绝
    process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));

    // 捕获未捕获的异常
    process.on('uncaughtException', this.handleUncaughtException.bind(this));
  }

  /**
   * 处理未处理的Promise拒绝
   */
  private handleUnhandledRejection(reason: unknown): void {
    this.handleError({
      type: 'runtime',
      code: 'UNHANDLED_REJECTION',
      message: reason instanceof Error ? reason.message : String(reason),
      details: { reason }
    });
  }

  /**
   * 处理未捕获的异常
   */
  private handleUncaughtException(error: Error): void {
    this.handleError({
      type: 'runtime',
      code: 'UNCAUGHT_EXCEPTION',
      message: error.message,
      details: { stack: error.stack }
    });
  }

  /**
   * 处理错误
   */
  handleError(error: Omit<ErrorInfo, 'timestamp'>): ErrorInfo {
    const errorInfo: ErrorInfo = {
      ...error,
      timestamp: new Date()
    };

    // 添加到错误历史
    this.errorHistory.unshift(errorInfo);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.pop();
    }

    // 触发错误事件
    this.emit('error', errorInfo);

    // 显示错误通知
    this.sendErrorToRenderer(errorInfo);

    return errorInfo;
  }

  /**
   * 发送错误信息到渲染进程
   */
  private sendErrorToRenderer(errorInfo: ErrorInfo): void {
    if (this.mainWindow?.isDestroyed()) return;
    this.mainWindow?.webContents.send('error-occurred', errorInfo);
  }

  /**
   * 获取错误历史
   */
  getErrorHistory(): ErrorInfo[] {
    return [...this.errorHistory];
  }

  /**
   * 清除错误历史
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }
}

export default new ErrorHandlingModule();