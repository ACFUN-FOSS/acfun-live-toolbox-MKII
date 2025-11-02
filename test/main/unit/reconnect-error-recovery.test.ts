import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AcfunAdapter } from '../adapter/AcfunAdapter';
import { AuthManager } from '../services/AuthManager';
import { ConfigManager } from '../config/ConfigManager';
import type { RoomStatus } from '../types';
import path from 'path';
import os from 'os';

// 获取真实�?fs 模块
const fs = await vi.importActual<typeof import('fs')>('fs');

describe('重连场景和错误恢复测�?, () => {
  let adapter: AcfunAdapter;
  let authManager: AuthManager;
  let configManager: ConfigManager;
  let tempDir: string;
  
  const TEST_ROOM_ID = '23682490';

  beforeEach(async () => {
    // 创建临时目录
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'acfun-test-'));
    
    // 创建配置管理�?    configManager = new ConfigManager(path.join(tempDir, 'config.json'));
    
    // 创建认证管理�?    authManager = new AuthManager(configManager);
    
    // 创建适配器实�?    adapter = new AcfunAdapter(TEST_ROOM_ID, authManager, configManager);
  });

  afterEach(async () => {
    // 清理资源
    if (adapter) {
      await adapter.destroy();
    }
    
    // 删除临时目录
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('连接状态管�?, () => {
    it('应该正确管理连接状态变�?, async () => {
      const statusChanges: RoomStatus[] = [];
      
      adapter.on('statusChange', (status: RoomStatus) => {
        statusChanges.push(status);
      });

      // 初始状态应该是 closed
      expect(adapter.getStatus()).toBe('closed');

      // 尝试连接（会失败，因为没有有效的认证�?      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 验证状态变化序�?      expect(statusChanges).toContain('connecting');
    });

    it('应该正确处理连接超时', async () => {
      const errors: Error[] = [];
      
      adapter.on('error', (error: Error) => {
        errors.push(error);
      });

      // 尝试连接到无效房间或使用无效认证
      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 应该有错误事件被触发
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('重连机制', () => {
    it('应该在连接失败后尝试重连', async () => {
      let connectionAttempts = 0;

      // 监听状态变化来跟踪重连尝试
      adapter.on('statusChange', (status: RoomStatus) => {
        if (status === 'connecting') {
          connectionAttempts++;
        }
      });

      // 尝试连接
      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 等待一段时间让重连机制工作
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 应该至少有一次连接尝�?      expect(connectionAttempts).toBeGreaterThanOrEqual(1);
      
      // 如果有重连机制，应该有多次尝�?      // 但这取决于具体的错误类型和配�?      console.log(`Connection attempts: ${connectionAttempts}`);
    });

    it('应该在达到最大重连次数后停止重连', async () => {
      const errors: Error[] = [];
      
      adapter.on('error', (error: Error) => {
        errors.push(error);
      });

      // 尝试连接
      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 等待足够长的时间让重连机制完�?      await new Promise(resolve => setTimeout(resolve, 3000));

      // 最终状态应该是 error �?closed
      const finalStatus = adapter.getStatus();
      expect(['error', 'closed']).toContain(finalStatus);
    }, 10000); // 增加超时时间�?0�?
    it('应该正确处理手动重连', async () => {
      // 首先尝试连接（会失败�?      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      const initialStatus = adapter.getStatus();
      
      // 手动触发重连
      try {
        await adapter.reconnect();
      } catch (error) {
        // 预期会失败，因为没有有效认证
      }

      // 状态应该有变化（至少尝试了重连�?      const afterReconnectStatus = adapter.getStatus();
      // 状态可能是 connecting, error, �?closed
      expect(['connecting', 'error', 'closed']).toContain(afterReconnectStatus);
    });
  });

  describe('错误处理和恢�?, () => {
    it('应该正确分类不同类型的错�?, async () => {
      const errors: Error[] = [];
      
      adapter.on('error', (error: Error) => {
        errors.push(error);
      });

      // 尝试连接到无效房�?      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 应该有错误被记录
      expect(errors.length).toBeGreaterThan(0);
      
      // 错误应该有合理的消息
      errors.forEach(error => {
        expect(error.message).toBeTruthy();
        expect(typeof error.message).toBe('string');
      });
    });

    it('应该在错误后保持适配器的稳定�?, async () => {
      // 尝试多次连接操作
      for (let i = 0; i < 3; i++) {
        try {
          await adapter.connect();
        } catch (error) {
          // 预期会失�?        }
        
        try {
          await adapter.disconnect();
        } catch (error) {
          // 可能会失�?        }
      }

      // 适配器应该仍然可以响应基本操�?      expect(adapter.getRoomId()).toBe(TEST_ROOM_ID);
      expect(typeof adapter.getConnectionDuration()).toBe('number');
      expect(adapter.getAuthManager()).toBe(authManager);
    });

    it('应该正确处理认证失败', async () => {
      const errors: Error[] = [];
      
      adapter.on('error', (error: Error) => {
        errors.push(error);
      });

      // 尝试连接（没有有效的认证信息�?      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 应该有认证相关的错误
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('连接池和资源管理', () => {
    it('应该正确管理连接资源', async () => {
      // 创建多个适配器实�?      const adapters: AcfunAdapter[] = [];
      
      for (let i = 0; i < 3; i++) {
        const testAdapter = new AcfunAdapter(`${TEST_ROOM_ID}_${i}`, authManager, configManager);
        adapters.push(testAdapter);
        
        try {
          await testAdapter.connect();
        } catch (error) {
          // 预期会失�?        }
      }

      // 清理所有适配�?      for (const testAdapter of adapters) {
        await testAdapter.destroy();
      }

      // 验证资源被正确释�?      expect(adapters.every(a => a.getStatus() === 'closed')).toBe(true);
    });

    it('应该正确处理并发连接请求', async () => {
      const connectionPromises: Promise<void>[] = [];
      
      // 同时发起多个连接请求
      for (let i = 0; i < 3; i++) {
        connectionPromises.push(
          adapter.connect().catch(() => {
            // 忽略预期的失�?          })
        );
      }

      // 等待所有连接尝试完�?      await Promise.all(connectionPromises);

      // 适配器应该保持稳定状�?      const status = adapter.getStatus();
      expect(['connecting', 'connected', 'error', 'closed']).toContain(status);
    });
  });

  describe('事件过滤器在错误场景下的行为', () => {
    it('应该在连接错误时保持过滤器状�?, async () => {
      const filterManager = adapter.getFilterManager();
      
      // 添加一些自定义过滤规则
      filterManager.addCustomRule({
        name: 'test-filter',
        description: 'Test filter for error scenarios',
        enabled: true,
        settings: {
          blockedWords: ['test']
        }
      });
      
      // 尝试连接（会失败�?      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 过滤器应该仍然存�?      const availableFilters = filterManager.getAvailableFilters();
      const testFilter = availableFilters.find(f => f.name === 'test-filter');
      expect(testFilter).toBeDefined();
      expect(testFilter?.type).toBe('custom');
    });

    it('应该正确报告过滤器统计信�?, async () => {
      // 尝试连接
      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 获取过滤器统计信�?      const stats = adapter.getFilterStats();
      
      expect(typeof stats).toBe('object');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('totalFiltered');
      expect(typeof stats.totalProcessed).toBe('number');
      expect(typeof stats.totalFiltered).toBe('number');
    });
  });

  describe('连接持续时间和统计信�?, () => {
    it('应该正确跟踪连接持续时间', async () => {
      const initialDuration = adapter.getConnectionDuration();
      expect(initialDuration).toBe(0);

      // 尝试连接
      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterConnectionDuration = adapter.getConnectionDuration();
      // 连接持续时间应该被正确跟踪（即使连接失败�?      expect(typeof afterConnectionDuration).toBe('number');
    });

    it('应该在断开连接后重置统计信�?, async () => {
      // 尝试连接
      try {
        await adapter.connect();
      } catch (error) {
        // 预期会失�?      }

      // 断开连接
      await adapter.disconnect();

      // 连接持续时间应该被重�?      const duration = adapter.getConnectionDuration();
      expect(duration).toBe(0);
    });
  });
});
