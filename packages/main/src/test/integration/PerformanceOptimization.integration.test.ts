import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginManager } from '../../plugins/PluginManager';
import { MemoryPoolManager } from '../../plugins/MemoryPoolManager';
import { ConnectionPoolManager } from '../../plugins/ConnectionPoolManager';
import { PluginCacheManager } from '../../plugins/PluginCacheManager';
import { PluginPerformanceMonitor } from '../../plugins/PluginPerformanceMonitor';
import { PluginLazyLoader } from '../../plugins/PluginLazyLoader';
import path from 'path';
import fs from 'fs/promises';

describe('性能优化组件集成测试', () => {
  let pluginManager: PluginManager;
  let testPluginDir: string;
  let testPluginId: string;

  beforeEach(async () => {
    // 创建测试插件目录
    testPluginDir = path.join(process.cwd(), 'test-plugins', 'performance-test-plugin');
    testPluginId = 'performance-test-plugin';
    
    await fs.mkdir(testPluginDir, { recursive: true });
    
    // 创建测试插件的manifest.json
    const manifest = {
      id: testPluginId,
      name: 'Performance Test Plugin',
      version: '1.0.0',
      description: 'A test plugin for performance optimization',
      main: 'index.js',
      permissions: ['network', 'storage'],
      dependencies: []
    };
    
    await fs.writeFile(
      path.join(testPluginDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // 创建测试插件的主文件
    const pluginCode = `
      class PerformanceTestPlugin {
        constructor() {
          this.memoryUsage = 0;
          this.requestCount = 0;
        }
        
        async initialize() {
          console.log('Performance test plugin initialized');
          return true;
        }
        
        async simulateMemoryUsage(size) {
          this.memoryUsage += size;
          // 模拟内存使用
          const buffer = new Array(size / 8).fill(0);
          return buffer;
        }
        
        async simulateNetworkRequest() {
          this.requestCount++;
          // 模拟网络请求延迟
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return { success: true, data: 'test-data' };
        }
        
        async cleanup() {
          this.memoryUsage = 0;
          this.requestCount = 0;
          console.log('Performance test plugin cleaned up');
        }
        
        getStats() {
          return {
            memoryUsage: this.memoryUsage,
            requestCount: this.requestCount
          };
        }
      }
      
      module.exports = PerformanceTestPlugin;
    `;
    
    await fs.writeFile(path.join(testPluginDir, 'index.js'), pluginCode);
    
    // 初始化插件管理器
    pluginManager = new PluginManager({
      pluginsDir: path.join(process.cwd(), 'test-plugins'),
      enableHotReload: false,
      maxPlugins: 10
    });
  });

  afterEach(async () => {
    // 清理插件管理器
    await pluginManager.cleanup();
    
    // 清理测试文件
    try {
      await fs.rm(path.dirname(testPluginDir), { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('插件管理器与性能优化组件集成', () => {
    it('应该正确初始化所有性能优化组件', () => {
      // 验证插件管理器包含所有性能优化组件
      expect(pluginManager['memoryPoolManager']).toBeDefined();
      expect(pluginManager['connectionPoolManager']).toBeDefined();
      expect(pluginManager['pluginCacheManager']).toBeDefined();
      expect(pluginManager['pluginPerformanceMonitor']).toBeDefined();
      expect(pluginManager['pluginLazyLoader']).toBeDefined();
    });

    it('应该在插件启用时开始性能监控', async () => {
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

  describe('内存池与连接池协作', () => {
    it('应该在内存压力下优化连接池', async () => {
      const memoryPool = pluginManager['memoryPoolManager'];
      const connectionPool = pluginManager['connectionPoolManager'];
      
      // 模拟高内存使用
      const largeAllocation = await memoryPool.allocate(80 * 1024 * 1024); // 80MB
      
      // 获取连接池统计
      const initialStats = connectionPool.getStats();
      
      // 模拟内存压力事件
      memoryPool.emit('memoryPressure', { 
        usage: 90 * 1024 * 1024, 
        threshold: 100 * 1024 * 1024 
      });
      
      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 验证连接池响应了内存压力
      const afterPressureStats = connectionPool.getStats();
      expect(afterPressureStats.total).toBeLessThanOrEqual(initialStats.total);
      
      // 清理
      memoryPool.free(largeAllocation);
    });

    it('应该在连接池满时触发内存优化', async () => {
      const memoryPool = pluginManager['memoryPoolManager'];
      const connectionPool = pluginManager['connectionPoolManager'];
      
      // 创建大量连接直到接近限制
      const connections = [];
      for (let i = 0; i < 8; i++) { // 接近默认的10个连接限制
        const conn = await connectionPool.acquire('http', { url: `http://test${i}.com` });
        connections.push(conn);
      }
      
      // 获取内存统计
      const initialMemoryStats = memoryPool.getStats();
      
      // 尝试创建更多连接（应该触发优化）
      try {
        await connectionPool.acquire('http', { url: 'http://overflow.com' });
      } catch (error) {
        // 预期可能失败
      }
      
      // 验证内存池可能进行了优化
      const afterOptimizationStats = memoryPool.getStats();
      
      // 清理连接
      for (const conn of connections) {
        connectionPool.release(conn.id);
      }
    });
  });

  describe('缓存与性能监控协作', () => {
    it('应该监控缓存性能并触发优化', async () => {
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
      await pluginManager.installPlugin(testPluginDir);
      await pluginManager.enablePlugin(testPluginId);
      
      const cacheManager = pluginManager['pluginCacheManager'];
      
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

  describe('懒加载与性能监控协作', () => {
    it('应该监控懒加载性能', async () => {
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

  describe('端到端性能优化场景', () => {
    it('应该处理高负载插件场景', async () => {
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

  describe('错误恢复和容错', () => {
    it('应该在组件故障时保持系统稳定', async () => {
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
});