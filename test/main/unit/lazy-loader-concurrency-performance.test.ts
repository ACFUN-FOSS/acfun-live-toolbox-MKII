import { describe, it, expect } from 'vitest';
import { PluginLazyLoader } from '../../../packages/main/src/plugins/PluginLazyLoader';
import { setupLazyLoaderTest, lazyLoader } from '../../shared/helpers/lazy-loader-test-setup';

describe('PluginLazyLoader - 并发控制和性能测试', () => {
  setupLazyLoaderTest();

  describe('并发控制', () => {
    it('应该限制并发加载数量', async () => {
      const concurrentLoader = new PluginLazyLoader({
        maxConcurrentLoads: 2,
        lazyLoadDelay: 50 // 增加延迟以测试并发控�?      });
      
      // 注册多个插件
      for (let i = 0; i < 5; i++) {
        concurrentLoader.registerPlugin(`concurrent-plugin-${i}`, [], 1);
      }
      
      // 同时启动所有加�?      const loadPromises = [];
      for (let i = 0; i < 5; i++) {
        loadPromises.push(concurrentLoader.loadPlugin(`concurrent-plugin-${i}`));
      }
      
      // 等待所有加载完�?      await Promise.all(loadPromises);
      
      // 检查所有插件都已加�?      const stats = concurrentLoader.getLoadStats();
      expect(stats.loadedPlugins).toBe(5);
      
      concurrentLoader.destroy();
    });
  });

  describe('性能测试', () => {
    it('应该快速处理大量插件注�?, () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        lazyLoader.registerPlugin(`perf-plugin-${i}`, [], 1);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // 100ms
      
      const stats = lazyLoader.getLoadStats();
      expect(stats.totalPlugins).toBe(100);
    });

    it('应该处理并发加载请求', async () => {
      const promises: Promise<void>[] = [];
      
      // 注册多个插件
      for (let i = 0; i < 10; i++) {
        lazyLoader.registerPlugin(`concurrent-load-plugin-${i}`, [], 1);
      }
      
      // 并发加载所有插�?      for (let i = 0; i < 10; i++) {
        promises.push(lazyLoader.loadPlugin(`concurrent-load-plugin-${i}`));
      }
      
      await Promise.all(promises);
      
      const stats = lazyLoader.getLoadStats();
      expect(stats.loadedPlugins).toBe(10);
    });
  });

  describe('清理', () => {
    it('应该正确清理资源', () => {
      const plugin1 = 'cleanup-plugin-1';
      const plugin2 = 'cleanup-plugin-2';
      
      lazyLoader.registerPlugin(plugin1, [], 1);
      lazyLoader.registerPlugin(plugin2, [], 1);
      
      let stats = lazyLoader.getLoadStats();
      expect(stats.totalPlugins).toBe(2);
      
      lazyLoader.destroy();
      
      stats = lazyLoader.getLoadStats();
      expect(stats.totalPlugins).toBe(0);
    });
  });
});
