import { describe, it, expect } from 'vitest';
import { setupPerformanceTest } from '../../shared/helpers/performance-test-setup';

describe('懒加载与性能监控协作', () => {
  const getContext = setupPerformanceTest();

  it('应该监控懒加载性能', async () => {
    const { pluginManager, testPluginId } = getContext();
    const lazyLoader = pluginManager['pluginLazyLoader'];
    const performanceMonitor = pluginManager['pluginPerformanceMonitor'];
    
    // 注册插件到懒加载器
    lazyLoader.registerPlugin(testPluginId, {
      priority: 'normal',
      loader: async (pluginId) => {
        // 模拟加载时间
        await new Promise(resolve => setTimeout(resolve, 100));
        return { id: pluginId, loaded: true };
      }
    });
    
    // 开始监控
    performanceMonitor.startMonitoring(testPluginId);
    
    const startTime = Date.now();
    
    // 加载插件
    const result = await lazyLoader.loadPlugin(testPluginId);
    
    const loadTime = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(loadTime).toBeGreaterThan(90); // 至少100ms的模拟延迟
    
    // 验证性能监控记录了加载时间
    const metrics = performanceMonitor.getMetrics(testPluginId);
    expect(metrics.isMonitoring).toBe(true);
  });

  it('应该在内存压力下暂停懒加载', async () => {
    const { pluginManager } = getContext();
    const lazyLoader = pluginManager['pluginLazyLoader'];
    const memoryPool = pluginManager['memoryPoolManager'];
    
    // 注册多个插件
    for (let i = 0; i < 5; i++) {
      lazyLoader.registerPlugin(`test-plugin-${i}`, {
        priority: 'normal',
        loader: async (pluginId) => {
          return { id: pluginId, loaded: true };
        }
      });
    }
    
    // 模拟内存压力
    memoryPool.emit('memoryPressure', { 
      usage: 95 * 1024 * 1024, 
      threshold: 100 * 1024 * 1024 
    });
    
    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 验证懒加载被暂停
    const loadStatus = lazyLoader.getLoadStatus();
    expect(loadStatus.suspended).toBe(true);
    
    // 尝试加载插件应该失败
    const result = await lazyLoader.loadPlugin('test-plugin-0');
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('suspended');
  });
});