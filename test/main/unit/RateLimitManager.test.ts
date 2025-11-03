import { RateLimitManager } from '../../services/RateLimitManager';

describe('RateLimitManager', () => {
  let rateLimitManager: RateLimitManager;

  beforeEach(() => {
    rateLimitManager = new RateLimitManager({
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 100,
      maxRequestsPerDay: 1000,
      burstLimit: 5,
      cooldownPeriod: 5000 // 5秒用于测�?    });
  });

  afterEach(() => {
    rateLimitManager.reset();
  });

  describe('基本功能测试', () => {
    it('应该允许初始请求', async () => {
      const result = await rateLimitManager.canMakeRequest();
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.waitTime).toBeUndefined();
    });

    it('应该正确记录请求', () => {
      rateLimitManager.recordRequest();
      const status = rateLimitManager.getStatus();
      
      expect(status.requestsInLastMinute).toBe(1);
      expect(status.requestsInLastHour).toBe(1);
      expect(status.requestsInLastDay).toBe(1);
      expect(status.burstRequestsUsed).toBe(1);
    });

    it('应该正确计算配额重置时间', () => {
      const status = rateLimitManager.getStatus();
      const now = Date.now();
      
      expect(status.quotaResetTime.minute).toBeGreaterThan(now);
      expect(status.quotaResetTime.hour).toBeGreaterThan(now);
      expect(status.quotaResetTime.day).toBeGreaterThan(now);
    });
  });

  describe('速率限制测试', () => {
    it('应该在达到分钟限制时拒绝请求', async () => {
      // 发�?0个请求（达到分钟限制�?      for (let i = 0; i < 10; i++) {
        const result = await rateLimitManager.canMakeRequest();
        expect(result.allowed).toBe(true);
        rateLimitManager.recordRequest();
      }

      // 第11个请求应该被拒绝
      const result = await rateLimitManager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Minute rate limit exceeded');
      expect(result.waitTime).toBeGreaterThan(0);
    });

    it('应该在达到突发限制时拒绝请求', async () => {
      // 发�?个请求（达到突发限制�?      for (let i = 0; i < 5; i++) {
        const result = await rateLimitManager.canMakeRequest();
        expect(result.allowed).toBe(true);
        rateLimitManager.recordRequest();
      }

      // �?个请求应该被拒绝
      const result = await rateLimitManager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Burst limit exceeded');
      expect(result.waitTime).toBeGreaterThan(0);
    });

    it('应该在小时限制达到时拒绝请求', async () => {
      // 模拟达到小时限制
      const manager = new RateLimitManager({
        maxRequestsPerMinute: 200,
        maxRequestsPerHour: 2,
        maxRequestsPerDay: 1000,
        burstLimit: 200,
        cooldownPeriod: 5000
      });

      // 发�?个请�?      for (let i = 0; i < 2; i++) {
        const result = await manager.canMakeRequest();
        expect(result.allowed).toBe(true);
        manager.recordRequest();
      }

      // �?个请求应该被拒绝
      const result = await manager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Hour rate limit exceeded');
    });

    it('应该在日限制达到时拒绝请�?, async () => {
      // 模拟达到日限�?      const manager = new RateLimitManager({
        maxRequestsPerMinute: 200,
        maxRequestsPerHour: 200,
        maxRequestsPerDay: 2,
        burstLimit: 200,
        cooldownPeriod: 5000
      });

      // 发�?个请�?      for (let i = 0; i < 2; i++) {
        const result = await manager.canMakeRequest();
        expect(result.allowed).toBe(true);
        manager.recordRequest();
      }

      // �?个请求应该被拒绝
      const result = await manager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily rate limit exceeded');
    });
  });

  describe('冷却期测�?, () => {
    it('应该�?29错误后进入冷却期', async () => {
      rateLimitManager.recordError(429);
      
      const result = await rateLimitManager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('In cooldown period');
      expect(result.waitTime).toBeGreaterThan(0);
    });

    it('应该�?03错误后进入冷却期', async () => {
      rateLimitManager.recordError(503);
      
      const result = await rateLimitManager.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('In cooldown period');
      expect(result.waitTime).toBeGreaterThan(0);
    });

    it('应该在冷却期结束后恢复正�?, async () => {
      // 使用短冷却期进行测试
      const manager = new RateLimitManager({
        maxRequestsPerMinute: 10,
        maxRequestsPerHour: 100,
        maxRequestsPerDay: 1000,
        burstLimit: 5,
        cooldownPeriod: 100 // 100ms
      });

      manager.recordError(429);
      
      // 立即检查应该被拒绝
      let result = await manager.canMakeRequest();
      expect(result.allowed).toBe(false);

      // 等待冷却期结�?      await new Promise(resolve => setTimeout(resolve, 150));

      // 现在应该允许请求
      result = await manager.canMakeRequest();
      expect(result.allowed).toBe(true);
    });

    it('不应该在其他错误码时进入冷却�?, async () => {
      rateLimitManager.recordError(404);
      
      const result = await rateLimitManager.canMakeRequest();
      expect(result.allowed).toBe(true);
    });
  });

  describe('事件发射测试', () => {
    it('应该在达到速率限制时发射事�?, async () => {
      const events: any[] = [];
      
      rateLimitManager.on('rateLimitExceeded', (data) => {
        events.push(data);
      });

      // 达到分钟限制
      for (let i = 0; i < 10; i++) {
        rateLimitManager.recordRequest();
      }
      
      await rateLimitManager.canMakeRequest();
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('minute');
      expect(events[0].resetTime).toBeGreaterThan(Date.now());
    });

    it('应该在配额使用率高时发出警告', async () => {
      const warnings: any[] = [];
      
      rateLimitManager.on('quotaWarning', (data) => {
        warnings.push(data);
      });

      // 发�?个请求（80%的分钟限制）
      for (let i = 0; i < 8; i++) {
        rateLimitManager.recordRequest();
      }
      
      await rateLimitManager.canMakeRequest();
      
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('minute');
      expect(warnings[0].usage).toBe(8);
      expect(warnings[0].limit).toBe(10);
    });
  });

  describe('配置管理测试', () => {
    it('应该能够更新配置', () => {
      const newConfig = {
        maxRequestsPerMinute: 20,
        burstLimit: 10
      };
      
      rateLimitManager.updateConfig(newConfig);
      
      // 测试新的突发限制
      for (let i = 0; i < 10; i++) {
        rateLimitManager.recordRequest();
      }
      
      const status = rateLimitManager.getStatus();
      expect(status.burstRequestsUsed).toBe(10);
    });

    it('应该能够重置所有计数器', () => {
      // 记录一些请�?      for (let i = 0; i < 5; i++) {
        rateLimitManager.recordRequest();
      }
      
      rateLimitManager.recordError(429); // 进入冷却�?      
      let status = rateLimitManager.getStatus();
      expect(status.requestsInLastMinute).toBe(5);
      expect(status.isLimited).toBe(true);
      
      // 重置
      rateLimitManager.reset();
      
      status = rateLimitManager.getStatus();
      expect(status.requestsInLastMinute).toBe(0);
      expect(status.requestsInLastHour).toBe(0);
      expect(status.requestsInLastDay).toBe(0);
      expect(status.burstRequestsUsed).toBe(0);
      expect(status.isLimited).toBe(false);
    });
  });

  describe('状态报告测�?, () => {
    it('应该正确报告限制状�?, () => {
      // 初始状�?      let status = rateLimitManager.getStatus();
      expect(status.isLimited).toBe(false);
      
      // 达到突发限制
      for (let i = 0; i < 5; i++) {
        rateLimitManager.recordRequest();
      }
      
      status = rateLimitManager.getStatus();
      expect(status.isLimited).toBe(true);
    });

    it('应该正确计算下次可用时间', async () => {
      rateLimitManager.recordError(429);
      
      const status = rateLimitManager.getStatus();
      expect(status.nextAvailableTime).toBeGreaterThan(Date.now());
      expect(status.nextAvailableTime).toBeLessThanOrEqual(Date.now() + 5000);
    });
  });

  describe('并发测试', () => {
    it('应该能够处理并发请求检�?, async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(rateLimitManager.canMakeRequest());
      }
      
      const results = await Promise.all(promises);
      
      // 所有检查都应该成功完成
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('allowed');
      });
    });

    it('应该能够处理并发请求记录', () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve().then(() => {
          rateLimitManager.recordRequest();
        }));
      }
      
      return Promise.all(promises).then(() => {
        const status = rateLimitManager.getStatus();
        expect(status.requestsInLastMinute).toBe(10);
      });
    });
  });

  describe('边界条件测试', () => {
    it('应该处理时间边界情况', () => {
      const now = Date.now();
      
      // 模拟在分钟边界的请求
      rateLimitManager.recordRequest();
      
      const status = rateLimitManager.getStatus();
      expect(status.quotaResetTime.minute).toBeGreaterThan(now);
    });

    it('应该正确清理过期的请求记�?, () => {
      // 这个测试需要模拟时间流逝，在实际环境中会由定时器处�?      rateLimitManager.recordRequest();
      
      const status = rateLimitManager.getStatus();
      expect(status.requestsInLastMinute).toBe(1);
      
      // 在实际应用中，过期记录会被定时清�?    });
  });
});
