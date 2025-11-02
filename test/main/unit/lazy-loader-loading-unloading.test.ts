import { describe, it, expect } from 'vitest';
import { setupLazyLoaderTest, lazyLoader } from '../../shared/helpers/lazy-loader-test-setup';

describe('PluginLazyLoader - 插件加载和卸�?, () => {
  setupLazyLoaderTest();

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
      
      // 第一次加�?
      await lazyLoader.loadPlugin(pluginId);
      
      const state1 = lazyLoader.getPluginState(pluginId);
      expect(state1!.state).toBe('loaded');
      expect(state1!.accessCount).toBe(1);
      
      // 第二次加载应该直接返�?
      await lazyLoader.loadPlugin(pluginId);
      
      const state2 = lazyLoader.getPluginState(pluginId);
      expect(state2!.state).toBe('loaded');
      expect(state2!.accessCount).toBe(2);
    });

    it('应该按依赖顺序加载插�?, async () => {
      const dep1Id = 'dependency-1';
      const dep2Id = 'dependency-2';
      const mainId = 'main-plugin';
      
      // 注册依赖插件
      lazyLoader.registerPlugin(dep1Id, [], 1);
      lazyLoader.registerPlugin(dep2Id, [], 1);
      
      // 注册主插件，依赖于前两个插件
      lazyLoader.registerPlugin(mainId, [dep1Id, dep2Id], 2);
      
      // 加载主插�?
      await lazyLoader.loadPlugin(mainId);
      
      // 检查所有插件都已加�?
      expect(lazyLoader.getPluginState(dep1Id)!.state).toBe('loaded');
      expect(lazyLoader.getPluginState(dep2Id)!.state).toBe('loaded');
      expect(lazyLoader.getPluginState(mainId)!.state).toBe('loaded');
    });

    it('应该处理缺失的依�?, async () => {
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
      
      // 卸载未加载的插件应该不抛出错�?
      await expect(lazyLoader.unloadPlugin(pluginId)).resolves.not.toThrow();
    });
  });
});
