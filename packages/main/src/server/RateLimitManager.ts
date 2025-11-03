/**
 * 速率限制记录
 */
interface RateLimitRecord {
  requests: number;
  windowStart: number;
  lastRequest: number;
}

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  requests: number;      // 允许的请求数
  windowMs: number;      // 时间窗口（毫秒）
  skipSuccessfulRequests?: boolean;  // 是否跳过成功的请求
  skipFailedRequests?: boolean;      // 是否跳过失败的请求
}

/**
 * 速率限制结果
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * 速率限制管理器
 */
export class RateLimitManager {
  private records: Map<string, RateLimitRecord> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private defaultConfig: RateLimitConfig = {
    requests: 100,
    windowMs: 60 * 1000, // 1分钟
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  };

  constructor() {
    // 定期清理过期记录
    setInterval(() => this.cleanup(), 60 * 1000); // 每分钟清理一次
  }

  /**
   * 设置插件的速率限制配置
   */
  setConfig(pluginId: string, config: RateLimitConfig): void {
    this.configs.set(pluginId, config);
  }

  /**
   * 获取插件的速率限制配置
   */
  getConfig(pluginId: string): RateLimitConfig {
    return this.configs.get(pluginId) || this.defaultConfig;
  }

  /**
   * 检查是否允许请求
   */
  checkLimit(pluginId: string, endpoint?: string): RateLimitResult {
    const key = endpoint ? `${pluginId}:${endpoint}` : pluginId;
    const config = this.getConfig(pluginId);
    const now = Date.now();
    
    let record = this.records.get(key);
    
    if (!record) {
      record = {
        requests: 0,
        windowStart: now,
        lastRequest: now
      };
      this.records.set(key, record);
    }

    // 检查是否需要重置窗口
    if (now - record.windowStart >= config.windowMs) {
      record.requests = 0;
      record.windowStart = now;
    }

    const remaining = Math.max(0, config.requests - record.requests);
    const resetTime = record.windowStart + config.windowMs;

    if (record.requests >= config.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000)
      };
    }

    // 增加请求计数
    record.requests++;
    record.lastRequest = now;

    return {
      allowed: true,
      remaining: remaining - 1,
      resetTime
    };
  }

  /**
   * 记录请求结果（用于跳过成功/失败请求的配置）
   */
  recordRequest(pluginId: string, endpoint: string | undefined, success: boolean): void {
    const config = this.getConfig(pluginId);
    
    // 如果配置了跳过成功请求且请求成功，则减少计数
    if (config.skipSuccessfulRequests && success) {
      this.decrementCount(pluginId, endpoint);
    }
    
    // 如果配置了跳过失败请求且请求失败，则减少计数
    if (config.skipFailedRequests && !success) {
      this.decrementCount(pluginId, endpoint);
    }
  }

  /**
   * 减少请求计数
   */
  private decrementCount(pluginId: string, endpoint?: string): void {
    const key = endpoint ? `${pluginId}:${endpoint}` : pluginId;
    const record = this.records.get(key);
    
    if (record && record.requests > 0) {
      record.requests--;
    }
  }

  /**
   * 获取插件的当前限制状态
   */
  getStatus(pluginId: string): {
    requests: number;
    remaining: number;
    resetTime: number;
    windowMs: number;
  } {
    const config = this.getConfig(pluginId);
    const record = this.records.get(pluginId);
    const now = Date.now();

    if (!record) {
      return {
        requests: 0,
        remaining: config.requests,
        resetTime: now + config.windowMs,
        windowMs: config.windowMs
      };
    }

    // 检查是否需要重置窗口
    if (now - record.windowStart >= config.windowMs) {
      return {
        requests: 0,
        remaining: config.requests,
        resetTime: now + config.windowMs,
        windowMs: config.windowMs
      };
    }

    return {
      requests: record.requests,
      remaining: Math.max(0, config.requests - record.requests),
      resetTime: record.windowStart + config.windowMs,
      windowMs: config.windowMs
    };
  }

  /**
   * 重置插件的速率限制
   */
  reset(pluginId: string, endpoint?: string): void {
    const key = endpoint ? `${pluginId}:${endpoint}` : pluginId;
    this.records.delete(key);
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, record] of this.records.entries()) {
      // 如果记录超过2个窗口时间没有活动，则删除
      if (now - record.lastRequest > this.defaultConfig.windowMs * 2) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.records.delete(key));
  }

  /**
   * 获取所有记录（用于调试）
   */
  getAllRecords(): Map<string, RateLimitRecord> {
    return new Map(this.records);
  }

  /**
   * 设置默认配置
   */
  setDefaultConfig(config: RateLimitConfig): void {
    this.defaultConfig = { ...config };
  }
}

// 导出单例实例
export const rateLimitManager = new RateLimitManager();