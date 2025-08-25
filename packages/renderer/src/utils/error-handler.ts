// src/utils/error-handler.ts
import { TMessage } from 'tdesign-vue-next';

/**
 * 错误类型枚举
 */
enum ErrorType {
  /** 网络错误 */
  NETWORK = 'NETWORK',
  /** API错误 */
  API = 'API',
  /** 权限错误 */
  PERMISSION = 'PERMISSION',
  /** 资源不存在错误 */
  NOT_FOUND = 'NOT_FOUND',
  /** 业务逻辑错误 */
  BUSINESS = 'BUSINESS',
  /** 未知错误 */
  UNKNOWN = 'UNKNOWN'
}

/**
 * 错误日志级别枚举
 */
enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * 自定义错误类
 */
class AppError extends Error {
  public type: ErrorType;
  public code: string;
  public details?: any;
  public logLevel: LogLevel;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    code: string = 'UNKNOWN_ERROR',
    details?: any,
    logLevel: LogLevel = LogLevel.ERROR
  ) {
    super(message);
    this.type = type;
    this.code = code;
    this.details = details;
    this.logLevel = logLevel;
    this.name = 'AppError';

    // 确保原型链正确设置
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 错误处理服务
 */
class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 初始化错误处理
   */
  public init(): void {
    // 捕获全局未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        new AppError(
          'Unhandled Promise Rejection',
          ErrorType.UNKNOWN,
          'UNHANDLED_REJECTION',
          event.reason
        )
      );
      event.preventDefault();
    });

    // 捕获全局错误
    window.addEventListener('error', (event) => {
      this.handleError(
        new AppError(
          event.message || 'Global Error',
          ErrorType.UNKNOWN,
          'GLOBAL_ERROR',
          {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
          },
          LogLevel.CRITICAL
        )
      );
      // 不阻止默认行为，以便浏览器控制台仍然显示错误
    });
  }

  /**
   * 处理错误
   * @param error 错误对象
   */
  public handleError(error: Error | AppError): void {
    let appError: AppError;

    // 转换为AppError
    if (error instanceof AppError) {
      appError = error;
    } else {
      appError = new AppError(
        error.message || 'Unknown Error',
        ErrorType.UNKNOWN,
        'UNKNOWN_ERROR',
        error
      );
    }

    // 记录错误日志
    this.logError(appError);

    // 显示用户友好的错误信息
    this.showErrorNotification(appError);
  }

  /**
   * 记录错误日志
   * @param error 错误对象
   */
  private logError(error: AppError): void {
    // 在开发环境下打印详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.group(`[${error.logLevel}] ${error.type} Error: ${error.code}`);
      console.error('Message:', error.message);
      console.error('Type:', error.type);
      console.error('Code:', error.code);
      if (error.details) {
        console.error('Details:', error.details);
      }
      console.error('Stack:', error.stack);
      console.groupEnd();
    } else {
      // 在生产环境下，将错误发送到日志服务
      // 这里只是模拟，实际项目中应该替换为真实的日志服务
      console.error(`[${error.logLevel}] ${error.type} Error: ${error.code} - ${error.message}`);
      // 可以添加API调用，将错误发送到服务器
    }
  }

  /**
   * 显示错误通知
   * @param error 错误对象
   */
  private showErrorNotification(error: AppError): void {
    // 根据错误类型显示不同的提示
    switch (error.type) {
      case ErrorType.NETWORK:
        TMessage.error({
          content: `网络错误: ${error.message}`,
          duration: 5000
        });
        break;
      case ErrorType.API:
        TMessage.error({
          content: `API错误: ${error.message}`,
          duration: 5000
        });
        break;
      case ErrorType.PERMISSION:
        TMessage.warning({
          content: `权限不足: ${error.message}`,
          duration: 5000
        });
        break;
      case ErrorType.NOT_FOUND:
        TMessage.warning({
          content: `资源不存在: ${error.message}`,
          duration: 5000
        });
        break;
      case ErrorType.BUSINESS:
        TMessage.error({
          content: `业务错误: ${error.message}`,
          duration: 5000
        });
        break;
      default:
        TMessage.error({
          content: `系统错误: ${error.message || '未知错误，请重试'}`,
          duration: 5000
        });
        break;
    }
  }

  /**
   * 创建网络错误
   * @param message 错误消息
   * @param code 错误代码
   * @param details 错误详情
   */
  public createNetworkError(message: string, code: string = 'NETWORK_ERROR', details?: any): AppError {
    return new AppError(message, ErrorType.NETWORK, code, details);
  }

  /**
   * 创建API错误
   * @param message 错误消息
   * @param code 错误代码
   * @param details 错误详情
   */
  public createApiError(message: string, code: string = 'API_ERROR', details?: any): AppError {
    return new AppError(message, ErrorType.API, code, details);
  }

  /**
   * 创建权限错误
   * @param message 错误消息
   * @param code 错误代码
   * @param details 错误详情
   */
  public createPermissionError(message: string, code: string = 'PERMISSION_ERROR', details?: any): AppError {
    return new AppError(message, ErrorType.PERMISSION, code, details);
  }

  /**
   * 创建资源不存在错误
   * @param message 错误消息
   * @param code 错误代码
   * @param details 错误详情
   */
  public createNotFoundError(message: string, code: string = 'NOT_FOUND_ERROR', details?: any): AppError {
    return new AppError(message, ErrorType.NOT_FOUND, code, details);
  }

  /**
   * 创建业务逻辑错误
   * @param message 错误消息
   * @param code 错误代码
   * @param details 错误详情
   */
  public createBusinessError(message: string, code: string = 'BUSINESS_ERROR', details?: any): AppError {
    return new AppError(message, ErrorType.BUSINESS, code, details);
  }
}

// 导出单例实例
const errorHandler = ErrorHandler.getInstance();

export { errorHandler, ErrorType, LogLevel, AppError };

export default errorHandler;