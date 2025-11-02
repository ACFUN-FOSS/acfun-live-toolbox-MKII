import { beforeEach, afterEach } from 'vitest';
import { PluginCacheManager } from '../../../packages/main/src/plugins/PluginCacheManager';

export let cacheManager: PluginCacheManager;

export function setupCacheManagerTest() {
  beforeEach(() => {
    cacheManager = new PluginCacheManager({
      maxSize: 1024 * 1024, // 1MB
      defaultTTL: 5000, // 5 seconds
      cleanupInterval: 1000, // 1 second
      maxItems: 100,
      enableLRU: true,
      enableCompression: false
    });
  });

  afterEach(() => {
    cacheManager.cleanup?.();
  });
}