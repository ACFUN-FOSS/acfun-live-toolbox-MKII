import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { logger } from '@app/utils/logger';

// 日志级别
export type LogLevel = 'info' | 'debug' | 'error' | 'warn';

// 日志条目接口
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
}

export class LogManager extends EventEmitter {
  private logs: Map<string, LogEntry[]> = new Map();
  private maxLogEntries: number = 1000;
  private maxFileSize: number = 5 * 1024 * 1024; // 5MB
  private logFilePath: string;
  private currentFileSize: number = 0;

  constructor() {
    super();
    // 创建日志目录
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    // 设置日志文件路径
    this.logFilePath = path.join(logDir, 'app.log');
    // 获取当前日志文件大小
    this.getCurrentFileSize();
  }

  // 获取当前日志文件大小
  private getCurrentFileSize(): void {
    try {
      const stats = fs.statSync(this.logFilePath);
      this.currentFileSize = stats.size;
    } catch (error) {
      logger.warn('获取日志文件大小失败，将从0开始计算:', error);
      this.currentFileSize = 0;
    }
  }

  // 添加日志条目
  addLog(source: string, message: string, level: LogLevel = 'info'): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      source,
      message
    };

    // 确保源存在于logs映射中
    if (!this.logs.has(source)) {
      this.logs.set(source, []);
    }

    // 添加日志条目
    const sourceLogs = this.logs.get(source)!;
    sourceLogs.push(entry);

    // 如果超过最大条目数，删除最早的条目
    if (sourceLogs.length > this.maxLogEntries) {
      sourceLogs.shift();
    }

    // 写入文件
    this.writeLogToFile(entry);

    // 触发日志事件
    this.emit('log', entry);
  }

  // 写入日志到文件
  private writeLogToFile(entry: LogEntry): void {
    const logLine = `[${entry.timestamp.toISOString()}] [${entry.level}] [${entry.source}] ${entry.message}\n`;
    const lineSize = Buffer.byteLength(logLine);

    // 如果添加此行将超过最大文件大小，则轮转日志
    if (this.currentFileSize + lineSize > this.maxFileSize) {
      this.rotateLogFile();
    }

    // 使用fs.promises重写为异步/等待模式并添加重试逻辑
    this.appendLogWithRetry(logLine, 3).catch(err => {
      logger.error('Failed to write log to file after retries:', err);
    });
 }

 // 添加日志带重试机制
 private async appendLogWithRetry(logLine: string, retries: number): Promise<void> {
   try {
     await fs.promises.appendFile(this.logFilePath, logLine);
     this.currentFileSize += Buffer.byteLength(logLine);
   } catch (error) {
     if (retries > 0) {
       // 指数退避重试
       await new Promise(resolve => setTimeout(resolve, (4 - retries) * 100));
       return this.appendLogWithRetry(logLine, retries - 1);
     }
     throw error;
   }
 }

 //轮转日志文件
 private async rotateLogFile(): Promise<void> {
   try {
     // 如果日志文件存在，则重命名为带时间戳格式
     if (await fs.promises.access(this.logFilePath).then(() => true).catch(() => false)) {
       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
       const rotatedPath = `${this.logFilePath}.${timestamp}`;
       await fs.promises.rename(this.logFilePath, rotatedPath);
       this.currentFileSize = 0;
       // 可以添加旧日志文件的压缩或清理逻辑
     }
   } catch (error) {
     logger.error('Failed to rotate log file:', error);
   }
 }

  // 获取特定源的日志
  getLogs(source: string, limit: number = 100): LogEntry[] {
    if (!this.logs.has(source)) {
      return [];
    }
    const sourceLogs = this.logs.get(source)!;
    // 返回最新的logs
    return sourceLogs.slice(-limit);
  }

  // 获取所有日志源
  getLogSources(): string[] {
    return Array.from(this.logs.keys());
  }

  // 清除特定源的日志
  clearLogs(source: string): void {
    if (this.logs.has(source)) {
      this.logs.set(source, []);
    }
  }

  // 清除所有日志
  async clearAllLogs(): Promise<void> {
    this.logs.clear();
    // 也可以选择清除日志文件
    try {
      await fs.promises.writeFile(this.logFilePath, '');
      this.currentFileSize = 0;
    } catch (err) {
      logger.error('Failed to clear log file:', err);
    }
  }
}

// 创建单例
let logManagerInstance: LogManager | null = null;

export function getLogManager(): LogManager {
  if (!logManagerInstance) {
    logManagerInstance = new LogManager();
  }
  return logManagerInstance;
}