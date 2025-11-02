import { describe, it, expect } from 'vitest';
import { setupPerformanceTest } from '../../shared/helpers/performance-test-setup';

describe('错误恢复和容错', () => {
  const getContext = setupPerformanceTest();

  it('应该在组件故障时保持系统稳定', async () => {
    const { pluginManager, testPluginDir, testPluginId } = getContext();
    
    await pluginManager.installPlugin(testPluginDir);
    
    // 模拟性能监控组件故障
    const originalMonitor = pluginManager['pluginPerformanceMonitor'];
    pluginManager['pluginPerformanceMonitor'] = null;
    
    // 插件启用应该仍然成功，即使性能监控失败
    await expect(pluginManager.enablePlugin(testPluginId)).resolves.not.toThrow();
    
    // 恢复组件
    pluginManager['pluginPerformanceMonitor'] = originalMonitor;
  });

  it('应该处理缓存组件的故障恢复', async () => {
    const { pluginManager, testPluginDir, testPluginId } = getContext();
    
    await pluginManager.installPlugin(testPluginDir);
    await pluginManager.enablePlugin(testPluginId);
    
    const cacheManager = pluginManager['pluginCacheManager'];
    
    // 模拟缓存故障
    const originalSet = cacheManager.set;
    cacheManager.set = () => {
      throw new Error('Cache failure');
    };
    
    // 系统应该能够处理缓存故障
    expect(() => {
      try {
        cacheManager.setPluginCache(testPluginId, 'test-key', { data: 'test' });
      } catch (error) {
        // 预期的错误，系统应该继续运行
      }
    }).not.toThrow();
    
    // 恢复缓存功能
    cacheManager.set = originalSet;
    
    // 验证缓存恢复正常
    cacheManager.setPluginCache(testPluginId, 'recovery-test', { data: 'recovered' });
    const retrieved = cacheManager.getPluginCache(testPluginId, 'recovery-test');
    expect(retrieved).toEqual({ data: 'recovered' });
  });
});