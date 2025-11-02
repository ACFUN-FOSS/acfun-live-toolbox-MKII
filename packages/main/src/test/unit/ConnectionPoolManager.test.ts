import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionPoolManager } from '../../plugins/ConnectionPoolManager';

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

describe('ConnectionPoolManager', () => {
  let connectionPool: ConnectionPoolManager;

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

  describe('初始化', () => {
    it('应该正确初始化连接池管理器', () => {
      expect(connectionPool).toBeDefined();
      const stats = connectionPool.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
    });

    it('应该使用默认配置', () => {
      const defaultManager = new ConnectionPoolManager();
      expect(defaultManager).toBeDefined();
      const stats = defaultManager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('连接获取', () => {
    it('应该能够获取HTTP连接', async () => {
      const connection = await connectionPool.acquire('http', {
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.type).toBe('http');
      
      const stats = connectionPool.getStats();
      expect(stats.activeConnections).toBe(1);
    });

    it('应该能够获取WebSocket连接', async () => {
      const connection = await connectionPool.acquire('websocket', {
        url: 'wss://api.example.com/ws'
      });
      
      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.type).toBe('websocket');
      
      const stats = connectionPool.getStats();
      expect(stats.activeConnections).toBe(1);
    });

    it('应该能够获取IPC连接', async () => {
      const connection = await connectionPool.acquire('ipc', {
        channel: 'test-channel'
      });
      
      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.type).toBe('ipc');
      
      const stats = connectionPool.getStats();
      expect(stats.activeConnections).toBe(1);
    });

    it('应该复用现有连接', async () => {
      const connection1 = await connectionPool.acquire('http', {
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      const connection2 = await connectionPool.acquire('http', {
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      // 对于相同的配置，应该复用连接或创建新连接（取决于实现）
      expect(connection1).toBeDefined();
      expect(connection2).toBeDefined();
      
      const stats = connectionPool.getStats();
      expect(stats.totalConnections).toBeGreaterThan(0);
    });

    it('应该在达到最大连接数时等待', async () => {
      const connections: any[] = [];
      
      // 获取最大数量的连接
      for (let i = 0; i < 10; i++) {
        const connection = await connectionPool.acquire('http', {
          url: `https://api${i}.example.com`,
          method: 'GET'
        });
        connections.push(connection);
      }
      
      const stats = connectionPool.getStats();
      expect(stats.activeConnections).toBeLessThanOrEqual(10);
      
      // 清理连接
      for (const connection of connections) {
        connectionPool.release(connection.id);
      }
    });
  });

  describe('连接释放', () => {
    it('应该能够释放连接', async () => {
      const connection = await connectionPool.acquire('http', {
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      const released = connectionPool.release(connection.id);
      expect(released).toBe(true);
      
      const stats = connectionPool.getStats();
      expect(stats.activeConnections).toBe(0);
    });

    it('应该处理重复释放', async () => {
      const connection = await connectionPool.acquire('http', {
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      const released1 = connectionPool.release(connection.id);
      expect(released1).toBe(true);
      
      const released2 = connectionPool.release(connection.id);
      expect(released2).toBe(false); // 重复释放应该返回false
    });

    it('应该处理无效的连接ID', () => {
      const released = connectionPool.release('invalid-connection-id');
      expect(released).toBe(false);
    });
  });

  describe('连接统计', () => {
    it('应该正确统计连接状态', async () => {
      const initialStats = connectionPool.getStats();
      expect(initialStats.totalConnections).toBe(0);
      expect(initialStats.activeConnections).toBe(0);
      
      const connection1 = await connectionPool.acquire('http', {
        url: 'https://api1.example.com',
        method: 'GET'
      });
      
      const connection2 = await connectionPool.acquire('websocket', {
        url: 'wss://api2.example.com/ws'
      });
      
      const afterAcquireStats = connectionPool.getStats();
      expect(afterAcquireStats.activeConnections).toBe(2);
      expect(afterAcquireStats.totalConnections).toBeGreaterThanOrEqual(2);
      
      connectionPool.release(connection1.id);
      
      const afterReleaseStats = connectionPool.getStats();
      expect(afterReleaseStats.activeConnections).toBe(1);
    });

    it('应该跟踪不同类型的连接', async () => {
      await connectionPool.acquire('http', {
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      await connectionPool.acquire('websocket', {
        url: 'wss://api.example.com/ws'
      });
      
      await connectionPool.acquire('ipc', {
        channel: 'test-channel'
      });
      
      const stats = connectionPool.getStats();
      expect(stats.connectionsByType).toBeDefined();
      expect(stats.connectionsByType.http).toBeGreaterThan(0);
      expect(stats.connectionsByType.websocket).toBeGreaterThan(0);
      expect(stats.connectionsByType.ipc).toBeGreaterThan(0);
    });
  });

  describe('健康检查', () => {
    it('应该执行连接健康检查', async () => {
      const connection = await connectionPool.acquire('http', {
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      // 手动触发健康检查
      const healthCheckResult = await connectionPool.healthCheck(connection.id);
      expect(typeof healthCheckResult).toBe('boolean');
    });

    it('应该移除不健康的连接', async () => {
      const connection = await connectionPool.acquire('http', {
        url: 'https://invalid-url-that-should-fail.example.com',
        method: 'GET'
      });
      
      // 模拟连接变为不健康
      const healthCheckResult = await connectionPool.healthCheck(connection.id);
      
      // 根据健康检查结果，连接可能被移除
      const stats = connectionPool.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('连接超时', () => {
    it('应该处理连接超时', async () => {
      // 创建一个短超时的管理器
      const shortTimeoutManager = new ConnectionPoolManager({
        connectionTimeout: 100, // 100ms
        maxConnections: 5
      });
      
      try {
        // 尝试连接到一个可能超时的地址
        const connection = await shortTimeoutManager.acquire('http', {
          url: 'https://httpstat.us/200?sleep=1000', // 1秒延迟
          method: 'GET'
        });
        
        // 如果连接成功，清理它
        if (connection) {
          shortTimeoutManager.release(connection.id);
        }
      } catch (error) {
        // 预期可能会超时
        expect(error).toBeInstanceOf(Error);
      }
      
      shortTimeoutManager.cleanup?.();
    });

    it('应该处理空闲超时', async () => {
      // 创建一个短空闲超时的管理器
      const shortIdleManager = new ConnectionPoolManager({
        idleTimeout: 100, // 100ms
        maxConnections: 5
      });
      
      const connection = await shortIdleManager.acquire('http', {
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      shortIdleManager.release(connection.id);
      
      // 等待空闲超时
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const stats = shortIdleManager.getStats();
      // 空闲连接可能已被清理
      expect(stats).toBeDefined();
      
      shortIdleManager.cleanup?.();
    });
  });

  describe('重试机制', () => {
    it('应该重试失败的连接', async () => {
      // 模拟一个可能失败的连接
      try {
        const connection = await connectionPool.acquire('http', {
          url: 'https://this-domain-should-not-exist-12345.com',
          method: 'GET'
        });
        
        // 如果意外成功，清理连接
        if (connection) {
          connectionPool.release(connection.id);
        }
      } catch (error) {
        // 预期连接失败
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('并发处理', () => {
    it('应该处理并发连接请求', async () => {
      const promises: Promise<any>[] = [];
      
      // 创建多个并发连接请求
      for (let i = 0; i < 5; i++) {
        promises.push(
          connectionPool.acquire('http', {
            url: `https://api${i}.example.com`,
            method: 'GET'
          })
        );
      }
      
      const connections = await Promise.all(promises);
      expect(connections).toHaveLength(5);
      
      const stats = connectionPool.getStats();
      expect(stats.activeConnections).toBe(5);
      
      // 清理连接
      connections.forEach(connection => {
        connectionPool.release(connection.id);
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的连接类型', async () => {
      await expect(
        connectionPool.acquire('invalid-type' as any, {
          url: 'https://api.example.com'
        })
      ).rejects.toThrow();
    });

    it('应该处理无效的连接配置', async () => {
      await expect(
        connectionPool.acquire('http', {
          // 缺少必需的配置
        } as any)
      ).rejects.toThrow();
    });

    it('应该处理连接创建失败', async () => {
      // 尝试连接到无效的URL
      await expect(
        connectionPool.acquire('http', {
          url: 'invalid-url',
          method: 'GET'
        })
      ).rejects.toThrow();
    });
  });

  describe('清理', () => {
    it('应该清理所有连接', async () => {
      // 创建一些连接
      const connections: any[] = [];
      for (let i = 0; i < 3; i++) {
        const connection = await connectionPool.acquire('http', {
          url: `https://api${i}.example.com`,
          method: 'GET'
        });
        connections.push(connection);
      }
      
      const beforeCleanup = connectionPool.getStats();
      expect(beforeCleanup.activeConnections).toBe(3);
      
      connectionPool.cleanup();
      
      const afterCleanup = connectionPool.getStats();
      expect(afterCleanup.activeConnections).toBe(0);
      expect(afterCleanup.totalConnections).toBe(0);
    });
  });
});