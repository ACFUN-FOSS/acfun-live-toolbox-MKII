import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiRetryManager } from '../../../packages/main/src/services/ApiRetryManager';
import { AuthManager } from '../../../packages/main/src/services/AuthManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ApiRetryManager与AuthManager集成测试', () => {
  let tempDir: string;
  let authManager: AuthManager;
  let apiRetryManager: ApiRetryManager;

  beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-retry-auth-test-'));
    
    // 初始化AuthManager
    authManager = new AuthManager(path.join(tempDir, 'secrets.json'));
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 初始化ApiRetryManager并与AuthManager集成
    apiRetryManager = new ApiRetryManager(authManager);
  });

  afterEach(async () => {
    // 清理资源
    if (apiRetryManager) {
      apiRetryManager.cleanup();
    }
    
    // 清理临时目录
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('基本集成功能', () => {
    it('应该正确初始化ApiRetryManager与AuthManager', () => {
      expect(apiRetryManager).toBeDefined();
      expect(apiRetryManager.getAuthManager()).toBe(authManager);
    });

    it('应该能够设置和获取AuthManager', () => {
      const newAuthManager = new AuthManager();
      apiRetryManager.setAuthManager(newAuthManager);
      expect(apiRetryManager.getAuthManager()).toBe(newAuthManager);
    });

    it('应该正确检查认证状态', () => {
      // 初始状态应该是未认证
      expect(apiRetryManager.isAuthenticated()).toBe(false);
    });
  });

  describe('API重试功能', () => {
    it('应该成功执行正常的API调用', async () => {
      const mockApiCall = vi.fn().mockResolvedValue({ success: true, data: 'test data' });
      
      const result = await apiRetryManager.executeWithRetry(
        'test_api_call',
        mockApiCall
      );
      
      expect(result).toEqual({ success: true, data: 'test data' });
      expect(mockApiCall).toHaveBeenCalledTimes(1);
    });

    it('应该在网络错误时进行重试', async () => {
      const networkError = new Error('Network error: ECONNREFUSED');
      const mockApiCall = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({ success: true, data: 'success after retry' });
      
      const result = await apiRetryManager.executeWithRetry(
        'test_network_retry',
        mockApiCall,
        { maxRetries: 3, baseDelay: 10 }
      );
      
      expect(result).toEqual({ success: true, data: 'success after retry' });
      expect(mockApiCall).toHaveBeenCalledTimes(3);
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      const persistentError = new Error('Persistent server error');
      const mockApiCall = vi.fn().mockRejectedValue(persistentError);
      
      await expect(
        apiRetryManager.executeWithRetry(
          'test_max_retries',
          mockApiCall,
          { maxRetries: 2, baseDelay: 10 }
        )
      ).rejects.toThrow('Persistent server error');
      
      expect(mockApiCall).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe('认证错误处理', () => {
    it('应该检测到401认证错误', async () => {
      const authError = new Error('HTTP 401: Unauthorized');
      const mockApiCall = vi.fn().mockRejectedValue(authError);
      
      // 监听认证刷新失败事件
      const authRefreshFailedPromise = new Promise((resolve) => {
        apiRetryManager.once('auth-refresh-failed', resolve);
      });
      
      await expect(
        apiRetryManager.executeWithRetry(
          'test_auth_error',
          mockApiCall,
          { maxRetries: 1, baseDelay: 10 }
        )
      ).rejects.toThrow('HTTP 401: Unauthorized');
      
      // 验证认证刷新失败事件被触发
      const authRefreshFailedEvent = await authRefreshFailedPromise;
      expect(authRefreshFailedEvent).toBeDefined();
      expect((authRefreshFailedEvent as any).key).toBe('test_auth_error');
    });

    it('应该检测到403认证错误', async () => {
      const authError = new Error('HTTP 403: Forbidden');
      const mockApiCall = vi.fn().mockRejectedValue(authError);
      
      // 监听认证刷新失败事件
      const authRefreshFailedPromise = new Promise((resolve) => {
        apiRetryManager.once('auth-refresh-failed', resolve);
      });
      
      await expect(
        apiRetryManager.executeWithRetry(
          'test_forbidden_error',
          mockApiCall,
          { maxRetries: 1, baseDelay: 10 }
        )
      ).rejects.toThrow('HTTP 403: Forbidden');
      
      // 验证认证刷新失败事件被触发
      const authRefreshFailedEvent = await authRefreshFailedPromise;
      expect(authRefreshFailedEvent).toBeDefined();
      expect((authRefreshFailedEvent as any).key).toBe('test_forbidden_error');
    });

    it('应该在认证错误时尝试刷新token', async () => {
      const authError = new Error('unauthorized access');
      const mockApiCall = vi.fn().mockRejectedValue(authError);
      
      // Mock AuthManager的refreshToken方法
      const mockRefreshToken = vi.fn().mockResolvedValue({
        success: false,
        message: 'Token refresh failed'
      });
      authManager.refreshToken = mockRefreshToken;
      
      await expect(
        apiRetryManager.executeWithRetry(
          'test_token_refresh',
          mockApiCall,
          { maxRetries: 1, baseDelay: 10 }
        )
      ).rejects.toThrow('unauthorized access');
      
      // 验证refreshToken被调用
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('事件发射', () => {
    it('应该发射重试尝试事件', async () => {
      const error = new Error('Temporary error');
      const mockApiCall = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ success: true });
      
      const retryAttemptEvents: any[] = [];
      apiRetryManager.on('retry-attempt', (data) => {
        retryAttemptEvents.push(data);
      });
      
      await apiRetryManager.executeWithRetry(
        'test_retry_events',
        mockApiCall,
        { maxRetries: 2, baseDelay: 10 }
      );
      
      expect(retryAttemptEvents).toHaveLength(1);
      expect(retryAttemptEvents[0].key).toBe('test_retry_events');
      expect(retryAttemptEvents[0].attempt).toBe(1);
    });

    it('应该发射重试成功事件', async () => {
      const error = new Error('Temporary error');
      const mockApiCall = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ success: true });
      
      const retrySuccessPromise = new Promise((resolve) => {
        apiRetryManager.once('retry-success', resolve);
      });
      
      await apiRetryManager.executeWithRetry(
        'test_success_event',
        mockApiCall,
        { maxRetries: 2, baseDelay: 10 }
      );
      
      const successEvent = await retrySuccessPromise;
      expect(successEvent).toBeDefined();
      expect((successEvent as any).key).toBe('test_success_event');
      expect((successEvent as any).attempts).toBe(2);
    });

    it('应该发射重试失败事件', async () => {
      const error = new Error('Persistent error');
      const mockApiCall = vi.fn().mockRejectedValue(error);
      
      const retryFailedPromise = new Promise((resolve) => {
        apiRetryManager.once('retry-failed', resolve);
      });
      
      await expect(
        apiRetryManager.executeWithRetry(
          'test_failure_event',
          mockApiCall,
          { maxRetries: 1, baseDelay: 10 }
        )
      ).rejects.toThrow('Persistent error');
      
      const failureEvent = await retryFailedPromise;
      expect(failureEvent).toBeDefined();
      expect((failureEvent as any).key).toBe('test_failure_event');
      expect((failureEvent as any).attempts).toBe(2);
    });
  });

  describe('统计信息', () => {
    it('应该正确记录重试统计信息', async () => {
      const error = new Error('Test error');
      const mockApiCall = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ success: true });
      
      await apiRetryManager.executeWithRetry(
        'test_stats',
        mockApiCall,
        { maxRetries: 3, baseDelay: 10 }
      );
      
      const stats = apiRetryManager.getRetryStats('test_stats');
      expect(stats).toBeDefined();
      expect(stats!.totalAttempts).toBe(3);
      expect(stats!.totalRetries).toBe(2);
      expect(stats!.successCount).toBe(1);
      expect(stats!.failureCount).toBe(0);
    });

    it('应该正确记录失败统计信息', async () => {
      const error = new Error('Persistent error');
      const mockApiCall = vi.fn().mockRejectedValue(error);
      
      await expect(
        apiRetryManager.executeWithRetry(
          'test_failure_stats',
          mockApiCall,
          { maxRetries: 2, baseDelay: 10 }
        )
      ).rejects.toThrow('Persistent error');
      
      const stats = apiRetryManager.getRetryStats('test_failure_stats');
      expect(stats).toBeDefined();
      expect(stats!.totalAttempts).toBe(3);
      expect(stats!.totalRetries).toBe(2);
      expect(stats!.successCount).toBe(0);
      expect(stats!.failureCount).toBe(1);
    });
  });

  describe('清理功能', () => {
    it('应该正确清理所有重试记录', async () => {
      const error = new Error('Test error');
      const mockApiCall = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ success: true });
      
      await apiRetryManager.executeWithRetry(
        'test_cleanup',
        mockApiCall,
        { maxRetries: 2, baseDelay: 10 }
      );
      
      // 验证统计信息存在
      expect(apiRetryManager.getRetryStats('test_cleanup')).toBeDefined();
      
      // 清理
      apiRetryManager.clearAll();
      
      // 验证统计信息被清理
      expect(apiRetryManager.getRetryStats('test_cleanup')).toBeUndefined();
    });
  });
});