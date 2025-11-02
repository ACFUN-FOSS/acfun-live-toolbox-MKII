import { describe, it, expect } from 'vitest';
import { PluginLazyLoader } from '../../../packages/main/src/plugins/PluginLazyLoader';
import { setupLazyLoaderTest, lazyLoader } from '../../shared/helpers/lazy-loader-test-setup';

describe('PluginLazyLoader - 初始化和插件注册', () => {
  setupLazyLoaderTest();

  describe('初始�?, () => {
    it('应该正确初始化懒加载�?, () => {
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
});
