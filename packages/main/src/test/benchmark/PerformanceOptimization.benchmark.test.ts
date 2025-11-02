import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryPoolManager } from '../../plugins/MemoryPoolManager';
import { ConnectionPoolManager } from '../../plugins/ConnectionPoolManager';
import { PluginCacheManager } from '../../plugins/PluginCacheManager';
import { PluginPerformanceMonitor } from '../../plugins/PluginPerformanceMonitor';
import { PluginLazyLoader } from '../../plugins/PluginLazyLoader';

// 基准测试辅助函数
function measureTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
    resolve({ result, duration });
  });
}

function measureMemory<T>(fn: () => T | Promise<T>): Promise<{ result: T; memoryUsed: number }> {
  return new Promise(async (resolve) => {
    const initialMemory = process.memoryUsage().heapUsed;
    const result = await fn();
    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsed = finalMemory - initialMemory;
    resolve({ result, memoryUsed });
  });
}

describe('性能优化组件基准测试', () => {
  describe('MemoryPoolManager 性能基准', () => {
    let memoryPool: MemoryPoolManager;

    beforeEach(() => {
      memoryPool = new MemoryPoolManager({
        maxPoolSize: 500 * 1024 * 1024, // 500MB
        blockSizes: [1024, 4096, 16384, 65536], // 1KB, 4KB, 16KB, 64KB
        maxBlocksPerSize: 1000,
        enableFragmentationOptimization: true,
        fragmentationThreshold: 0.3
      });
    });

    afterEach(() => {
      memoryPool.cleanup?.();
    });

    it('应该快速分配小块内存', async () => {
      const { duration } = await measureTime(async () => {
        const allocations = [];
        for (let i = 0; i < 10000; i++) {
          const allocation = await memoryPool.allocate(1024); // 1KB
          allocations.push(allocation);
        }
        return allocations;
      });

      console.log(`10000次1KB内存分配耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该快速分配大块内存', async () => {
      const { duration } = await measureTime(async () => {
        const allocations = [];
        for (let i = 0; i < 1000; i++) {
          const allocation = await memoryPool.allocate(64 * 1024); // 64KB
          allocations.push(allocation);
        }
        return allocations;
      });

      console.log(`1000次64KB内存分配耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
    });

    it('应该快速释放内存', async () => {
      // 先分配一些内存
      const allocations = [];
      for (let i = 0; i < 5000; i++) {
        const allocation = await memoryPool.allocate(4096); // 4KB
        allocations.push(allocation);
      }

      const { duration } = await measureTime(async () => {
        for (const allocation of allocations) {
          memoryPool.free(allocation);
        }
      });

      console.log(`5000次内存释放耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500); // 应该在0.5秒内完成
    });

    it('应该处理并发内存操作', async () => {
      const { duration } = await measureTime(async () => {
        const promises = [];
        
        // 创建100个并发任务
        for (let i = 0; i < 100; i++) {
          promises.push(
            (async () => {
              const allocations = [];
              // 每个任务分配和释放100次
              for (let j = 0; j < 100; j++) {
                const allocation = await memoryPool.allocate(Math.random() * 32768 + 1024);
                allocations.push(allocation);
              }
              // 释放一半
              for (let j = 0; j < 50; j++) {
                memoryPool.free(allocations[j]);
              }
              return allocations.slice(50);
            })()
          );
        }
        
        return await Promise.all(promises);
      });

      console.log(`100个并发内存操作任务耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
    });

    it('应该有效管理内存碎片', async () => {
      // 创建碎片化场景
      const allocations = [];
      
      // 分配大量不同大小的内存块
      for (let i = 0; i < 1000; i++) {
        const size = Math.floor(Math.random() * 10000) + 1000;
        const allocation = await memoryPool.allocate(size);
        allocations.push(allocation);
      }
      
      // 随机释放一些内存块以创建碎片
      for (let i = 0; i < 500; i++) {
        const randomIndex = Math.floor(Math.random() * allocations.length);
        if (allocations[randomIndex]) {
          memoryPool.free(allocations[randomIndex]);
          allocations[randomIndex] = null;
        }
      }
      
      const initialStats = memoryPool.getStats();
      const initialFragmentation = initialStats.fragmentation;
      
      // 测试碎片整理性能
      const { duration } = await measureTime(async () => {
        await memoryPool.defragment();
      });
      
      const finalStats = memoryPool.getStats();
      const finalFragmentation = finalStats.fragmentation;
      
      console.log(`内存碎片整理耗时: ${duration.toFixed(2)}ms`);
      console.log(`碎片率从 ${(initialFragmentation * 100).toFixed(2)}% 降至 ${(finalFragmentation * 100).toFixed(2)}%`);
      
      expect(duration).toBeLessThan(1000); // 碎片整理应该在1秒内完成
      expect(finalFragmentation).toBeLessThanOrEqual(initialFragmentation);
    });
  });

  describe('ConnectionPoolManager 性能基准', () => {
    let connectionPool: ConnectionPoolManager;

    beforeEach(() => {
      connectionPool = new ConnectionPoolManager({
        maxConnections: 100,
        maxConnectionsPerType: 50,
        connectionTimeout: 5000,
        idleTimeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        enableHealthCheck: true,
        healthCheckInterval: 10000
      });
    });

    afterEach(() => {
      connectionPool.cleanup?.();
    });

    it('应该快速获取HTTP连接', async () => {
      const { duration } = await measureTime(async () => {
        const connections = [];
        for (let i = 0; i < 1000; i++) {
          const conn = await connectionPool.acquire('http', { 
            url: `http://test${i % 10}.com` 
          });
          connections.push(conn);
        }
        return connections;
      });

      console.log(`1000次HTTP连接获取耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
    });

    it('应该快速释放连接', async () => {
      // 先获取一些连接
      const connections = [];
      for (let i = 0; i < 500; i++) {
        const conn = await connectionPool.acquire('http', { 
          url: `http://test${i % 5}.com` 
        });
        connections.push(conn);
      }

      const { duration } = await measureTime(async () => {
        for (const conn of connections) {
          connectionPool.release(conn.id);
        }
      });

      console.log(`500次连接释放耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500); // 应该在0.5秒内完成
    });

    it('应该处理并发连接请求', async () => {
      const { duration } = await measureTime(async () => {
        const promises = [];
        
        // 创建200个并发连接请求
        for (let i = 0; i < 200; i++) {
          promises.push(
            connectionPool.acquire('http', { 
              url: `http://concurrent${i % 20}.com` 
            })
          );
        }
        
        const connections = await Promise.all(promises);
        
        // 释放所有连接
        for (const conn of connections) {
          connectionPool.release(conn.id);
        }
        
        return connections;
      });

      console.log(`200个并发连接请求耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(3000); // 应该在3秒内完成
    });

    it('应该有效复用连接', async () => {
      const url = 'http://reuse-test.com';
      
      // 第一次获取连接
      const { duration: firstDuration } = await measureTime(async () => {
        const conn = await connectionPool.acquire('http', { url });
        connectionPool.release(conn.id);
        return conn;
      });
      
      // 第二次获取相同连接（应该复用）
      const { duration: secondDuration } = await measureTime(async () => {
        const conn = await connectionPool.acquire('http', { url });
        connectionPool.release(conn.id);
        return conn;
      });
      
      console.log(`首次连接耗时: ${firstDuration.toFixed(2)}ms`);
      console.log(`复用连接耗时: ${secondDuration.toFixed(2)}ms`);
      
      // 复用连接应该更快
      expect(secondDuration).toBeLessThan(firstDuration);
    });
  });

  describe('PluginCacheManager 性能基准', () => {
    let cacheManager: PluginCacheManager;

    beforeEach(() => {
      cacheManager = new PluginCacheManager({
        maxSize: 100 * 1024 * 1024, // 100MB
        defaultTTL: 300000, // 5分钟
        cleanupInterval: 60000, // 1分钟
        maxItems: 10000,
        enableLRU: true,
        enableCompression: false
      });
    });

    afterEach(() => {
      cacheManager.cleanup?.();
    });

    it('应该快速设置缓存项', async () => {
      const { duration } = await measureTime(async () => {
        for (let i = 0; i < 10000; i++) {
          cacheManager.set(`key-${i}`, { 
            data: `value-${i}`,
            timestamp: Date.now(),
            index: i
          });
        }
      });

      console.log(`10000次缓存设置耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该快速获取缓存项', async () => {
      // 先设置一些缓存项
      for (let i = 0; i < 5000; i++) {
        cacheManager.set(`benchmark-key-${i}`, { 
          data: `benchmark-value-${i}`,
          index: i
        });
      }

      const { duration } = await measureTime(async () => {
        for (let i = 0; i < 5000; i++) {
          const value = cacheManager.get(`benchmark-key-${i}`);
          expect(value).toBeDefined();
        }
      });

      console.log(`5000次缓存获取耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500); // 应该在0.5秒内完成
    });

    it('应该处理并发缓存操作', async () => {
      const { duration } = await measureTime(async () => {
        const promises = [];
        
        // 创建100个并发任务
        for (let i = 0; i < 100; i++) {
          promises.push(
            (async () => {
              // 每个任务执行100次缓存操作
              for (let j = 0; j < 100; j++) {
                const key = `concurrent-${i}-${j}`;
                const value = { data: `value-${i}-${j}`, timestamp: Date.now() };
                
                cacheManager.set(key, value);
                const retrieved = cacheManager.get(key);
                expect(retrieved).toEqual(value);
              }
            })()
          );
        }
        
        await Promise.all(promises);
      });

      console.log(`100个并发缓存任务耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(3000); // 应该在3秒内完成
    });

    it('应该有效处理LRU驱逐', async () => {
      // 创建一个小容量的缓存管理器用于测试LRU
      const lruCache = new PluginCacheManager({
        maxItems: 1000,
        enableLRU: true
      });

      const { duration } = await measureTime(async () => {
        // 添加超过容量的项目以触发LRU驱逐
        for (let i = 0; i < 2000; i++) {
          lruCache.set(`lru-key-${i}`, { 
            data: `lru-value-${i}`,
            size: Math.random() * 1000
          });
        }
      });

      const stats = lruCache.getStats();
      
      console.log(`2000次LRU缓存操作耗时: ${duration.toFixed(2)}ms`);
      console.log(`最终缓存项数量: ${stats.totalItems}`);
      
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
      expect(stats.totalItems).toBeLessThanOrEqual(1000);
      
      lruCache.cleanup?.();
    });

    it('应该快速计算缓存统计', async () => {
      // 设置大量缓存项
      for (let i = 0; i < 5000; i++) {
        cacheManager.set(`stats-key-${i}`, { data: `stats-value-${i}` });
      }
      
      // 执行一些获取操作以产生统计数据
      for (let i = 0; i < 2500; i++) {
        cacheManager.get(`stats-key-${i}`); // 命中
        cacheManager.get(`missing-key-${i}`); // 未命中
      }

      const { duration } = await measureTime(async () => {
        for (let i = 0; i < 1000; i++) {
          const stats = cacheManager.getStats();
          expect(stats).toBeDefined();
          expect(stats.totalItems).toBe(5000);
          expect(stats.hits).toBe(2500);
          expect(stats.misses).toBe(2500);
        }
      });

      console.log(`1000次统计计算耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100); // 应该在0.1秒内完成
    });
  });

  describe('PluginPerformanceMonitor 性能基准', () => {
    let monitor: PluginPerformanceMonitor;

    beforeEach(() => {
      monitor = new PluginPerformanceMonitor({
        memoryThreshold: 100 * 1024 * 1024,
        cpuThreshold: 80,
        responseTimeThreshold: 5000,
        errorRateThreshold: 0.1,
        monitoringInterval: 1000,
        enableDetailedMetrics: true,
        enableAlerts: true,
        maxHistorySize: 10000
      });
    });

    afterEach(() => {
      monitor.cleanup?.();
    });

    it('应该快速记录性能指标', async () => {
      const pluginId = 'benchmark-plugin';
      monitor.startMonitoring(pluginId);

      const { duration } = await measureTime(async () => {
        for (let i = 0; i < 10000; i++) {
          monitor.recordMemoryUsage(pluginId, Math.random() * 100 * 1024 * 1024);
          monitor.recordCpuUsage(pluginId, Math.random() * 100);
          monitor.recordResponseTime(pluginId, Math.random() * 1000);
          
          if (i % 100 === 0) {
            monitor.recordError(pluginId, new Error(`Test error ${i}`));
          }
        }
      });

      console.log(`10000次性能指标记录耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
      
      const metrics = monitor.getMetrics(pluginId);
      expect(metrics.totalRequests).toBe(10000);
      expect(metrics.errorCount).toBe(100);
    });

    it('应该处理并发监控', async () => {
      const { duration } = await measureTime(async () => {
        const promises = [];
        
        // 创建50个插件的并发监控
        for (let i = 0; i < 50; i++) {
          const pluginId = `concurrent-plugin-${i}`;
          monitor.startMonitoring(pluginId);
          
          promises.push(
            (async () => {
              // 每个插件记录200次指标
              for (let j = 0; j < 200; j++) {
                monitor.recordMemoryUsage(pluginId, Math.random() * 50 * 1024 * 1024);
                monitor.recordCpuUsage(pluginId, Math.random() * 80);
                monitor.recordResponseTime(pluginId, Math.random() * 500);
              }
            })()
          );
        }
        
        await Promise.all(promises);
      });

      console.log(`50个插件并发监控耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
    });

    it('应该快速生成性能报告', async () => {
      // 为多个插件设置监控数据
      for (let i = 0; i < 20; i++) {
        const pluginId = `report-plugin-${i}`;
        monitor.startMonitoring(pluginId);
        
        // 为每个插件添加一些性能数据
        for (let j = 0; j < 100; j++) {
          monitor.recordMemoryUsage(pluginId, Math.random() * 80 * 1024 * 1024);
          monitor.recordCpuUsage(pluginId, Math.random() * 70);
          monitor.recordResponseTime(pluginId, Math.random() * 800);
        }
      }

      const { duration } = await measureTime(async () => {
        const reports = monitor.generateReport();
        expect(Array.isArray(reports)).toBe(true);
        expect(reports.length).toBe(20);
        
        for (const report of reports) {
          expect(report.summary).toBeDefined();
          expect(report.recommendations).toBeDefined();
        }
      });

      console.log(`20个插件性能报告生成耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('PluginLazyLoader 性能基准', () => {
    let lazyLoader: PluginLazyLoader;

    beforeEach(() => {
      lazyLoader = new PluginLazyLoader({
        maxConcurrentLoads: 10,
        loadTimeout: 5000,
        retryAttempts: 2,
        retryDelay: 100,
        enablePreloading: true,
        preloadThreshold: 0.8,
        memoryThreshold: 100 * 1024 * 1024,
        enablePrioritization: true
      });
    });

    afterEach(() => {
      lazyLoader.cleanup?.();
    });

    it('应该快速注册大量插件', async () => {
      const { duration } = await measureTime(async () => {
        for (let i = 0; i < 1000; i++) {
          lazyLoader.registerPlugin(`plugin-${i}`, {
            priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'normal' : 'low',
            dependencies: i > 0 ? [`plugin-${i - 1}`] : [],
            loader: async (pluginId) => {
              // 模拟快速加载
              await new Promise(resolve => setTimeout(resolve, 1));
              return { id: pluginId, loaded: true };
            }
          });
        }
      });

      console.log(`1000个插件注册耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
      
      const status = lazyLoader.getLoadStatus();
      expect(status.totalPlugins).toBe(1000);
    });

    it('应该快速加载多个插件', async () => {
      // 先注册一些插件
      for (let i = 0; i < 100; i++) {
        lazyLoader.registerPlugin(`load-plugin-${i}`, {
          priority: 'normal',
          loader: async (pluginId) => {
            // 模拟加载时间
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            return { id: pluginId, loaded: true };
          }
        });
      }

      const { duration } = await measureTime(async () => {
        const promises = [];
        
        // 并发加载所有插件
        for (let i = 0; i < 100; i++) {
          promises.push(lazyLoader.loadPlugin(`load-plugin-${i}`));
        }
        
        const results = await Promise.all(promises);
        
        // 验证所有加载都成功
        for (const result of results) {
          expect(result.success).toBe(true);
        }
        
        return results;
      });

      console.log(`100个插件并发加载耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(3000); // 应该在3秒内完成
      
      const status = lazyLoader.getLoadStatus();
      expect(status.loadedPlugins).toBe(100);
    });

    it('应该快速处理依赖解析', async () => {
      // 创建复杂的依赖链
      const { duration } = await measureTime(async () => {
        // 创建一个深度为10的依赖链
        for (let i = 0; i < 10; i++) {
          lazyLoader.registerPlugin(`dep-chain-${i}`, {
            priority: 'normal',
            dependencies: i > 0 ? [`dep-chain-${i - 1}`] : [],
            loader: async (pluginId) => {
              await new Promise(resolve => setTimeout(resolve, 5));
              return { id: pluginId, loaded: true };
            }
          });
        }
        
        // 加载最后一个插件，应该触发整个依赖链的加载
        const result = await lazyLoader.loadPlugin('dep-chain-9');
        expect(result.success).toBe(true);
      });

      console.log(`深度10的依赖链解析耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该快速查询插件状态', async () => {
      // 注册和加载一些插件
      for (let i = 0; i < 500; i++) {
        lazyLoader.registerPlugin(`status-plugin-${i}`, {
          priority: 'normal',
          loader: async (pluginId) => {
            return { id: pluginId, loaded: true };
          }
        });
      }
      
      // 加载一半插件
      for (let i = 0; i < 250; i++) {
        await lazyLoader.loadPlugin(`status-plugin-${i}`);
      }

      const { duration } = await measureTime(async () => {
        // 查询所有插件状态
        for (let i = 0; i < 500; i++) {
          const status = lazyLoader.getPluginStatus(`status-plugin-${i}`);
          expect(status).toBeDefined();
        }
        
        // 查询总体状态
        for (let i = 0; i < 1000; i++) {
          const loadStatus = lazyLoader.getLoadStatus();
          expect(loadStatus.totalPlugins).toBe(500);
          expect(loadStatus.loadedPlugins).toBe(250);
        }
      });

      console.log(`1500次状态查询耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500); // 应该在0.5秒内完成
    });
  });

  describe('综合性能基准', () => {
    it('应该在高负载下保持良好性能', async () => {
      const memoryPool = new MemoryPoolManager();
      const connectionPool = new ConnectionPoolManager();
      const cacheManager = new PluginCacheManager();
      const performanceMonitor = new PluginPerformanceMonitor();
      const lazyLoader = new PluginLazyLoader();

      const { duration, memoryUsed } = await measureMemory(async () => {
        const promises = [];
        
        // 创建综合负载测试
        for (let i = 0; i < 50; i++) {
          promises.push(
            (async () => {
              const pluginId = `integrated-plugin-${i}`;
              
              // 注册插件到懒加载器
              lazyLoader.registerPlugin(pluginId, {
                priority: 'normal',
                loader: async (id) => ({ id, loaded: true })
              });
              
              // 开始性能监控
              performanceMonitor.startMonitoring(pluginId);
              
              // 执行各种操作
              for (let j = 0; j < 100; j++) {
                // 内存操作
                const allocation = await memoryPool.allocate(Math.random() * 10000 + 1000);
                
                // 连接操作
                const conn = await connectionPool.acquire('http', { 
                  url: `http://test${i}.com` 
                });
                
                // 缓存操作
                cacheManager.setPluginCache(pluginId, `key-${j}`, { 
                  data: `value-${j}`,
                  timestamp: Date.now()
                });
                
                // 性能监控
                performanceMonitor.recordMemoryUsage(pluginId, Math.random() * 50 * 1024 * 1024);
                performanceMonitor.recordResponseTime(pluginId, Math.random() * 200);
                
                // 获取缓存
                const cached = cacheManager.getPluginCache(pluginId, `key-${j}`);
                expect(cached).toBeDefined();
                
                // 释放资源
                memoryPool.free(allocation);
                connectionPool.release(conn.id);
              }
              
              // 加载插件
              await lazyLoader.loadPlugin(pluginId);
            })()
          );
        }
        
        await Promise.all(promises);
      });

      console.log(`综合高负载测试耗时: ${duration.toFixed(2)}ms`);
      console.log(`内存使用: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      
      expect(duration).toBeLessThan(10000); // 应该在10秒内完成
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // 内存使用应该小于100MB
      
      // 清理资源
      memoryPool.cleanup?.();
      connectionPool.cleanup?.();
      cacheManager.cleanup?.();
      performanceMonitor.cleanup?.();
      lazyLoader.cleanup?.();
    });

    it('应该在内存压力下优雅降级', async () => {
      const memoryPool = new MemoryPoolManager({
        maxPoolSize: 50 * 1024 * 1024 // 限制为50MB
      });
      const cacheManager = new PluginCacheManager({
        maxSize: 20 * 1024 * 1024, // 限制为20MB
        maxItems: 1000
      });

      const { duration } = await measureTime(async () => {
        const promises = [];
        
        // 创建内存压力
        for (let i = 0; i < 20; i++) {
          promises.push(
            (async () => {
              try {
                // 尝试分配大量内存
                const allocations = [];
                for (let j = 0; j < 100; j++) {
                  const allocation = await memoryPool.allocate(1024 * 1024); // 1MB
                  allocations.push(allocation);
                }
                
                // 尝试缓存大量数据
                for (let j = 0; j < 200; j++) {
                  cacheManager.set(`pressure-key-${i}-${j}`, {
                    data: 'x'.repeat(10000), // 10KB数据
                    timestamp: Date.now()
                  });
                }
                
                // 清理一些资源
                for (let j = 0; j < 50; j++) {
                  if (allocations[j]) {
                    memoryPool.free(allocations[j]);
                  }
                }
              } catch (error) {
                // 预期在内存压力下可能出现错误
                console.log(`内存压力错误: ${error.message}`);
              }
            })()
          );
        }
        
        await Promise.all(promises);
      });

      console.log(`内存压力测试耗时: ${duration.toFixed(2)}ms`);
      
      const memoryStats = memoryPool.getStats();
      const cacheStats = cacheManager.getStats();
      
      console.log(`内存池使用: ${(memoryStats.used / 1024 / 1024).toFixed(2)}MB`);
      console.log(`缓存项数量: ${cacheStats.totalItems}`);
      
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
      
      // 清理资源
      memoryPool.cleanup?.();
      cacheManager.cleanup?.();
    });
  });
});