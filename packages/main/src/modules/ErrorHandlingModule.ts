import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { join } from 'path';

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
export class ErrorHandlingModule extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private errorHistory: ErrorInfo[] = [];
  private maxHistorySize = 50;

  constructor() {
    super();
    this.setupGlobalErrorHandlers();
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers(): void {
    // 捕获未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      this.handleError({
        type: 'runtime',
        code: 'UNHANDLED_REJECTION',
        message: reason instanceof Error ? reason.message : String(reason),
        details: { promise }
      });
    });

    // 捕获未捕获的异常
    process.on('uncaughtException', (error) => {
      this.handleError({
        type: 'runtime',
        code: 'UNCAUGHT_EXCEPTION',
        message: error.message,
        details: { stack: error.stack }
      });
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

    // 显示错误界面
    this.showErrorPage(errorInfo);

    return errorInfo;
  }

  /**
   * 显示错误页面
   */
  private showErrorPage(errorInfo: ErrorInfo): void {
    if (!this.mainWindow) return;

    // 在主窗口中显示错误页面
    this.mainWindow.loadFile(join(__dirname, '../../renderer/error.html'), {
      query: {
        type: errorInfo.type,
        code: errorInfo.code,
        message: encodeURIComponent(errorInfo.message)
      }
    });
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