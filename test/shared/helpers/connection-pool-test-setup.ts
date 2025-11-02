import { beforeEach, afterEach, vi } from 'vitest';
import { ConnectionPoolManager } from '../../../packages/main/src/plugins/ConnectionPoolManager';

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

export let connectionPool: ConnectionPoolManager;

export function setupConnectionPoolTest() {
  beforeEach(() => {
    connectionPool = new ConnectionPoolManager({
      maxConnections: 10,
      minConnections: 2,
      acquireTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      enableMetrics: true,
      enableHealthCheck: true,
      healthCheckInterval: 5000,
    });
  });

  afterEach(() => {
    connectionPool.destroy();
  });
}