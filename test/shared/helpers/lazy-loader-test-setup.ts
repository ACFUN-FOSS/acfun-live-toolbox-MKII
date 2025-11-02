import { beforeEach, afterEach, vi } from 'vitest';
import { PluginLazyLoader } from '../../../packages/main/src/plugins/PluginLazyLoader';

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

export let lazyLoader: PluginLazyLoader;

export function setupLazyLoaderTest() {
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
}