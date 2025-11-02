import { describe, it, expect } from 'vitest';
import { setupLazyLoaderTest, lazyLoader } from '../../shared/helpers/lazy-loader-test-setup';

describe('PluginLazyLoader - 插件暂停恢复和状态查�?, () => {
  setupLazyLoaderTest();

  describe('插件暂停和恢�?, () => {
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

  describe('状态查�?, () => {
    it('应该提供正确的加载统�?, async () => {
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

    it('应该提供所有插件状�?, () => {
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
});
