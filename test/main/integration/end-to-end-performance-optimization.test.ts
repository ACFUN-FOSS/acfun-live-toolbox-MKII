import { describe, it, expect } from 'vitest';
import { setupPerformanceTest } from '../../shared/helpers/performance-test-setup';

describe('端到端性能优化场景', () => {
  const getContext = setupPerformanceTest();

  it('应该处理高负载插件场景', async () => {
    const { pluginManager, testPluginDir, testPluginId } = getContext();
    
    // 安装并启用测试插件
    await pluginManager.installPlugin(testPluginDir);
    await pluginManager.enablePlugin(testPluginId);
    
    const performanceMonitor = pluginManager['pluginPerformanceMonitor'];
    const cacheManager = pluginManager['pluginCacheManager'];
    const connectionPool = pluginManager['connectionPoolManager'];
    
    // 模拟高负载场景
    const promises = [];
    
    // 并发执行多个操作
    for (let i = 0; i < 20; i++) {
      promises.push(
        (async () => {
          // 模拟内存使用
          performanceMonitor.recordMemoryUsage(testPluginId, Math.random() * 50 * 1024 * 1024);
          
          // 模拟CPU使用
          performanceMonitor.recordCpuUsage(testPluginId, Math.random() * 80);
          
          // 模拟网络请求
          const startTime = Date.now();
          const conn = await connectionPool.acquire('http', { url: `http://test${i}.com` });
          const responseTime = Date.now() - startTime;
          
          performanceMonitor.recordResponseTime(testPluginId, responseTime);
          
          // 模拟缓存操作
          cacheManager.setPluginCache(testPluginId, `load-test-${i}`, { 
            data: `result-${i}`,
            timestamp: Date.now()
          });
          
          connectionPool.release(conn.id);
        })()
      );
    }
    
    await Promise.all(promises);
    
    // 验证所有组件正常工作
    const performanceMetrics = performanceMonitor.getMetrics(testPluginId);
    expect(performanceMetrics.totalRequests).toBe(20);
    expect(performanceMetrics.memoryUsage).toBeGreaterThan(0);
    expect(performanceMetrics.cpuUsage).toBeGreaterThan(0);
    
    const cacheStats = cacheManager.getStats(testPluginId);
    expect(cacheStats.totalItems).toBe(20);
    
    const connectionStats = connectionPool.getStats();
    expect(connectionStats.total).toBeGreaterThan(0);
  });

  it('应该生成综合性能报告', async () => {
    const { pluginManager, testPluginDir, testPluginId } = getContext();
    
    await pluginManager.installPlugin(testPluginDir);
    await pluginManager.enablePlugin(testPluginId);
    
    // 模拟一些性能数据
    const performanceMonitor = pluginManager['pluginPerformanceMonitor'];
    
    performanceMonitor.recordMemoryUsage(testPluginId, 40 * 1024 * 1024);
    performanceMonitor.recordCpuUsage(testPluginId, 60);
    performanceMonitor.recordResponseTime(testPluginId, 200);
    performanceMonitor.recordResponseTime(testPluginId, 300);
    performanceMonitor.recordError(testPluginId, new Error('Test error'));
    
    // 生成性能报告
    const report = pluginManager.generatePerformanceReport(testPluginId);
    
    expect(report).toBeDefined();
    expect(report.pluginId).toBe(testPluginId);
    expect(report.summary).toBeDefined();
    expect(report.summary.memoryUsage).toBe(40 * 1024 * 1024);
    expect(report.summary.cpuUsage).toBe(60);
    expect(report.summary.averageResponseTime).toBe(250);
    expect(report.summary.errorRate).toBeCloseTo(1/3, 2);
    
    expect(report.cacheStats).toBeDefined();
    expect(report.memoryPoolStats).toBeDefined();
    expect(report.connectionPoolStats).toBeDefined();
    expect(report.lazyLoadStats).toBeDefined();
    
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('应该处理性能优化建议', async () => {
    const { pluginManager, testPluginDir, testPluginId } = getContext();
    
    await pluginManager.installPlugin(testPluginDir);
    await pluginManager.enablePlugin(testPluginId);
    
    const performanceMonitor = pluginManager['pluginPerformanceMonitor'];
    
    // 模拟高内存使用触发警报
    let alertTriggered = false;
    performanceMonitor.on('alert', (alert) => {
      if (alert.type === 'memory' && alert.severity === 'critical') {
        alertTriggered = true;
      }
    });
    
    // 记录超过阈值的内存使用
    performanceMonitor.recordMemoryUsage(testPluginId, 150 * 1024 * 1024); // 超过100MB阈值
    
    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(alertTriggered).toBe(true);
    
    // 验证可以获取优化建议
    const report = pluginManager.generatePerformanceReport(testPluginId);
    const memoryRecommendations = report.recommendations.filter(r => 
      r.toLowerCase().includes('memory') || r.toLowerCase().includes('内存')
    );
    
    expect(memoryRecommendations.length).toBeGreaterThan(0);
  });
});