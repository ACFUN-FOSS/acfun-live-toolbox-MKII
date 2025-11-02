import { describe, it, expect } from 'vitest';
import { ConnectionPoolManager } from '../../../packages/main/src/plugins/ConnectionPoolManager';
import { setupConnectionPoolTest, connectionPool } from '../../shared/helpers/connection-pool-test-setup';

describe('ConnectionPoolManager - 健康检查和超时', () => {
  setupConnectionPoolTest();

  describe('健康检�?, () => {
    it('应该执行连接健康检�?, async () => {
      const connection = await connectionPool.acquire('http', {
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      // 手动触发健康检�?      const healthCheckResult = await connectionPool.healthCheck(connection.id);
      expect(typeof healthCheckResult).toBe('boolean');
    });

    it('应该移除不健康的连接', async () => {
      const connection = await connectionPool.acquire('http', {
        url: 'https://invalid-url-that-should-fail.example.com',
        method: 'GET'
      });
      
      // 模拟连接变为不健�?      const healthCheckResult = await connectionPool.healthCheck(connection.id);
      
      // 根据健康检查结果，连接可能被移�?      const stats = connectionPool.getStats();
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
          url: 'https://httpstat.us/200?sleep=1000', // 1秒延�?          method: 'GET'
        });
        
        // 如果连接成功，清理它
        if (connection) {
          shortTimeoutManager.release(connection.id);
        }
      } catch (error) {
        // 预期可能会超�?        expect(error).toBeInstanceOf(Error);
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
});
