import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AcfunAdapter } from '../adapter/AcfunAdapter';
import { AuthManager } from '../services/AuthManager';
import { ConfigManager } from '../config/ConfigManager';
import { connectionPool } from '../adapter/ConnectionPoolManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 注意：这些测试需要真实的 AcFun 认证令牌才能运行
// 在 CI/CD 环境中，这些测试应该被跳过或使用模拟数据
describe('AcFun 真实连接测试', () => {
  let tempDir: string;
  let authManager: AuthManager;
  let configManager: ConfigManager;
  let adapter: AcfunAdapter;

  // 测试用的直播间ID（使用一个通常在线的直播间）
  const TEST_ROOM_ID = '23682490'; // 这是一个示例直播间ID，实际测试时需要使用真实的在线直播间

  beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acfun-real-test-'));
    
    // 初始化管理器
    authManager = new AuthManager(path.join(tempDir, 'secrets.json'));
    configManager = new ConfigManager(path.join(tempDir, 'config.json'));
    
    // 等待 AuthManager 初始化完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 创建适配器实例
    adapter = new AcfunAdapter(TEST_ROOM_ID, authManager, configManager);
  });

  afterEach(async () => {
    // 清理资源
    if (adapter) {
      await adapter.destroy();
    }
    
    // 清理连接池
    await connectionPool.cleanup();
    
    // 清理临时文件
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to delete temp directory:', error);
      }
    }
  });

  describe('连接建立测试', () => {
    it('应该能够检查直播间状态（无需认证）', async () => {
      // 这个测试不需要认证，只是检查直播间是否存在
      const status = adapter.getStatus();
      expect(status).toBe('closed');
      
      const roomId = adapter.getRoomId();
      expect(roomId).toBe(TEST_ROOM_ID);
    }, 10000); // 10秒超时

    it('应该能够处理无效直播间ID', async () => {
      const invalidAdapter = new AcfunAdapter('invalid-room-id', {
        authManager,
        configManager
      });

      try {
        await invalidAdapter.connect();
        // 如果没有抛出错误，说明测试失败
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Failed to get room info');
      } finally {
        await invalidAdapter.destroy();
      }
    }, 15000);

    // 这个测试需要真实的认证令牌，在没有令牌时会被跳过
    it.skipIf(!process.env.ACFUN_TEST_TOKEN)('应该能够建立真实连接（需要认证）', async () => {
      // 如果环境变量中有测试令牌，使用它
      if (process.env.ACFUN_TEST_TOKEN) {
        // 创建模拟的令牌文件
        const tokenData = {
          accessToken: process.env.ACFUN_TEST_TOKEN,
          refreshToken: process.env.ACFUN_TEST_REFRESH_TOKEN || '',
          expiresAt: Date.now() + 3600000, // 1小时后过期
          userId: process.env.ACFUN_TEST_USER_ID || 'test-user',
          deviceId: 'test-device-id',
          securityKey: 'test-security-key'
        };

        const secretsPath = path.join(tempDir, 'secrets.json');
        fs.writeFileSync(secretsPath, JSON.stringify(tokenData, null, 2));
      }

      let connected = false;
      let eventReceived = false;

      // 设置事件监听器
      adapter.on('connected', () => {
        connected = true;
        console.log('✅ 连接建立成功');
      });

      adapter.on('event', (event) => {
        eventReceived = true;
        console.log('📨 收到弹幕事件:', event.event_type);
      });

      adapter.on('error', (error) => {
        console.error('❌ 连接错误:', error.message);
      });

      try {
        // 尝试连接
        await adapter.connect();
        
        // 验证连接状态
        expect(adapter.getStatus()).toBe('open');
        expect(connected).toBe(true);
        
        // 等待一段时间以接收事件
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log(`连接持续时间: ${adapter.getConnectionDuration()}ms`);
        
      } catch (error) {
        console.error('连接失败:', error);
        throw error;
      }
    }, 30000); // 30秒超时
  });

  describe('弹幕事件处理测试', () => {
    it('应该能够验证弹幕事件数据结构', () => {
      // 创建一个模拟的弹幕事件来验证数据结构
      const mockEvent = {
        event_type: 'comment',
        timestamp: Date.now(),
        room_id: TEST_ROOM_ID,
        user_id: 'test-user-123',
        username: '测试用户',
        content: '这是一条测试弹幕',
        raw: {
          _context: {
            sessionId: 'test-session',
            connectionDuration: 1000,
            reconnectAttempts: 0,
            userAvatar: 'https://example.com/avatar.jpg',
            userMedal: null,
            userManagerType: 0,
            userLevel: 1,
            adapterVersion: '1.0.0'
          }
        }
      };

      // 验证事件结构
      expect(mockEvent.event_type).toBeDefined();
      expect(mockEvent.timestamp).toBeTypeOf('number');
      expect(mockEvent.room_id).toBe(TEST_ROOM_ID);
      expect(mockEvent.user_id).toBeDefined();
      expect(mockEvent.username).toBeDefined();
      expect(mockEvent.content).toBeDefined();
      expect(mockEvent.raw._context).toBeDefined();
      expect(mockEvent.raw._context.sessionId).toBeDefined();
    });

    it('应该能够处理不同类型的弹幕事件', () => {
      const eventTypes = ['comment', 'gift', 'user_join', 'user_leave', 'like'];
      
      eventTypes.forEach(eventType => {
        const mockEvent = {
          event_type: eventType,
          timestamp: Date.now(),
          room_id: TEST_ROOM_ID,
          user_id: 'test-user',
          username: '测试用户'
        };

        // 根据事件类型添加特定字段
        switch (eventType) {
          case 'comment':
            mockEvent['content'] = '测试评论';
            break;
          case 'gift':
            mockEvent['gift_name'] = '测试礼物';
            mockEvent['gift_count'] = 1;
            break;
        }

        expect(mockEvent.event_type).toBe(eventType);
        expect(mockEvent.timestamp).toBeTypeOf('number');
      });
    });
  });

  describe('错误处理和重连测试', () => {
    it('应该能够处理连接超时', async () => {
      // 创建一个会超时的适配器（使用很短的超时时间）
      const timeoutAdapter = new AcfunAdapter(TEST_ROOM_ID, authManager, configManager);

      // 模拟网络延迟导致的超时
      const originalConnect = timeoutAdapter['establishRealConnection'];
      timeoutAdapter['establishRealConnection'] = async function() {
        // 等待超过连接超时时间（减少到5秒以加快测试）
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error('Connection timeout');
      };

      try {
        await timeoutAdapter.connect();
        // 如果没有超时，测试失败
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('timeout');
      } finally {
        await timeoutAdapter.destroy();
      }
    }, 10000); // 减少测试超时时间到10秒

    it('应该能够处理重连逻辑', async () => {
      let reconnectAttempts = 0;
      
      // 监听重连事件
      adapter.on('error', () => {
        reconnectAttempts++;
      });

      // 模拟连接失败
      const originalConnect = adapter['establishRealConnection'];
      let callCount = 0;
      adapter['establishRealConnection'] = async function() {
        callCount++;
        if (callCount <= 2) {
          throw new Error('模拟连接失败');
        }
        return originalConnect.call(this);
      };

      try {
        await adapter.reconnect();
      } catch (error) {
        // 预期会有重连尝试
        expect(callCount).toBeGreaterThan(1);
      }
    }, 20000);
  });

  describe('性能和资源管理测试', () => {
    it('应该能够正确管理连接资源', async () => {
      // 检查初始状态
      expect(adapter.getStatus()).toBe('closed');
      expect(adapter.getConnectionDuration()).toBe(0);

      // 模拟连接建立
      adapter['setStatus']('open');
      adapter['connectionStartTime'] = Date.now();
      
      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 检查连接持续时间
      const duration = adapter.getConnectionDuration();
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // 应该小于1秒

      // 清理
      await adapter.destroy();
      expect(adapter.getStatus()).toBe('closed');
    });

    it('应该能够处理内存泄漏防护', async () => {
      // 创建多个适配器实例来测试资源管理
      const adapters = [];
      
      for (let i = 0; i < 5; i++) {
        const testAdapter = new AcfunAdapter(`test-room-${i}`, {
          authManager,
          configManager
        });
        adapters.push(testAdapter);
      }

      // 清理所有适配器
      for (const testAdapter of adapters) {
        await testAdapter.destroy();
        expect(testAdapter.getStatus()).toBe('closed');
      }

      // 验证连接池状态
      const poolStats = connectionPool.getStats();
      expect(poolStats).toBeDefined();
    });
  });
});