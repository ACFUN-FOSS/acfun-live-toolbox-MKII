import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginCacheManager } from '../../plugins/PluginCacheManager';

describe('PluginCacheManager', () => {
  let cacheManager: PluginCacheManager;

  beforeEach(() => {
    cacheManager = new PluginCacheManager({
      maxSize: 1024 * 1024, // 1MB
      defaultTTL: 5000, // 5 seconds
      cleanupInterval: 1000, // 1 second
      maxItems: 100,
      enableLRU: true,
      enableCompression: false
    });
  });

  afterEach(() => {
    cacheManager.cleanup?.();
  });

  describe('初始化', () => {
    it('应该正确初始化缓存管理器', () => {
      expect(cacheManager).toBeDefined();
      const stats = cacheManager.getStats();
      expect(stats.totalItems).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('应该使用默认配置', () => {
      const defaultManager = new PluginCacheManager();
      expect(defaultManager).toBeDefined();
      const stats = defaultManager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('缓存设置', () => {
    it('应该能够设置缓存项', () => {
      const key = 'test-key';
      const value = { data: 'test-value', timestamp: Date.now() };
      
      cacheManager.set(key, value);
      
      const stats = cacheManager.getStats();
      expect(stats.totalItems).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('应该能够设置带TTL的缓存项', () => {
      const key = 'test-key-ttl';
      const value = { data: 'test-value-ttl' };
      const ttl = 2000; // 2 seconds
      
      cacheManager.set(key, value, ttl);
      
      const retrieved = cacheManager.get(key);
      expect(retrieved).toEqual(value);
    });

    it('应该能够设置插件特定的缓存', () => {
      const pluginId = 'test-plugin';
      const key = 'plugin-key';
      const value = { pluginData: 'test' };
      
      cacheManager.setPluginCache(pluginId, key, value);
      
      const retrieved = cacheManager.getPluginCache(pluginId, key);
      expect(retrieved).toEqual(value);
    });

    it('应该覆盖现有的缓存项', () => {
      const key = 'overwrite-key';
      const value1 = { data: 'first-value' };
      const value2 = { data: 'second-value' };
      
      cacheManager.set(key, value1);
      cacheManager.set(key, value2);
      
      const retrieved = cacheManager.get(key);
      expect(retrieved).toEqual(value2);
      
      const stats = cacheManager.getStats();
      expect(stats.totalItems).toBe(1); // 应该只有一个项目
    });
  });

  describe('缓存获取', () => {
    it('应该能够获取缓存项', () => {
      const key = 'get-test-key';
      const value = { data: 'get-test-value' };
      
      cacheManager.set(key, value);
      const retrieved = cacheManager.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('应该返回undefined对于不存在的键', () => {
      const retrieved = cacheManager.get('non-existent-key');
      expect(retrieved).toBeUndefined();
    });

    it('应该正确处理缓存命中和未命中', () => {
      const key = 'hit-test-key';
      const value = { data: 'hit-test-value' };
      
      // 设置缓存
      cacheManager.set(key, value);
      
      // 第一次获取（命中）
      const hit1 = cacheManager.get(key);
      expect(hit1).toEqual(value);
      
      // 第二次获取（命中）
      const hit2 = cacheManager.get(key);
      expect(hit2).toEqual(value);
      
      // 获取不存在的键（未命中）
      const miss = cacheManager.get('non-existent');
      expect(miss).toBeUndefined();
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2/3, 2);
    });

    it('应该获取插件特定的缓存', () => {
      const pluginId = 'test-plugin';
      const key = 'plugin-get-key';
      const value = { pluginData: 'get-test' };
      
      cacheManager.setPluginCache(pluginId, key, value);
      const retrieved = cacheManager.getPluginCache(pluginId, key);
      
      expect(retrieved).toEqual(value);
    });
  });

  describe('缓存过期', () => {
    it('应该在TTL过期后删除缓存项', async () => {
      const key = 'ttl-test-key';
      const value = { data: 'ttl-test-value' };
      const ttl = 100; // 100ms
      
      cacheManager.set(key, value, ttl);
      
      // 立即获取应该成功
      const immediate = cacheManager.get(key);
      expect(immediate).toEqual(value);
      
      // 等待TTL过期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 过期后获取应该返回undefined
      const expired = cacheManager.get(key);
      expect(expired).toBeUndefined();
    });

    it('应该使用默认TTL', async () => {
      const key = 'default-ttl-key';
      const value = { data: 'default-ttl-value' };
      
      // 使用默认TTL（5秒）
      cacheManager.set(key, value);
      
      const retrieved = cacheManager.get(key);
      expect(retrieved).toEqual(value);
      
      // 在默认TTL内应该仍然存在
      await new Promise(resolve => setTimeout(resolve, 100));
      const stillExists = cacheManager.get(key);
      expect(stillExists).toEqual(value);
    });
  });

  describe('缓存删除', () => {
    it('应该能够删除缓存项', () => {
      const key = 'delete-test-key';
      const value = { data: 'delete-test-value' };
      
      cacheManager.set(key, value);
      const beforeDelete = cacheManager.get(key);
      expect(beforeDelete).toEqual(value);
      
      const deleted = cacheManager.delete(key);
      expect(deleted).toBe(true);
      
      const afterDelete = cacheManager.get(key);
      expect(afterDelete).toBeUndefined();
    });

    it('应该处理删除不存在的键', () => {
      const deleted = cacheManager.delete('non-existent-key');
      expect(deleted).toBe(false);
    });

    it('应该能够清理插件缓存', () => {
      const pluginId = 'test-plugin';
      
      cacheManager.setPluginCache(pluginId, 'key1', { data: 'value1' });
      cacheManager.setPluginCache(pluginId, 'key2', { data: 'value2' });
      cacheManager.setPluginCache('other-plugin', 'key3', { data: 'value3' });
      
      const beforeClear = cacheManager.getStats();
      expect(beforeClear.totalItems).toBe(3);
      
      cacheManager.clearPluginCache(pluginId);
      
      const afterClear = cacheManager.getStats();
      expect(afterClear.totalItems).toBe(1); // 只剩下other-plugin的缓存
      
      // 验证插件缓存已清理
      expect(cacheManager.getPluginCache(pluginId, 'key1')).toBeUndefined();
      expect(cacheManager.getPluginCache(pluginId, 'key2')).toBeUndefined();
      expect(cacheManager.getPluginCache('other-plugin', 'key3')).toBeDefined();
    });

    it('应该能够清理所有缓存', () => {
      cacheManager.set('key1', { data: 'value1' });
      cacheManager.set('key2', { data: 'value2' });
      cacheManager.setPluginCache('plugin1', 'key3', { data: 'value3' });
      
      const beforeClear = cacheManager.getStats();
      expect(beforeClear.totalItems).toBe(3);
      
      cacheManager.clear();
      
      const afterClear = cacheManager.getStats();
      expect(afterClear.totalItems).toBe(0);
      expect(afterClear.totalSize).toBe(0);
    });
  });

  describe('LRU功能', () => {
    it('应该在达到最大项目数时移除最少使用的项', () => {
      // 创建一个小容量的缓存管理器
      const lruManager = new PluginCacheManager({
        maxItems: 3,
        enableLRU: true
      });
      
      // 添加项目直到达到容量
      lruManager.set('key1', { data: 'value1' });
      lruManager.set('key2', { data: 'value2' });
      lruManager.set('key3', { data: 'value3' });
      
      let stats = lruManager.getStats();
      expect(stats.totalItems).toBe(3);
      
      // 访问key1使其成为最近使用的
      lruManager.get('key1');
      
      // 添加新项目，应该移除key2（最少使用的）
      lruManager.set('key4', { data: 'value4' });
      
      stats = lruManager.getStats();
      expect(stats.totalItems).toBe(3);
      
      // key1和key3应该仍然存在，key2应该被移除
      expect(lruManager.get('key1')).toBeDefined();
      expect(lruManager.get('key2')).toBeUndefined();
      expect(lruManager.get('key3')).toBeDefined();
      expect(lruManager.get('key4')).toBeDefined();
      
      lruManager.cleanup?.();
    });
  });

  describe('缓存统计', () => {
    it('应该正确跟踪缓存统计信息', () => {
      const initialStats = cacheManager.getStats();
      expect(initialStats.totalItems).toBe(0);
      expect(initialStats.totalSize).toBe(0);
      expect(initialStats.hits).toBe(0);
      expect(initialStats.misses).toBe(0);
      
      // 添加一些缓存项
      cacheManager.set('key1', { data: 'value1' });
      cacheManager.set('key2', { data: 'value2' });
      
      const afterSetStats = cacheManager.getStats();
      expect(afterSetStats.totalItems).toBe(2);
      expect(afterSetStats.totalSize).toBeGreaterThan(0);
      
      // 执行一些获取操作
      cacheManager.get('key1'); // hit
      cacheManager.get('key2'); // hit
      cacheManager.get('key3'); // miss
      
      const afterGetStats = cacheManager.getStats();
      expect(afterGetStats.hits).toBe(2);
      expect(afterGetStats.misses).toBe(1);
      expect(afterGetStats.hitRate).toBeCloseTo(2/3, 2);
    });

    it('应该跟踪插件特定的统计信息', () => {
      const pluginId = 'test-plugin';
      
      cacheManager.setPluginCache(pluginId, 'key1', { data: 'value1' });
      cacheManager.setPluginCache(pluginId, 'key2', { data: 'value2' });
      
      const pluginStats = cacheManager.getStats(pluginId);
      expect(pluginStats).toBeDefined();
      expect(pluginStats.totalItems).toBeGreaterThan(0);
    });
  });

  describe('自动清理', () => {
    it('应该自动清理过期的缓存项', async () => {
      // 创建一个短清理间隔的管理器
      const autoCleanManager = new PluginCacheManager({
        cleanupInterval: 100, // 100ms
        defaultTTL: 50 // 50ms
      });
      
      // 添加一些会过期的缓存项
      autoCleanManager.set('key1', { data: 'value1' });
      autoCleanManager.set('key2', { data: 'value2' });
      
      const beforeExpiry = autoCleanManager.getStats();
      expect(beforeExpiry.totalItems).toBe(2);
      
      // 等待过期和自动清理
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const afterExpiry = autoCleanManager.getStats();
      expect(afterExpiry.totalItems).toBe(0);
      
      autoCleanManager.cleanup?.();
    });
  });

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
      
      // 应该能够处理大型对象或抛出适当的错误
      try {
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
    it('应该快速设置和获取缓存项', () => {
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
      expect(duration).toBeLessThan(1000); // 1秒
    });

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