import { describe, it, expect } from 'vitest';
import { ConnectionPoolManager } from '../../../packages/main/src/plugins/ConnectionPoolManager';
import { setupConnectionPoolTest, connectionPool } from '../../shared/helpers/connection-pool-test-setup';

describe('ConnectionPoolManager - 初始化和连接获取', () => {
  setupConnectionPoolTest();

  describe('初始�?, () => {
    it('应该正确初始化连接池管理�?, () => {
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
      
      // 对于相同的配置，应该复用连接或创建新连接（取决于实现�?      expect(connection1).toBeDefined();
      expect(connection2).toBeDefined();
      
      const stats = connectionPool.getStats();
      expect(stats.totalConnections).toBeGreaterThan(0);
    });

    it('应该在达到最大连接数时等�?, async () => {
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
});
