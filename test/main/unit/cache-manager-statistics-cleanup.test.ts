import { describe, it, expect } from 'vitest';
import { PluginCacheManager } from '../../../packages/main/src/plugins/PluginCacheManager';
import { setupCacheManagerTest, cacheManager } from '../../shared/helpers/cache-manager-test-setup';

describe('PluginCacheManager - 缓存统计和自动清�?, () => {
  setupCacheManagerTest();

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
      
      // 执行一些获取操�?      cacheManager.get('key1'); // hit
      cacheManager.get('key2'); // hit
      cacheManager.get('key3'); // miss
      
      const afterGetStats = cacheManager.getStats();
      expect(afterGetStats.hits).toBe(2);
      expect(afterGetStats.misses).toBe(1);
      expect(afterGetStats.hitRate).toBeCloseTo(2/3, 2);
    });

    it('应该跟踪插件特定的统计信�?, () => {
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
      
      // 等待过期和自动清�?      await new Promise(resolve => setTimeout(resolve, 200));
      
      const afterExpiry = autoCleanManager.getStats();
      expect(afterExpiry.totalItems).toBe(0);
      
      autoCleanManager.cleanup?.();
    });
  });
});
