import { describe, it, expect } from 'vitest';
import { PluginCacheManager } from '../../../packages/main/src/plugins/PluginCacheManager';
import { setupCacheManagerTest, cacheManager } from '../../shared/helpers/cache-manager-test-setup';

describe('PluginCacheManager - 缓存删除和LRU功能', () => {
  setupCacheManagerTest();

  describe('缓存删除', () => {
    it('应该能够删除缓存�?, () => {
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

    it('应该处理删除不存在的�?, () => {
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
      expect(afterClear.totalItems).toBe(1); // 只剩下other-plugin的缓�?      
      // 验证插件缓存已清�?      expect(cacheManager.getPluginCache(pluginId, 'key1')).toBeUndefined();
      expect(cacheManager.getPluginCache(pluginId, 'key2')).toBeUndefined();
      expect(cacheManager.getPluginCache('other-plugin', 'key3')).toBeDefined();
    });

    it('应该能够清理所有缓�?, () => {
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
    it('应该在达到最大项目数时移除最少使用的�?, () => {
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
      
      // 添加新项目，应该移除key2（最少使用的�?      lruManager.set('key4', { data: 'value4' });
      
      stats = lruManager.getStats();
      expect(stats.totalItems).toBe(3);
      
      // key1和key3应该仍然存在，key2应该被移�?      expect(lruManager.get('key1')).toBeDefined();
      expect(lruManager.get('key2')).toBeUndefined();
      expect(lruManager.get('key3')).toBeDefined();
      expect(lruManager.get('key4')).toBeDefined();
      
      lruManager.cleanup?.();
    });
  });
});
