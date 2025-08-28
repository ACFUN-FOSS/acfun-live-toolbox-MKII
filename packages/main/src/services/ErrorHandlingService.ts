import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

interface ErrorInfo {
  message: string;
  stack?: string;
  context?: Record<string, any>;
  timestamp: Date;
}

interface StoredError extends ErrorInfo {
  id: string;
}

/**
 * 错误处理服务，负责应用程序的错误日志记录、查询和管理
 */
export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errorLogPath: string;
  private maxErrorHistory = 1000; // 最大错误历史记录数

  private constructor() {
    // 初始化错误日志文件路径
    const userDataPath = app.getPath('userData');
    this.errorLogPath = path.join(userDataPath, 'error-logs.json');
    this.initializeErrorLogFile();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * 初始化错误日志文件（如果不存在则创建）
   */
  private initializeErrorLogFile(): void {
    if (!fs.existsSync(this.errorLogPath)) {
      fs.writeFileSync(this.errorLogPath, JSON.stringify([]), 'utf8');
    }
  }

  /**
   * 记录错误信息
   * @param errorInfo 错误信息对象
   * @returns 错误ID
   */
  public async logError(errorInfo: Omit<ErrorInfo, 'timestamp'>): Promise<string> {
    try {
      const error: StoredError = {
        id: uuidv4(),
        ...errorInfo,
        timestamp: new Date()
      };

      // 读取现有错误日志
      const errors = await this.getErrorHistory();
      // 添加新错误并限制历史记录数量
      const updatedErrors = [error, ...errors].slice(0, this.maxErrorHistory);

      // 写入更新后的错误日志
      await fs.promises.writeFile(
        this.errorLogPath,
        JSON.stringify(updatedErrors, null, 2),
        'utf8'
      );

      return error.id;
    } catch (error) {
      console.error('Failed to log error:', error);
      throw new Error(`Error logging failed: ${(error as Error).message}`);
    }
  }

  /**
   * 获取错误历史记录
   * @param params 查询参数（可选）
   * @returns 错误历史记录数组
   */
  public async getErrorHistory(params: { limit?: number; startDate?: Date; endDate?: Date } = {}): Promise<StoredError[]> {
    try {
      // 读取错误日志文件
      const data = await fs.promises.readFile(this.errorLogPath, 'utf8');
      let errors: StoredError[] = JSON.parse(data);

      // 解析日期字符串为Date对象
      errors = errors.map(error => ({
        ...error,
        timestamp: new Date(error.timestamp)
      }));

      // 应用日期范围过滤
      if (params.startDate) {
        errors = errors.filter(error => error.timestamp >= params.startDate);
      }
      if (params.endDate) {
        errors = errors.filter(error => error.timestamp <= params.endDate);
      }

      // 应用数量限制
      if (params.limit) {
        errors = errors.slice(0, params.limit);
      }

      return errors;
    } catch (error) {
      console.error('Failed to get error history:', error);
      throw new Error(`Error history retrieval failed: ${(error as Error).message}`);
    }
  }

  /**
   * 清除错误历史记录
   */
  public async clearErrorHistory(): Promise<void> {
    try {
      await fs.promises.writeFile(this.errorLogPath, JSON.stringify([]), 'utf8');
    } catch (error) {
      console.error('Failed to clear error history:', error);
      throw new Error(`Error history clearing failed: ${(error as Error).message}`);
    }
  }

  /**
   * 报告错误（可以扩展为发送到远程服务器）
   * @param errorId 错误ID
   * @returns 报告结果
   */
  public async reportError(errorId: string): Promise<{ success: boolean; reportId?: string }> {
    try {
      const errors = await this.getErrorHistory();
      const errorToReport = errors.find(e => e.id === errorId);

      if (!errorToReport) {
        throw new Error(`Error with ID ${errorId} not found`);
      }

      // 在实际应用中，这里可以实现将错误发送到远程服务器的逻辑
      // 目前仅模拟报告成功
      const reportId = `report-${uuidv4()}`;
      console.log(`Error reported successfully. Report ID: ${reportId}`, errorToReport);

      return { success: true, reportId };
    } catch (error) {
      console.error('Failed to report error:', error);
      throw new Error(`Error reporting failed: ${(error as Error).message}`);
    }
  }
}

/**
 * 错误处理服务单例实例
 */
export const errorHandlingService = ErrorHandlingService.getInstance();