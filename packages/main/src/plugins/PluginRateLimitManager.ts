import { EventEmitter } from 'events';

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  burstLimit: number; // 突发请求限制
  cooldownPeriod: number; // 冷却期（毫秒）
}

export interface RateLimitStatus {
  requestsInLastMinute: number;
  requestsInLastHour: number;
  requestsInLastDay: number;
  burstRequestsUsed: number;
  isLimited: boolean;
  nextAvailableTime?: number;
  quotaResetTime: {
    minute: number;
    hour: number;
    day: number;
  };
}

export interface RateLimitEvents {
  'rateLimitExceeded': (data: { type: 'minute' | 'hour' | 'day' | 'burst'; resetTime: number }) => void;
  'quotaWarning': (data: { type: 'minute' | 'hour' | 'day'; usage: number; limit: number }) => void;
  'quotaReset': (data: { type: 'minute' | 'hour' | 'day' }) => void;
}

/**
 * 速率限制管理器
 * 负责管理 API 调用的速率限制和配额
 */
export class RateLimitManager extends EventEmitter {
  private config: RateLimitConfig;
  private requestHistory: number[] = [];
  private burstRequestsUsed: number = 0;
  private lastBurstReset: number = Date.now();
  private isInCooldown: boolean = false;
  private cooldownEndTime: number = 0;

  constructor(config?: Partial<RateLimitConfig>) {
    super();
    
    // 默认配置 - 基于 AcFun API 的合理限制
    this.config = {
      maxRequestsPerMinute: 30,
      maxRequestsPerHour: 1000,
      maxRequestsPerDay: 10000,
      burstLimit: 10,
      cooldownPeriod: 60000, // 1分钟冷却期
      ...config
    };

    // 启动清理定时器
    this.startCleanupTimer();
  }

  /**
   * 检查是否可以发起请求
   */
  async canMakeRequest(): Promise<{ allowed: boolean; reason?: string; waitTime?: number }> {
    const now = Date.now();

    // 检查冷却期
    if (this.isInCooldown && now < this.cooldownEndTime) {
      return {
        allowed: false,
        reason: 'In cooldown period',
        waitTime: this.cooldownEndTime - now
      };
    } else if (this.isInCooldown && now >= this.cooldownEndTime) {
      this.isInCooldown = false;
      this.cooldownEndTime = 0;
    }

    // 清理过期的请求记录
    this.cleanupExpiredRequests();

    const status = this.getStatus();

    // 检查各种限制
    if (status.requestsInLastMinute >= this.config.maxRequestsPerMinute) {
      this.emit('rateLimitExceeded', { 
        type: 'minute', 
        resetTime: status.quotaResetTime.minute 
      });
      return {
        allowed: false,
        reason: 'Minute rate limit exceeded',
        waitTime: status.quotaResetTime.minute - now
      };
    }

    if (status.requestsInLastHour >= this.config.maxRequestsPerHour) {
      this.emit('rateLimitExceeded', { 
        type: 'hour', 
        resetTime: status.quotaResetTime.hour 
      });
      return {
        allowed: false,
        reason: 'Hour rate limit exceeded',
        waitTime: status.quotaResetTime.hour - now
      };
    }

    if (status.requestsInLastDay >= this.config.maxRequestsPerDay) {
      this.emit('rateLimitExceeded', { 
        type: 'day', 
        resetTime: status.quotaResetTime.day 
      });
      return {
        allowed: false,
        reason: 'Daily rate limit exceeded',
        waitTime: status.quotaResetTime.day - now
      };
    }

    // 检查突发限制
    if (this.burstRequestsUsed >= this.config.burstLimit) {
      this.emit('rateLimitExceeded', { 
        type: 'burst', 
        resetTime: this.lastBurstReset + 60000 
      });
      return {
        allowed: false,
        reason: 'Burst limit exceeded',
        waitTime: (this.lastBurstReset + 60000) - now
      };
    }

    // 发出配额警告
    this.checkQuotaWarnings(status);

    return { allowed: true };
  }

