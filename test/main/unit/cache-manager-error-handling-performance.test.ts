import { describe, it, expect } from 'vitest';
import { setupCacheManagerTest, cacheManager } from '../../shared/helpers/cache-manager-test-setup';

describe('PluginCacheManager - 错误处理和性能测试', () => {
  setupCacheManagerTest();

  describe('错误处理', () => {
    it('应该处理无效的键', () => {
      expect(() => cacheManager.set('', { data: 'value' })).toThrow();
      expect(() => cacheManager.set(null as any, { data: 'value' })).toThrow();
      expect(() => cacheManager.set(undefined as any, { data: 'value' })).toThrow();
    });

    it('应该处理无效的TTL', () => {
      expect(() => cacheManager.set('key', { data: 'value' }, -1)).toThrow();
      expect(() => cacheManager.set('key', { data: 'value' }, 0)).toThrow();
    });

    it('应该处理大型对象', () => {
      const largeObject = {
        data: 'x'.repeat(1024 * 1024 * 2) // 2MB
      };
      
      // 应该能够处理大型对象或抛出适当的错�?      try {
        cacheManager.set('large-key', largeObject);
        const retrieved = cacheManager.get('large-key');
        expect(retrieved).toEqual(largeObject);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('大小');
      }
    });
  });

  describe('性能测试', () => {
    it('应该快速设置和获取缓存�?, () => {
      const startTime = Date.now();
      
      // 设置1000个缓存项
      for (let i = 0; i < 1000; i++) {
        cacheManager.set(`key${i}`, { data: `value${i}`, index: i });
      }
      
      // 获取所有缓存项
      for (let i = 0; i < 1000; i++) {
        const value = cacheManager.get(`key${i}`);
        expect(value).toBeDefined();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 应该在合理时间内完成
      expect(duration).toBeLessThan(1000); // 1�?    });

    it('应该处理并发访问', async () => {
      const promises: Promise<void>[] = [];
      
      // 创建多个并发操作
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>(resolve => {
            cacheManager.set(`concurrent-key-${i}`, { data: `value-${i}` });
            const value = cacheManager.get(`concurrent-key-${i}`);
            expect(value).toBeDefined();
            resolve();
          })
        );
      }
      
      await Promise.all(promises);
      
      const stats = cacheManager.getStats();
      expect(stats.totalItems).toBe(10);
    });
  });
});
