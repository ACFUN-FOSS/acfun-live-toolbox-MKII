import { describe, it, expect } from 'vitest';
import { PluginCacheManager } from '../../../packages/main/src/plugins/PluginCacheManager';
import { setupCacheManagerTest, cacheManager } from '../../shared/helpers/cache-manager-test-setup';

describe('PluginCacheManager - 初始化和缓存设置', () => {
  setupCacheManagerTest();

  describe('初始�?, () => {
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
    it('应该能够设置缓存�?, () => {
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

    it('应该能够设置插件特定的缓�?, () => {
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
      expect(stats.totalItems).toBe(1); // 应该只有一个项�?    });
  });
});
