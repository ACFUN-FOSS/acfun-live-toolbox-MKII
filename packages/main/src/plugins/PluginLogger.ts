import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  pluginId?: string;
  message: string;
  error?: Error;
  context?: Record<string, any>;
}

/**
 * 插件日志管理器
 * 负责记录插件相关的操作日志和错误信息
 */
export class PluginLogger {
  private logDir: string;
  private logFile: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private maxLogFiles: number = 5;

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logDir, 'plugins.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 记录调试信息
   */
  debug(message: string, pluginId?: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, pluginId, undefined, context);
  }

  /**
   * 记录一般信息
   */
  info(message: string, pluginId?: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, pluginId, undefined, context);
  }

  /**
   * 记录警告信息
   */
  warn(message: string, pluginId?: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, pluginId, undefined, context);
  }

  /**
   * 记录错误信息
   */
  error(message: string, pluginId?: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, pluginId, error, context);
  }

  /**
   * 记录日志条目
   */
  private log(level: LogLevel, message: string, pluginId?: string, error?: Error, context?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      pluginId,
      message,
      error,
      context
    };

    const logLine = this.formatLogEntry(entry);
    
    try {
      // 检查日志文件大小，必要时轮转
      this.rotateLogIfNeeded();
      
      // 写入日志
      fs.appendFileSync(this.logFile, logLine + '\n', 'utf-8');
    } catch (writeError) {
      console.error('Failed to write plugin log:', writeError);
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level];
    const pluginId = entry.pluginId ? `[${entry.pluginId}]` : '';
    
    let logLine = `${timestamp} ${level} ${pluginId} ${entry.message}`;
    
    if (entry.error) {
      logLine += `\nError: ${entry.error.message}`;
      if (entry.error.stack) {
        logLine += `\nStack: ${entry.error.stack}`;
      }
    }
    
    if (entry.context) {
      logLine += `\nContext: ${JSON.stringify(entry.context, null, 2)}`;
    }
    
    return logLine;
  }

  /**
   * 轮转日志文件
   */
  private rotateLogIfNeeded(): void {
    if (!fs.existsSync(this.logFile)) {
      return;
    }

    const stats = fs.statSync(this.logFile);
    if (stats.size < this.maxLogSize) {
      return;
    }

    try {
      // 移动现有日志文件
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = `${this.logFile}.${i}`;
        const newFile = `${this.logFile}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile); // 删除最老的日志文件
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // 重命名当前日志文件
      fs.renameSync(this.logFile, `${this.logFile}.1`);
    } catch (error) {
      console.error('Failed to rotate plugin log:', error);
    }
  }

  /**
   * 获取最近的日志条目
   */
  getRecentLogs(pluginId?: string, limit: number = 100): LogEntry[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const entries: LogEntry[] = [];
      
      for (const line of lines.slice(-limit * 2)) { // 读取更多行以防格式化问题
        try {
          const entry = this.parseLogLine(line);
          if (entry && (!pluginId || entry.pluginId === pluginId)) {
            entries.push(entry);
          }
        } catch (parseError) {
          // 忽略解析错误的行
        }
      }

      return entries.slice(-limit);
    } catch (error) {
      console.error('Failed to read plugin logs:', error);
      return [];
    }
  }

  /**
   * 解析日志行
   */
  private parseLogLine(line: string): LogEntry | null {
    // 简单的日志行解析，实际实现可能需要更复杂的逻辑
    const match = line.match(/^(\S+)\s+(\w+)\s+(?:\[([^\]]+)\])?\s+(.+)$/);
    if (!match) {
      return null;
    }

    const [, timestamp, levelStr, pluginId, message] = match;
    const level = LogLevel[levelStr as keyof typeof LogLevel];
    
    if (level === undefined) {
      return null;
    }

    return {
      timestamp: new Date(timestamp).getTime(),
      level,
      pluginId: pluginId || undefined,
      message
    };
  }

  /**
   * 清理旧日志
   */
  cleanup(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files.filter(file => file.startsWith('plugins.log'));
      
      // 保留最新的几个日志文件
      if (logFiles.length > this.maxLogFiles) {
        const sortedFiles = logFiles
          .map(file => ({
            name: file,
            path: path.join(this.logDir, file),
            mtime: fs.statSync(path.join(this.logDir, file)).mtime
          }))
          .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        // 删除多余的日志文件
        for (let i = this.maxLogFiles; i < sortedFiles.length; i++) {
          fs.unlinkSync(sortedFiles[i].path);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup plugin logs:', error);
    }
  }
}

// 单例实例
export const pluginLogger = new PluginLogger();