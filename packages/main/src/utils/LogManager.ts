import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

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
  private logFilePath: string;

  constructor() {
    super();
    // 创建日志目录
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    // 设置日志文件路径
    this.logFilePath = path.join(logDir, 'app.log');
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
    fs.appendFile(this.logFilePath, logLine, (err) => {
      if (err) {
        console.error('Failed to write log to file:', err);
      }
    });
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
  clearAllLogs(): void {
    this.logs.clear();
    // 也可以选择清除日志文件
    fs.writeFile(this.logFilePath, '', (err) => {
      if (err) {
        console.error('Failed to clear log file:', err);
      }
    });
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