import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { format } from 'util';

// 确保日志目录存在
const logDir = join(app.getPath('userData'), 'logs');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

// 创建日志写入流并添加错误处理
const createLogStream = (filename: string) => {
  const stream = createWriteStream(join(logDir, filename), { flags: 'a' });
  stream.on('error', (err) => {
    console.error('日志流错误:', err);
  });
  return stream;
};

// 创建日志写入流
const errorLogStream = createLogStream('error.log');
const combinedLogStream = createLogStream('combined.log');

// 在应用退出时关闭日志流
app.on('will-quit', () => {
  errorLogStream.end();
  combinedLogStream.end();
});

/**
 * 安全序列化元数据
 */
const safeStringify = (data: unknown): string => {
  try {
    return JSON.stringify(data);
  } catch (e) {
    return format('%o', data); // 使用util.format作为后备
  }
};

/**
 * 日志工具类
 */
export const logger = {
  /**
   * 普通信息日志
   */
  info: (message: string, ...meta: unknown[]): void => {
    const logMessage = `[${new Date().toISOString()}] [INFO] ${message} ${meta.length ? safeStringify(meta) : ''}\n`;
    console.log(logMessage);
    combinedLogStream.write(logMessage);
  },

  /**
   * 错误日志
   */
  error: (message: string, ...meta: unknown[]): void => {
    const logMessage = `[${new Date().toISOString()}] [ERROR] ${message} ${meta.length ? safeStringify(meta) : ''}\n`;
    console.error(logMessage);
    errorLogStream.write(logMessage);
    combinedLogStream.write(logMessage);
  },

  /**
   * 警告日志
   */
  warn: (message: string, ...meta: unknown[]): void => {
    const logMessage = `[${new Date().toISOString()}] [WARN] ${message} ${meta.length ? safeStringify(meta) : ''}\n`;
    console.warn(logMessage);
    combinedLogStream.write(logMessage);
  },

  /**
   * 调试日志
   */
  debug: (message: string, ...meta: unknown[]): void => {
    const logMessage = `[${new Date().toISOString()}] [DEBUG] ${message} ${meta.length ? safeStringify(meta) : ''}\n`;
    if (process.env.NODE_ENV === 'development') {
      console.debug(logMessage);
      combinedLogStream.write(logMessage);
    }
  }
};

export default logger;