  /**
   * 记录一次 API 请求
   */
  recordRequest(): void {
    const now = Date.now();
    this.requestHistory.push(now);
    
    // 更新突发请求计数
    if (now - this.lastBurstReset > 60000) {
      this.burstRequestsUsed = 1;
      this.lastBurstReset = now;
    } else {
      this.burstRequestsUsed++;
    }
  }

  /**
   * 记录 API 错误并可能触发冷却期
   */
  recordError(statusCode?: number): void {
    // 如果是 429 (Too Many Requests) 或 503 (Service Unavailable)，启动冷却期
    if (statusCode === 429 || statusCode === 503) {
      this.startCooldown();
    }
  }

  /**
   * 获取当前速率限制状态
   */
  getStatus(): RateLimitStatus {
    const now = Date.now();
    this.cleanupExpiredRequests();

    const requestsInLastMinute = this.requestHistory.filter(time => now - time < 60000).length;
    const requestsInLastHour = this.requestHistory.filter(time => now - time < 3600000).length;
    const requestsInLastDay = this.requestHistory.filter(time => now - time < 86400000).length;

    // 计算配额重置时间
    const nextMinute = Math.ceil(now / 60000) * 60000;
    const nextHour = Math.ceil(now / 3600000) * 3600000;
    const nextDay = Math.ceil(now / 86400000) * 86400000;

    return {
      requestsInLastMinute,
      requestsInLastHour,
      requestsInLastDay,
      burstRequestsUsed: this.burstRequestsUsed,
      isLimited: this.isInCooldown || 
                requestsInLastMinute >= this.config.maxRequestsPerMinute ||
                requestsInLastHour >= this.config.maxRequestsPerHour ||
                requestsInLastDay >= this.config.maxRequestsPerDay ||
                this.burstRequestsUsed >= this.config.burstLimit,
      nextAvailableTime: this.isInCooldown ? this.cooldownEndTime : undefined,
      quotaResetTime: {
        minute: nextMinute,
        hour: nextHour,
        day: nextDay
      }
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 重置所有计数器
   */
  reset(): void {
    this.requestHistory = [];
    this.burstRequestsUsed = 0;
    this.lastBurstReset = Date.now();
    this.isInCooldown = false;
    this.cooldownEndTime = 0;
  }

  /**
   * 启动冷却期
   */
  private startCooldown(): void {
    this.isInCooldown = true;
    this.cooldownEndTime = Date.now() + this.config.cooldownPeriod;
    console.warn(`[RateLimitManager] Cooldown period started, will end at ${new Date(this.cooldownEndTime).toISOString()}`);
  }

  /**
   * 清理过期的请求记录
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();
    const oneDayAgo = now - 86400000; // 24小时前
    
    // 只保留最近24小时的记录
    this.requestHistory = this.requestHistory.filter(time => time > oneDayAgo);
  }

  /**
   * 检查并发出配额警告
   */
  private checkQuotaWarnings(status: RateLimitStatus): void {
    const warningThreshold = 0.8; // 80% 使用率时发出警告

    if (status.requestsInLastMinute >= this.config.maxRequestsPerMinute * warningThreshold) {
      this.emit('quotaWarning', {
        type: 'minute',
        usage: status.requestsInLastMinute,
        limit: this.config.maxRequestsPerMinute
      });
    }

    if (status.requestsInLastHour >= this.config.maxRequestsPerHour * warningThreshold) {
      this.emit('quotaWarning', {
        type: 'hour',
        usage: status.requestsInLastHour,
        limit: this.config.maxRequestsPerHour
      });
    }

    if (status.requestsInLastDay >= this.config.maxRequestsPerDay * warningThreshold) {
      this.emit('quotaWarning', {
        type: 'day',
        usage: status.requestsInLastDay,
        limit: this.config.maxRequestsPerDay
      });
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    // 每5分钟清理一次过期记录
    setInterval(() => {
      this.cleanupExpiredRequests();
      
      // 重置突发请求计数（如果超过1分钟）
      const now = Date.now();
      if (now - this.lastBurstReset > 60000) {
        this.burstRequestsUsed = 0;
        this.lastBurstReset = now;
      }
    }, 5 * 60 * 1000);
  }
}

// 创建全局实例
export const rateLimitManager = new RateLimitManager();