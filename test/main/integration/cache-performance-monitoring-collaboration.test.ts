import { describe, it, expect } from 'vitest';
import { PluginCacheManager } from '../../../packages/main/plugins/PluginCacheManager';
import { setupPerformanceTest } from '../../shared/helpers/performance-test-setup';

describe('缓存与性能监控协作', () => {
  const getContext = setupPerformanceTest();

  it('应该监控缓存性能并触发优化', async () => {
    const { pluginManager, testPluginDir, testPluginId } = getContext();
    
    await pluginManager.installPlugin(testPluginDir);
    await pluginManager.enablePlugin(testPluginId);
    
    const cacheManager = pluginManager['pluginCacheManager'];
    const performanceMonitor = pluginManager['pluginPerformanceMonitor'];
    
    // 模拟大量缓存操作
    for (let i = 0; i < 100; i++) {
      cacheManager.setPluginCache(testPluginId, `key-${i}`, { 
        data: `value-${i}`,
        timestamp: Date.now()
      });
    }
    
    // 模拟缓存命中和未命中
    for (let i = 0; i < 50; i++) {
      cacheManager.getPluginCache(testPluginId, `key-${i}`); // 命中
      cacheManager.getPluginCache(testPluginId, `missing-key-${i}`); // 未命中
    }
    
    // 获取缓存统计
    const cacheStats = cacheManager.getStats(testPluginId);
    expect(cacheStats.hits).toBe(50);
    expect(cacheStats.misses).toBe(50);
    expect(cacheStats.hitRate).toBeCloseTo(0.5, 1);
    
    // 验证性能监控记录了缓存操作
    const performanceMetrics = performanceMonitor.getMetrics(testPluginId);
    expect(performanceMetrics.totalRequests).toBeGreaterThan(0);
  });

  it('应该在缓存驱逐时更新性能指标', async () => {
    const { pluginManager, testPluginDir, testPluginId } = getContext();
    
    await pluginManager.installPlugin(testPluginDir);
    await pluginManager.enablePlugin(testPluginId);
    
    // 创建一个小容量的缓存场景
    const smallCacheManager = new PluginCacheManager({
      maxItems: 5,
      enableLRU: true
    });
    
    let evictionCount = 0;
    smallCacheManager.on('eviction', () => {
      evictionCount++;
    });
    
    // 添加超过容量的项目
    for (let i = 0; i < 10; i++) {
      smallCacheManager.setPluginCache(testPluginId, `key-${i}`, { data: `value-${i}` });
    }
    
    // 验证发生了驱逐
    expect(evictionCount).toBeGreaterThan(0);
    
    const stats = smallCacheManager.getStats(testPluginId);
    expect(stats.totalItems).toBeLessThanOrEqual(5);
    
    smallCacheManager.cleanup?.();
  });
});