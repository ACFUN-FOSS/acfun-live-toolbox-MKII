import { describe, it, expect } from 'vitest';
import { setupPerformanceTest } from '../../shared/helpers/performance-test-setup';

describe('插件管理器与性能优化组件集成', () => {
  const getContext = setupPerformanceTest();

  it('应该正确初始化所有性能优化组件', () => {
    const { pluginManager } = getContext();
    
    // 验证插件管理器包含所有性能优化组件
    expect(pluginManager['memoryPoolManager']).toBeDefined();
    expect(pluginManager['connectionPoolManager']).toBeDefined();
    expect(pluginManager['pluginCacheManager']).toBeDefined();
    expect(pluginManager['pluginPerformanceMonitor']).toBeDefined();
    expect(pluginManager['pluginLazyLoader']).toBeDefined();
  });

  it('应该在插件启用时开始性能监控', async () => {
    const { pluginManager, testPluginDir, testPluginId } = getContext();
    
    // 安装并启用测试插件
    await pluginManager.installPlugin(testPluginDir);
    await pluginManager.enablePlugin(testPluginId);
    
    // 验证性能监控已开始
    const metrics = pluginManager.getPluginPerformanceMetrics(testPluginId);
    expect(metrics).toBeDefined();
    expect(metrics.isMonitoring).toBe(true);
    
    // 验证懒加载器已注册插件
    const lazyLoadStatus = pluginManager.getPluginLazyLoadStatus(testPluginId);
    expect(lazyLoadStatus).toBeDefined();
  });

  it('应该在插件禁用时清理性能优化资源', async () => {
    const { pluginManager, testPluginDir, testPluginId } = getContext();
    
    // 安装并启用测试插件
    await pluginManager.installPlugin(testPluginDir);
    await pluginManager.enablePlugin(testPluginId);
    
    // 禁用插件
    await pluginManager.disablePlugin(testPluginId);
    
    // 验证性能监控已停止
    const metrics = pluginManager.getPluginPerformanceMetrics(testPluginId);
    expect(metrics.isMonitoring).toBe(false);
    
    // 验证缓存已清理
    const cacheStats = pluginManager.getPluginCacheStats(testPluginId);
    expect(cacheStats.totalItems).toBe(0);
  });
});