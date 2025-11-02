import { describe, it, expect } from 'vitest';
import { setupCacheManagerTest, cacheManager } from '../../shared/helpers/cache-manager-test-setup';

describe('PluginCacheManager - 缓存获取和过�?, () => {
  setupCacheManagerTest();

  describe('缓存获取', () => {
    it('应该能够获取缓存�?, () => {
      const key = 'get-test-key';
      const value = { data: 'get-test-value' };
      
      cacheManager.set(key, value);
      const retrieved = cacheManager.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('应该返回undefined对于不存在的�?, () => {
      const retrieved = cacheManager.get('non-existent-key');
      expect(retrieved).toBeUndefined();
    });

    it('应该正确处理缓存命中和未命中', () => {
      const key = 'hit-test-key';
      const value = { data: 'hit-test-value' };
      
      // 设置缓存
      cacheManager.set(key, value);
      
      // 第一次获取（命中�?      const hit1 = cacheManager.get(key);
      expect(hit1).toEqual(value);
      
      // 第二次获取（命中�?      const hit2 = cacheManager.get(key);
      expect(hit2).toEqual(value);
      
      // 获取不存在的键（未命中）
      const miss = cacheManager.get('non-existent');
      expect(miss).toBeUndefined();
      
      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2/3, 2);
    });

    it('应该获取插件特定的缓�?, () => {
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
      
      // 使用默认TTL�?秒）
      cacheManager.set(key, value);
      
      const retrieved = cacheManager.get(key);
      expect(retrieved).toEqual(value);
      
      // 在默认TTL内应该仍然存�?      await new Promise(resolve => setTimeout(resolve, 100));
      const stillExists = cacheManager.get(key);
      expect(stillExists).toEqual(value);
    });
  });
});
