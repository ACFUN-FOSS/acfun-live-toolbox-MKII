import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuthManager, ExtendedTokenInfo } from '../services/AuthManager';

// 确保使用真实的fs模块
vi.unmock('fs');

describe('AuthManager Token Management', () => {
  let authManager: AuthManager | null = null;
  let tempSecretsPath: string;

  beforeEach(() => {
    // 使用临时文件路径
    tempSecretsPath = path.join(os.tmpdir(), `secrets-test-${Date.now()}.json`);
    try {
      authManager = new AuthManager(tempSecretsPath);
    } catch (error) {
      console.error('Failed to create AuthManager:', error);
      authManager = null;
    }
  });

  afterEach(() => {
    if (authManager) {
      try {
        authManager.destroy();
      } catch (error) {
        console.error('Failed to destroy AuthManager:', error);
      }
    }
    // 清理临时文件
    if (fs.existsSync(tempSecretsPath)) {
      fs.unlinkSync(tempSecretsPath);
    }
  });

  describe('Basic Functionality', () => {
    it('should create AuthManager instance', () => {
      expect(authManager).not.toBeNull();
      expect(authManager).toBeInstanceOf(AuthManager);
    });
  });

  describe('Token Validation', () => {
    it('should validate a complete and non-expired token', async () => {
      if (!authManager) {
        throw new Error('AuthManager not initialized');
      }

      const validToken: ExtendedTokenInfo = {
        userID: '12345',
        securityKey: 'test-security-key',
        serviceToken: 'test-service-token',
        deviceID: 'test-device-id',
        cookies: ['cookie1=value1', 'cookie2=value2'],
        expiresAt: Date.now() + 3600000 // 1 hour from now
      };

      const result = await authManager.validateToken(validToken);
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should invalidate an expired token', async () => {
      if (!authManager) {
        throw new Error('AuthManager not initialized');
      }

      const expiredToken: ExtendedTokenInfo = {
        userID: '12345',
        securityKey: 'test-security-key',
        serviceToken: 'test-service-token',
        deviceID: 'test-device-id',
        cookies: ['cookie1=value1'],
        expiresAt: Date.now() - 3600000 // 1 hour ago
      };

      const result = await authManager.validateToken(expiredToken);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('已过�?);
    });

    it('should invalidate an incomplete token', async () => {
      if (!authManager) {
        throw new Error('AuthManager not initialized');
      }

      const incompleteToken = {
        userID: '12345',
        // Missing required fields
        cookies: []
      } as ExtendedTokenInfo;

      const result = await authManager.validateToken(incompleteToken);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('缺少必要字段');
    });

    it('should handle null token', async () => {
      if (!authManager) {
        throw new Error('AuthManager not initialized');
      }

      const result = await authManager.validateToken(null as any);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Token不存�?);
    });
  });

  describe('Token Expiration Detection', () => {
    it('should detect soon expiring token', async () => {
      if (!authManager) {
        throw new Error('AuthManager not initialized');
      }

      const soonExpiringToken: ExtendedTokenInfo = {
        userID: '12345',
        securityKey: 'test-security-key',
        serviceToken: 'test-service-token',
        deviceID: 'test-device-id',
        cookies: [],
        expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes from now
      };

      authManager['tokenInfo'] = soonExpiringToken;
      const result = await authManager.isTokenExpiringSoon();
      expect(result).toBe(true);
    });

    it('should not detect far future expiring token', async () => {
      if (!authManager) {
        throw new Error('AuthManager not initialized');
      }

      const farFutureToken: ExtendedTokenInfo = {
        userID: '12345',
        securityKey: 'test-security-key',
        serviceToken: 'test-service-token',
        deviceID: 'test-device-id',
        cookies: [],
        expiresAt: Date.now() + 2 * 60 * 60 * 1000 // 2 hours from now
      };

      authManager['tokenInfo'] = farFutureToken;
      const result = await authManager.isTokenExpiringSoon();
      expect(result).toBe(false);
    });

    it('should calculate remaining time correctly', async () => {
      if (!authManager) {
        throw new Error('AuthManager not initialized');
      }

      const futureTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
      const tokenWithFutureExpiry: ExtendedTokenInfo = {
        userID: '12345',
        securityKey: 'test-security-key',
        serviceToken: 'test-service-token',
        deviceID: 'test-device-id',
        cookies: [],
        expiresAt: futureTime
      };

      authManager['tokenInfo'] = tokenWithFutureExpiry;
      const remainingTime = await authManager.getTokenRemainingTime();
      
      // Should be approximately 1 hour (allowing for small timing differences)
      expect(remainingTime).toBeGreaterThan(59 * 60 * 1000);
      expect(remainingTime).toBeLessThan(61 * 60 * 1000);
    });
  });

  describe('Token Persistence', () => {
    it('should save and load token info', async () => {
      if (!authManager) {
        throw new Error('AuthManager not initialized');
      }

      const tokenInfo: ExtendedTokenInfo = {
        userID: '12345',
        securityKey: 'test-security-key',
        serviceToken: 'test-service-token',
        deviceID: 'test-device-id',
        cookies: ['cookie1=value1'],
        expiresAt: Date.now() + 3600000
      };

      // Save token
      await authManager['saveTokenInfo'](tokenInfo);
      
      // Load token
      const loadedToken = await authManager.getTokenInfo();
      
      expect(loadedToken).not.toBeNull();
      expect(loadedToken?.userID).toBe(tokenInfo.userID);
      expect(loadedToken?.securityKey).toBe(tokenInfo.securityKey);
      expect(loadedToken?.serviceToken).toBe(tokenInfo.serviceToken);
      expect(loadedToken?.deviceID).toBe(tokenInfo.deviceID);
      expect(loadedToken?.expiresAt).toBe(tokenInfo.expiresAt);
    });
  });

  describe('Event Emission', () => {
    it('should emit logout event when logout is called', async () => {
      if (!authManager) {
        throw new Error('AuthManager not initialized');
      }

      let logoutEventEmitted = false;
      
      authManager.on('logout', () => {
        logoutEventEmitted = true;
      });

      await authManager.logout();
      expect(logoutEventEmitted).toBe(true);
    });
  });
});
