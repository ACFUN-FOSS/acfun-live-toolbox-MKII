import { describe, it, expect } from 'vitest';
import { setupLazyLoaderTest, lazyLoader } from '../../shared/helpers/lazy-loader-test-setup';

describe('PluginLazyLoader - 事件发射', () => {
  setupLazyLoaderTest();

  describe('事件发射', () => {
    it('应该发射插件加载开始事�?, async () => {
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
});
