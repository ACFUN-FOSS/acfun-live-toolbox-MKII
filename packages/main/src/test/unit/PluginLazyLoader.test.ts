import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginLazyLoader } from '../../plugins/PluginLazyLoader';

// Mock fs module for PluginLogger
vi.mock('fs', () => ({
  appendFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 1000 })),
  readFileSync: vi.fn(() => ''),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(() => [])
}));

describe('PluginLazyLoader', () => {
  let lazyLoader: PluginLazyLoader;

  beforeEach(() => {
    lazyLoader = new PluginLazyLoader({
      maxConcurrentLoads: 3,
      lazyLoadDelay: 10, // 减少测试时间
      enablePredictiveLoading: true,
      memoryPressureThreshold: 100 * 1024 * 1024, // 100MB
      enableProgressiveLoading: true,
      preloadPriority: ['priority-plugin']
    });
  });

  afterEach(() => {
    lazyLoader.destroy();
  });

  describe('初始化', () => {
    it('应该正确初始化懒加载器', () => {
      expect(lazyLoader).toBeDefined();
      const stats = lazyLoader.getLoadStats();
      expect(stats.totalPlugins).toBe(0);
      expect(stats.loadedPlugins).toBe(0);
      expect(stats.activeLoads).toBe(0);
      expect(stats.queueLength).toBe(0);
    });

    it('应该使用默认配置', () => {
      const defaultLoader = new PluginLazyLoader();
      expect(defaultLoader).toBeDefined();
      const stats = defaultLoader.getLoadStats();
      expect(stats).toBeDefined();
      defaultLoader.destroy();
    });
  });

  describe('插件注册', () => {
    it('应该能够注册插件', () => {
      const pluginId = 'test-plugin';
      
      lazyLoader.registerPlugin(pluginId, [], 1);
      
      const stats = lazyLoader.getLoadStats();
      expect(stats.totalPlugins).toBe(1);
      
      const pluginState = lazyLoader.getPluginState(pluginId);
      expect(pluginState).toBeDefined();
      expect(pluginState!.state).toBe('unloaded');
      expect(pluginState!.priority).toBe(1);
      expect(pluginState!.dependencies).toEqual([]);
    });

    it('应该能够注册带依赖的插件', () => {
      const pluginId = 'main-plugin';
      const dependencies = ['dep1', 'dep2'];
      
      lazyLoader.registerPlugin(pluginId, dependencies, 2);
      
      const pluginState = lazyLoader.getPluginState(pluginId);
      expect(pluginState).toBeDefined();
      expect(pluginState!.dependencies).toEqual(dependencies);
      expect(pluginState!.priority).toBe(2);
    });

    it('应该处理重复注册', () => {
      const pluginId = 'duplicate-plugin';
      
      lazyLoader.registerPlugin(pluginId, [], 1);
      lazyLoader.registerPlugin(pluginId, ['dep1'], 2);
      
      const stats = lazyLoader.getLoadStats();
      expect(stats.totalPlugins).toBe(1);
      
      const pluginState = lazyLoader.getPluginState(pluginId);
      expect(pluginState!.priority).toBe(2); // 应该使用最新的配置
      expect(pluginState!.dependencies).toEqual(['dep1']);
    });

    it('应该验证插件ID', () => {
      expect(() => lazyLoader.registerPlugin('', [])).toThrow();
    });
  });

  describe('插件加载', () => {
    it('应该能够加载插件', async () => {
      const pluginId = 'loadable-plugin';
      
      lazyLoader.registerPlugin(pluginId, [], 1);
      
      await lazyLoader.loadPlugin(pluginId);
      
      const pluginState = lazyLoader.getPluginState(pluginId);
      expect(pluginState!.state).toBe('loaded');
      expect(pluginState!.loadTime).toBeDefined();
      expect(pluginState!.accessCount).toBe(1);
    });

    it('应该处理未注册的插件', async () => {
      const pluginId = 'unregistered-plugin';
      
      await expect(lazyLoader.loadPlugin(pluginId)).rejects.toThrow(
        `Plugin ${pluginId} not registered for lazy loading`
      );
    });

    it('应该处理重复加载', async () => {
      const pluginId = 'duplicate-load-plugin';
      
      lazyLoader.registerPlugin(pluginId, [], 1);
      
      // 第一次加载
      await lazyLoader.loadPlugin(pluginId);
      
      const state1 = lazyLoader.getPluginState(pluginId);
      expect(state1!.state).toBe('loaded');
      expect(state1!.accessCount).toBe(1);
      
      // 第二次加载应该直接返回
      await lazyLoader.loadPlugin(pluginId);
      
      const state2 = lazyLoader.getPluginState(pluginId);
      expect(state2!.state).toBe('loaded');
      expect(state2!.accessCount).toBe(2);
    });

    it('应该按依赖顺序加载插件', async () => {
      const dep1Id = 'dependency-1';
      const dep2Id = 'dependency-2';
      const mainId = 'main-plugin';
      
      // 注册依赖插件
      lazyLoader.registerPlugin(dep1Id, [], 1);
      lazyLoader.registerPlugin(dep2Id, [], 1);
      
      // 注册主插件，依赖于前两个插件
      lazyLoader.registerPlugin(mainId, [dep1Id, dep2Id], 2);
      
      // 加载主插件
      await lazyLoader.loadPlugin(mainId);
      
      // 检查所有插件都已加载
      expect(lazyLoader.getPluginState(dep1Id)!.state).toBe('loaded');
      expect(lazyLoader.getPluginState(dep2Id)!.state).toBe('loaded');
      expect(lazyLoader.getPluginState(mainId)!.state).toBe('loaded');
    });

    it('应该处理缺失的依赖', async () => {
      const pluginId = 'missing-dep-plugin';
      
      lazyLoader.registerPlugin(pluginId, ['non-existent-dep'], 1);
      
      await expect(lazyLoader.loadPlugin(pluginId)).rejects.toThrow(
        'Dependency non-existent-dep not found for plugin missing-dep-plugin'
      );
    });
  });

  describe('插件卸载', () => {
    it('应该能够卸载插件', async () => {
      const pluginId = 'unloadable-plugin';
      
      lazyLoader.registerPlugin(pluginId, [], 1);
      await lazyLoader.loadPlugin(pluginId);
      
      expect(lazyLoader.getPluginState(pluginId)!.state).toBe('loaded');
      
      await lazyLoader.unloadPlugin(pluginId);
      
      expect(lazyLoader.getPluginState(pluginId)!.state).toBe('unloaded');
    });

    it('应该处理未加载插件的卸载', async () => {
      const pluginId = 'not-loaded-plugin';
      
      lazyLoader.registerPlugin(pluginId, [], 1);
      
      // 卸载未加载的插件应该不抛出错误
      await expect(lazyLoader.unloadPlugin(pluginId)).resolves.not.toThrow();
    });
  });

  describe('插件暂停和恢复', () => {
    it('应该能够暂停插件', async () => {
      const pluginId = 'suspendable-plugin';
      
      lazyLoader.registerPlugin(pluginId, [], 1);
      await lazyLoader.loadPlugin(pluginId);
      
      expect(lazyLoader.getPluginState(pluginId)!.state).toBe('loaded');
      
      await lazyLoader.suspendPlugin(pluginId, 'test suspension');
      
      expect(lazyLoader.getPluginState(pluginId)!.state).toBe('suspended');
    });

    it('应该能够恢复插件', async () => {
      const pluginId = 'resumable-plugin';
      
      lazyLoader.registerPlugin(pluginId, [], 1);
      await lazyLoader.loadPlugin(pluginId);
      await lazyLoader.suspendPlugin(pluginId, 'test suspension');
      
      expect(lazyLoader.getPluginState(pluginId)!.state).toBe('suspended');
      
      await lazyLoader.resumePlugin(pluginId);
      
      expect(lazyLoader.getPluginState(pluginId)!.state).toBe('loaded');
    });
  });

  describe('状态查询', () => {
    it('应该提供正确的加载统计', async () => {
      const plugin1 = 'stats-plugin-1';
      const plugin2 = 'stats-plugin-2';
      const plugin3 = 'stats-plugin-3';
      
      lazyLoader.registerPlugin(plugin1, [], 1);
      lazyLoader.registerPlugin(plugin2, [], 1);
      lazyLoader.registerPlugin(plugin3, [], 1);
      
      let stats = lazyLoader.getLoadStats();
      expect(stats.totalPlugins).toBe(3);
      expect(stats.loadedPlugins).toBe(0);
      
      await lazyLoader.loadPlugin(plugin1);
      await lazyLoader.loadPlugin(plugin2);
      
      stats = lazyLoader.getLoadStats();
      expect(stats.totalPlugins).toBe(3);
      expect(stats.loadedPlugins).toBe(2);
      
      await lazyLoader.suspendPlugin(plugin1, 'test');
      
      stats = lazyLoader.getLoadStats();
      expect(stats.suspendedPlugins).toBe(1);
    });

    it('应该提供所有插件状态', () => {
      const plugin1 = 'all-states-plugin-1';
      const plugin2 = 'all-states-plugin-2';
      
      lazyLoader.registerPlugin(plugin1, [], 1);
      lazyLoader.registerPlugin(plugin2, ['dep'], 2);
      
      const allStates = lazyLoader.getAllPluginStates();
      expect(allStates).toHaveLength(2);
      
      const state1 = allStates.find(s => s.pluginId === plugin1);
      const state2 = allStates.find(s => s.pluginId === plugin2);
      
      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1!.priority).toBe(1);
      expect(state2!.priority).toBe(2);
      expect(state2!.dependencies).toEqual(['dep']);
    });

    it('应该返回null对于不存在的插件', () => {
      const state = lazyLoader.getPluginState('non-existent-plugin');
      expect(state).toBeNull();
    });
  });

  describe('事件发射', () => {
    it('应该发射插件加载开始事件', async () => {
      const pluginId = 'event-plugin';
      let eventReceived = false;
      
      lazyLoader.on('plugin-load-started', (data) => {
        expect(data.pluginId).toBe(pluginId);
        expect(data.priority).toBe(0);
        eventReceived = true;
      });
      
      lazyLoader.registerPlugin(pluginId, [], 0);
      await lazyLoader.loadPlugin(pluginId);
      
      expect(eventReceived).toBe(true);
    });

    it('应该发射插件加载完成事件', async () => {
      const pluginId = 'completion-event-plugin';
      let eventReceived = false;
      
      lazyLoader.on('plugin-load-completed', (data) => {
        expect(data.pluginId).toBe(pluginId);
        expect(data.loadTime).toBeGreaterThan(0);
        eventReceived = true;
      });
      
      lazyLoader.registerPlugin(pluginId, [], 0);
      await lazyLoader.loadPlugin(pluginId);
      
      expect(eventReceived).toBe(true);
    });

    it('应该发射插件暂停事件', async () => {
      const pluginId = 'suspend-event-plugin';
      let eventReceived = false;
      
      lazyLoader.on('plugin-suspended', (data) => {
        expect(data.pluginId).toBe(pluginId);
        expect(data.reason).toBe('test reason');
        eventReceived = true;
      });
      
      lazyLoader.registerPlugin(pluginId, [], 0);
      await lazyLoader.loadPlugin(pluginId);
      await lazyLoader.suspendPlugin(pluginId, 'test reason');
      
      expect(eventReceived).toBe(true);
    });

    it('应该发射插件恢复事件', async () => {
      const pluginId = 'resume-event-plugin';
      let eventReceived = false;
      
      lazyLoader.on('plugin-resumed', (data) => {
        expect(data.pluginId).toBe(pluginId);
        eventReceived = true;
      });
      
      lazyLoader.registerPlugin(pluginId, [], 0);
      await lazyLoader.loadPlugin(pluginId);
      await lazyLoader.suspendPlugin(pluginId, 'test');
      await lazyLoader.resumePlugin(pluginId);
      
      expect(eventReceived).toBe(true);
    });
  });

  describe('并发控制', () => {
    it('应该限制并发加载数量', async () => {
      const concurrentLoader = new PluginLazyLoader({
        maxConcurrentLoads: 2,
        lazyLoadDelay: 50 // 增加延迟以测试并发控制
      });
      
      // 注册多个插件
      for (let i = 0; i < 5; i++) {
        concurrentLoader.registerPlugin(`concurrent-plugin-${i}`, [], 1);
      }
      
      // 同时启动所有加载
      const loadPromises = [];
      for (let i = 0; i < 5; i++) {
        loadPromises.push(concurrentLoader.loadPlugin(`concurrent-plugin-${i}`));
      }
      
      // 等待所有加载完成
      await Promise.all(loadPromises);
      
      // 检查所有插件都已加载
      const stats = concurrentLoader.getLoadStats();
      expect(stats.loadedPlugins).toBe(5);
      
      concurrentLoader.destroy();
    });
  });

  describe('性能测试', () => {
    it('应该快速处理大量插件注册', () => {
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
      
      // 并发加载所有插件
      for (let i = 0; i < 10; i++) {
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