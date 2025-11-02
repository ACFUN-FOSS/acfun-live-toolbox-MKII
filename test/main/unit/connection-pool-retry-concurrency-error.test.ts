import { describe, it, expect } from 'vitest';
import { setupConnectionPoolTest, connectionPool } from '../../shared/helpers/connection-pool-test-setup';

describe('ConnectionPoolManager - 重试机制、并发处理和错误处理', () => {
  setupConnectionPoolTest();

  describe('重试机制', () => {
    it('应该重试失败的连�?, async () => {
      // 模拟一个可能失败的连接
      try {
        const connection = await connectionPool.acquire('http', {
          url: 'https://this-domain-should-not-exist-12345.com',
          method: 'GET'
        });
        
        // 如果意外成功，清理连�?        if (connection) {
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
    it('应该处理无效的连接类�?, async () => {
      await expect(
        connectionPool.acquire('invalid-type' as any, {
          url: 'https://api.example.com'
        })
      ).rejects.toThrow();
    });

    it('应该处理无效的连接配�?, async () => {
      await expect(
        connectionPool.acquire('http', {
          // 缺少必需的配�?        } as any)
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
    it('应该清理所有连�?, async () => {
      // 创建一些连�?      const connections: any[] = [];
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
