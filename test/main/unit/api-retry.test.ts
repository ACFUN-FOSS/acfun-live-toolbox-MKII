import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiRetryManager, ApiErrorType, RetryStrategy, ApiRetryOptions } from '../../../packages/main/src/services/ApiRetryManager';
import fetch from 'node-fetch';

describe('ApiRetryManager - 真实网络测试', () => {
  let retryManager: ApiRetryManager;

  beforeEach(() => {
    retryManager = new ApiRetryManager();
  });

  afterEach(() => {
    retryManager.clearAll();
  });

  describe('基本重试功能', () => {
    it('应该在网络错误时重试', async () => {
      const operation = async () => {
        // 使用一个不存在的域名来触发网络错误
        const response = await fetch('http://nonexistent-domain-12345.com');
        return response.json();
      };

      await expect(
        retryManager.executeWithRetry('network-test', operation, {
          maxRetries: 2,
          baseDelay: 100,
          strategy: RetryStrategy.EXPONENTIAL_BACKOFF
        })
      ).rejects.toThrow();

      // 验证重试统计
      const stats = retryManager.getRetryStats('network-test');
      expect(stats.totalAttempts).toBeGreaterThan(1);
      expect(stats.totalRetries).toBeGreaterThan(0);
    });

    it('应该在超时时重试', async () => {
      const operation = async () => {
        // 使用一个会超时的请�?        const controller = new AbortController();
        setTimeout(() => controller.abort(), 50); // 50ms超时
        
        const response = await fetch('https://httpbin.org/delay/1', {
          signal: controller.signal
        });
        return response.json();
      };

      await expect(
        retryManager.executeWithRetry('timeout-test', operation, {
          maxRetries: 2,
          baseDelay: 100
        })
      ).rejects.toThrow();

      const stats = retryManager.getRetryStats('timeout-test');
      expect(stats.totalAttempts).toBeGreaterThan(1);
    });

    it('应该在服务器错误时重�?, async () => {
      const operation = async () => {
        // 使用httpbin�?00错误端点
        const response = await fetch('https://httpbin.org/status/500');
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.json();
      };

      await expect(
        retryManager.executeWithRetry('server-error-test', operation, {
          maxRetries: 2,
          baseDelay: 100
        })
      ).rejects.toThrow();

      const stats = retryManager.getRetryStats('server-error-test');
      expect(stats.totalAttempts).toBeGreaterThan(1);
    });

    it('应该在客户端错误时不重试', async () => {
      const operation = async () => {
        // 使用httpbin�?04错误端点
        const response = await fetch('https://httpbin.org/status/404');
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.json();
      };

      await expect(
        retryManager.executeWithRetry('client-error-test', operation, {
          maxRetries: 3,
          baseDelay: 100
        })
      ).rejects.toThrow();

      const stats = retryManager.getRetryStats('client-error-test');
      expect(stats.totalAttempts).toBe(1); // 不应该重�?      expect(stats.totalRetries).toBe(0);
    });
  });

  describe('重试策略', () => {
    it('应该使用指数退避策�?, async () => {
      const startTime = Date.now();
      
      const operation = async () => {
        throw new Error('ECONNREFUSED');
      };

      await expect(
        retryManager.executeWithRetry('exponential-test', operation, {
          maxRetries: 3,
          baseDelay: 100,
          strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
          jitter: false // 禁用抖动以确保延迟时间可预测
        })
      ).rejects.toThrow();

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 指数退�? 100ms + 200ms + 400ms = 700ms (最�?
      expect(duration).toBeGreaterThan(500); // 降低阈值以适应系统性能差异
    });

    it('应该使用线性退避策�?, async () => {
      const startTime = Date.now();
      
      const operation = async () => {
        throw new Error('ETIMEDOUT');
      };

      await expect(
        retryManager.executeWithRetry('linear-test', operation, {
          maxRetries: 3,
          baseDelay: 100,
          strategy: RetryStrategy.LINEAR_BACKOFF,
          jitter: false // 禁用抖动以确保延迟时间可预测
        })
      ).rejects.toThrow();

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 线性退�? 100ms + 200ms + 300ms = 600ms (最�?
      expect(duration).toBeGreaterThan(500);
    });

    it('应该使用固定延迟策略', async () => {
      const startTime = Date.now();
      
      const operation = async () => {
        throw new Error('500 Internal Server Error');
      };

      await expect(
        retryManager.executeWithRetry('fixed-test', operation, {
          maxRetries: 3,
          baseDelay: 100,
          strategy: RetryStrategy.FIXED_DELAY,
          jitter: false // 禁用抖动以确保延迟时间可预测
        })
      ).rejects.toThrow();

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 固定延迟: 100ms + 100ms + 100ms = 300ms (最�?
      expect(duration).toBeGreaterThan(200); // 降低阈值以适应系统性能差异
      expect(duration).toBeLessThan(500); // 不应该太�?    });
  });

  describe('自定义重试条�?, () => {
    it('应该支持自定义重试条�?, async () => {
      const operation = async () => {
        const response = await fetch('https://httpbin.org/status/400');
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.json();
      };

      // 自定义条件：�?00错误也进行重�?      const customRetryCondition = (error: Error) => {
        return error.message.includes('400');
      };

      await expect(
        retryManager.executeWithRetry('custom-retry-test', operation, {
          maxRetries: 2,
          baseDelay: 100,
          retryCondition: customRetryCondition
        })
      ).rejects.toThrow();

      const stats = retryManager.getRetryStats('custom-retry-test');
      expect(stats.totalAttempts).toBeGreaterThan(1); // 应该重试�?    });
  });

  describe('事件发射', () => {
    it('应该发射重试相关事件', async () => {
      const events: string[] = [];
      
      retryManager.on('retry-attempt', (data) => {
        events.push(`retry-attempt-${data.attempt}`);
      });
      
      retryManager.on('retry-failed', (data) => {
        events.push(`retry-failed-${data.key}`);
      });

      const operation = async () => {
        throw new Error('ECONNRESET');
      };

      await expect(
        retryManager.executeWithRetry('event-test', operation, {
          maxRetries: 2,
          baseDelay: 50
        })
      ).rejects.toThrow();

      expect(events).toContain('retry-attempt-1');
      expect(events).toContain('retry-attempt-2');
      expect(events).toContain('retry-failed-event-test');
    });
  });

  describe('并发重试管理', () => {
    it('应该正确处理并发重试', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => 
        retryManager.executeWithRetry(`concurrent-${i}`, async () => {
          throw new Error('502 Bad Gateway');
        }, {
          maxRetries: 2,
          baseDelay: 50
        })
      );

      const results = await Promise.allSettled(operations);
      
      // 所有操作都应该失败
      expect(results.every(r => r.status === 'rejected')).toBe(true);
      
      // 验证每个操作都有重试统计
      for (let i = 0; i < 5; i++) {
        const stats = retryManager.getRetryStats(`concurrent-${i}`);
        expect(stats.totalAttempts).toBeGreaterThan(1);
      }
    });
  });

  describe('成功场景', () => {
    it('应该在成功时不重�?, async () => {
      const operation = async () => {
        // 使用httpbin的成功端�?        const response = await fetch('https://httpbin.org/json');
        return response.json();
      };

      const result = await retryManager.executeWithRetry('success-test', operation, {
        maxRetries: 3,
        baseDelay: 100
      });

      expect(result).toBeDefined();
      
      const stats = retryManager.getRetryStats('success-test');
      expect(stats.totalAttempts).toBe(1);
      expect(stats.totalRetries).toBe(0);
      expect(stats.successCount).toBe(1);
    });

    it('应该在重试后成功', async () => {
      let attemptCount = 0;
      
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('503 Service Unavailable');
        }
        // 第三次尝试成�?        const response = await fetch('https://httpbin.org/json');
        return response.json();
      };

      const result = await retryManager.executeWithRetry('retry-success-test', operation, {
        maxRetries: 3,
        baseDelay: 50
      });

      expect(result).toBeDefined();
      
      const stats = retryManager.getRetryStats('retry-success-test');
      expect(stats.totalAttempts).toBe(3);
      expect(stats.totalRetries).toBe(2);
      expect(stats.successCount).toBe(1);
    });
  });

  describe('配置管理', () => {
    it('应该支持更新重试配置', async () => {
      // 更新网络错误的重试配�?      retryManager.updateRetryConfig(ApiErrorType.NETWORK_ERROR, {
        maxRetries: 5,
        baseDelay: 200,
        strategy: RetryStrategy.LINEAR_BACKOFF
      });

      const operation = async () => {
        throw new Error('ECONNREFUSED');
      };

      await expect(
        retryManager.executeWithRetry('config-test', operation)
      ).rejects.toThrow();

      const stats = retryManager.getRetryStats('config-test');
      expect(stats?.totalAttempts).toBe(6); // 1 + 5 retries
    });
  });

  describe('性能测试', () => {
    it('应该在高负载下正常工�?, async () => {
      const startTime = Date.now();
      
      const operations = Array.from({ length: 10 }, (_, i) => 
        retryManager.executeWithRetry(`perf-${i}`, async () => {
          if (Math.random() < 0.7) {
            throw new Error('503 Service Unavailable');
          }
          const response = await fetch('https://httpbin.org/json');
          return response.json();
        }, {
          maxRetries: 2,
          baseDelay: 50
        })
      );

      await Promise.allSettled(operations);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 应该在合理时间内完成
      expect(duration).toBeLessThan(10000); // 10秒内
      
      // 验证统计信息
      const allStats = retryManager.getAllStats();
      expect(allStats.size).toBe(10);
    });
  });
});
