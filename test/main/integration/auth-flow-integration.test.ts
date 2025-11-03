import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../../../packages/main/src/services/AuthManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 不要 mock acfunlive-http-api，使用真实的实现
describe('认证流程集成测试', () => {
  let tempDir: string;
  let authManager: AuthManager;

  beforeEach(() => {
    // 创建临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-flow-test-'));
    
    // 创建真实的 AuthManager 实例
    authManager = new AuthManager(path.join(tempDir, 'secrets.json'));
  });

  afterEach(() => {
    // 清理临时文件
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // 销毁 AuthManager
    authManager.destroy();
  });

  describe('二维码登录流程', () => {
    it('应该能够启动二维码登录', async () => {
      const result = await authManager.loginWithQRCode();
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      
      if (result.success) {
        expect(result.qrCode).toBeDefined();
        expect(result.qrCode.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
        expect(result.qrCode.expiresIn).toBeGreaterThan(0);
        
        // 立即显示二维码
        console.log('\n=== 二维码登录 ===');
        console.log('二维码数据URL:', result.qrCode.qrCodeDataUrl);
        console.log('过期时间:', result.qrCode.expiresIn, '秒');
        console.log('请使用AcFun手机客户端扫描二维码登录');
        console.log('==================\n');
      } else {
        // 如果失败，应该有错误信息
        expect(result.error).toBeDefined();
        console.log('QR login failed (expected in test environment):', result.error);
      }
    }, 30000);

    it('应该能够检查二维码登录状态', async () => {
      // 首先启动二维码登录
      const loginResult = await authManager.loginWithQRCode();
      
      if (loginResult.success) {
        // 立即显示二维码
        console.log('\n=== 二维码登录状态检查 ===');
        console.log('二维码数据URL:', loginResult.qrCode.qrCodeDataUrl);
        console.log('过期时间:', loginResult.qrCode.expiresIn, '秒');
        console.log('请使用AcFun手机客户端扫描二维码登录');
        console.log('正在检查登录状态...');
        console.log('========================\n');
        
        // 检查登录状态
        const statusResult = await authManager.checkQRLoginStatus();
        
        expect(statusResult).toBeDefined();
        expect(statusResult.success).toBeDefined();
        
        if (statusResult.success) {
          expect(statusResult.tokenInfo).toBeDefined();
          expect(statusResult.tokenInfo?.userID).toBeDefined();
          expect(statusResult.tokenInfo?.serviceToken).toBeDefined();
          expect(statusResult.tokenInfo?.securityKey).toBeDefined();
          expect(statusResult.tokenInfo?.deviceID).toBeDefined();
        } else {
          // 在测试环境中，用户不会真的扫描二维码，所以失败是预期的
          expect(statusResult.error).toBeDefined();
          console.log('QR status check failed (expected in test environment):', statusResult.error);
        }
      } else {
        console.log('Skipping status check due to QR login failure');
      }
    }, 30000);
  });

  describe('令牌管理', () => {
    it('应该能够获取令牌信息', async () => {
      const tokenInfo = await authManager.getTokenInfo();
      
      // 在没有登录的情况下，应该返回 null
      expect(tokenInfo).toBeNull();
    });

    it('应该能够验证令牌', async () => {
      const validation = await authManager.validateToken();
      
      // 在没有令牌的情况下，应该返回无效
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBeDefined();
    });

    it('应该能够检查令牌是否即将过期', async () => {
      const isExpiring = await authManager.isTokenExpiringSoon();
      
      // 在没有令牌的情况下，应该返回 false
      expect(isExpiring).toBe(false);
    });

    it('应该能够获取令牌剩余时间', async () => {
      const remainingTime = await authManager.getTokenRemainingTime();
      
      // 在没有令牌的情况下，应该返回 0
      expect(remainingTime).toBe(0);
    });
  });

  describe('事件系统', () => {
    it('应该能够监听认证事件', (done) => {
      let eventCount = 0;
      const expectedEvents = ['qrCodeReady', 'loginFailed'];
      
      const eventHandler = (eventName: string) => {
        return (data: any) => {
          console.log(`收到事件: ${eventName}`, data);
          eventCount++;
          
          if (eventCount >= expectedEvents.length) {
            done();
          }
        };
      };

      // 监听各种认证事件
      authManager.on('qrCodeReady', eventHandler('qrCodeReady'));
      authManager.on('loginSuccess', eventHandler('loginSuccess'));
      authManager.on('loginFailed', eventHandler('loginFailed'));
      authManager.on('logout', eventHandler('logout'));
      authManager.on('tokenExpiring', eventHandler('tokenExpiring'));
      authManager.on('tokenExpired', eventHandler('tokenExpired'));

      // 启动二维码登录以触发事件
      authManager.loginWithQRCode().then(() => {
        // 检查登录状态以可能触发更多事件
        return authManager.checkQRLoginStatus();
      }).catch((error) => {
        console.log('认证流程出错（测试环境中预期）:', error);
        done();
      });
    }, 20000);
  });

  describe('持久化存储', () => {
    it('应该能够保存和加载令牌信息', async () => {
      const mockTokenInfo = {
        userID: 'test-user-123',
        securityKey: 'test-security-key',
        serviceToken: 'test-service-token',
        deviceID: 'test-device-id',
        cookies: ['test=cookie'],
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24小时后过期
        isValid: true
      };

      // 使用私有方法保存令牌信息（通过反射访问）
      const saveMethod = (authManager as any).saveTokenInfo;
      await saveMethod.call(authManager, mockTokenInfo);

      // 验证令牌信息是否正确保存
      const savedTokenInfo = await authManager.getTokenInfo();
      
      expect(savedTokenInfo).toBeDefined();
      expect(savedTokenInfo?.userID).toBe(mockTokenInfo.userID);
      expect(savedTokenInfo?.securityKey).toBe(mockTokenInfo.securityKey);
      expect(savedTokenInfo?.serviceToken).toBe(mockTokenInfo.serviceToken);
      expect(savedTokenInfo?.deviceID).toBe(mockTokenInfo.deviceID);
      expect(savedTokenInfo?.cookies).toEqual(mockTokenInfo.cookies);
      expect(savedTokenInfo?.expiresAt).toBe(mockTokenInfo.expiresAt);
      expect(savedTokenInfo?.isValid).toBe(true);
    });

    it('应该能够清除令牌信息', async () => {
      // 首先保存一个令牌
      const mockTokenInfo = {
        userID: 'test-user-123',
        securityKey: 'test-security-key',
        serviceToken: 'test-service-token',
        deviceID: 'test-device-id',
        cookies: ['test=cookie'],
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        isValid: true
      };

      const saveMethod = (authManager as any).saveTokenInfo;
      await saveMethod.call(authManager, mockTokenInfo);

      // 验证令牌已保存
      let tokenInfo = await authManager.getTokenInfo();
      expect(tokenInfo).toBeDefined();

      // 执行登出
      await authManager.logout();

      // 验证令牌已清除
      tokenInfo = await authManager.getTokenInfo();
      expect(tokenInfo).toBeNull();
    });
  });

  describe('错误处理', () => {
    it('应该能够处理网络错误', async () => {
      // 在没有网络连接或服务不可用的情况下测试错误处理
      const result = await authManager.loginWithQRCode();
      
      // 应该有明确的错误处理
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        console.log('网络错误处理测试通过:', result.error);
      }
    });

    it('应该能够处理无效的令牌', async () => {
      // 创建一个过期的令牌
      const expiredTokenInfo = {
        userID: 'test-user-123',
        securityKey: 'test-security-key',
        serviceToken: 'test-service-token',
        deviceID: 'test-device-id',
        cookies: ['test=cookie'],
        expiresAt: Date.now() - 1000, // 已过期
        isValid: false
      };

      const validation = await authManager.validateToken(expiredTokenInfo);
      
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBeDefined();
      expect(validation.reason).toContain('过期');
    });
  });
});