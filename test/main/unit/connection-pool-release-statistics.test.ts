import { describe, it, expect } from 'vitest';
import { setupConnectionPoolTest, connectionPool } from '../../shared/helpers/connection-pool-test-setup';

describe('ConnectionPoolManager - 连接释放和统�?, () => {
  setupConnectionPoolTest();

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
    it('应该正确统计连接状�?, async () => {
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

    it('应该跟踪不同类型的连�?, async () => {
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
});
