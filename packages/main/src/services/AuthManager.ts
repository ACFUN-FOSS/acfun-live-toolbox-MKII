import { app } from 'electron';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { TokenInfo, AcFunLiveApi } from 'acfunlive-http-api';

// 在开发环境中容错加载 acfunlive-http-api：优先尝试 dist，失败则回退到 src TS 文件。
// 这样可以避免在开发环境中因为未构建的依赖导致应用启动失败。


/**
 * 二维码登录结果接口
 */
export interface QrLoginResult {
  /** 二维码数据URL（base64格式） */
  qrCodeDataUrl: string;
  /** 二维码过期时间（秒） */
  expiresIn: number;
}

/**
 * 登录状态接口
 */
export interface LoginStatus {
  /** 登录是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
  /** 用户ID（如果成功） */
  userId?: string;
  /** 令牌过期时间戳（如果成功） */
  expiresAt?: number;
}

/**
 * 扩展的令牌信息接口，添加了过期时间和有效性字段
 */
export interface ExtendedTokenInfo extends TokenInfo {
  /** 令牌过期时间戳 */
  expiresAt?: number;
  /** 令牌是否有效 */
  isValid?: boolean;
}

/**
 * AuthManager 事件接口定义
 */
export interface AuthManagerEvents {
  /** 令牌即将过期事件 */
  'tokenExpiring': (data: { message: string; expiresAt?: number; timeRemaining: number }) => void;
  /** 令牌已过期事件 */
  'tokenExpired': (data: { message: string }) => void;
  /** 二维码准备就绪事件 */
  'qrCodeReady': (data: { qrCode: any; message?: string }) => void;
  /** 登录成功事件 */
  'loginSuccess': (data: { tokenInfo: ExtendedTokenInfo }) => void;
  /** 登录失败事件 */
  'loginFailed': (data: { error: string }) => void;
  /** 登出事件 */
  'logout': () => void;
}

/**
 * 认证管理器类
 * 负责处理用户认证、令牌管理、二维码登录等功能
 * 
 * 主要功能：
 * - 二维码登录流程管理
 * - 令牌自动刷新和过期检查
 * - 认证状态持久化存储
 * - 认证事件通知
 * 
 * @extends EventEmitter
 * @emits tokenExpiring - 令牌即将过期时触发
 * @emits tokenExpired - 令牌已过期时触发
 * @emits qrCodeReady - 二维码准备就绪时触发
 * @emits loginSuccess - 登录成功时触发
 * @emits loginFailed - 登录失败时触发
 * @emits logout - 登出时触发
 */
export class AuthManager extends EventEmitter {
  /** 密钥文件存储路径 */
  private readonly secretsPath: string;
  /** AcFun Live API 实例 */
  private api: AcFunLiveApi;
  /** 令牌刷新定时器 */
  private tokenRefreshTimer?: NodeJS.Timeout;
  /** 当前令牌信息 */
  private tokenInfo: ExtendedTokenInfo | null = null;

  /**
   * 构造函数
   * @param customSecretsPath 自定义密钥文件路径（可选，主要用于测试）
   */
  constructor(customSecretsPath?: string) {
    super(); // 调用 EventEmitter 构造函数

    // 初始化 AcFunLiveApi 实例，设置30秒超时
    this.api = new AcFunLiveApi({
      timeout: 30000
    });

    // 设置密钥文件路径
    if (customSecretsPath) {
      this.secretsPath = customSecretsPath;
    } else {
      try {
        // 在生产环境中使用 Electron 的用户数据目录
        this.secretsPath = path.join(app.getPath('userData'), 'secrets.json');
      } catch (error) {
        // 在测试环境中可能没有Electron app，使用临时目录
        this.secretsPath = path.join(require('os').tmpdir(), 'secrets.json');
      }
    }

    // 启动令牌刷新检查定时器
    this.startTokenRefreshTimer();
  }

  /**
   * 使用二维码登录 - 获取二维码
   * 
   * 此方法启动二维码登录流程的第一步：获取二维码
   * 成功后会触发 'qrCodeReady' 事件，失败则触发 'loginFailed' 事件
   * 
   * @returns Promise<{ success: boolean; qrCode?: any; error?: string }> 登录结果
   */
  async loginWithQRCode(): Promise<{ success: boolean; qrCode?: any; error?: string }> {
    try {
      // 调用 API 获取二维码
      const qrResult = await this.api.auth.qrLogin();

      if (!qrResult?.success || !qrResult?.data) {
        const error = qrResult?.error || 'Failed to initiate QR login';
        this.emit('loginFailed', { error });
        return { success: false, error };
      }

      // 构造二维码数据
      const { qrCode, expiresIn } = qrResult.data;
      const qrCodeDataUrl = `data:image/png;base64,${qrCode}`;
      const qrData = { qrCodeDataUrl, expiresIn };

      this.emit('qrCodeReady', { qrCode: qrData });
      return { success: true, qrCode: qrData };
    } catch (error) {
      const errorMsg = `QR login failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error('[AuthManager]', errorMsg);
      this.emit('loginFailed', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 检查二维码登录状态
   */
  async checkQRLoginStatus(): Promise<{ success: boolean; tokenInfo?: ExtendedTokenInfo; error?: string }> {
    try {
      const status = await this.api.auth.checkQrLoginStatus();

      if (status?.success && status?.data) {
        // 构建令牌信息，使用acfunlive-http-api返回的数据结构
        const tokenInfo: ExtendedTokenInfo = {
          userID: status.data.userId || status.data.userId || '',
          securityKey: status.data.securityKey || '',
          serviceToken: status.data.serviceToken || status.data.token || '',
          deviceID: status.data.deviceId || status.data.deviceId || '',
          cookies: (status.data as any).cookies || [],
          expiresAt: status.data.expiresAt || (Date.now() + 24 * 60 * 60 * 1000), // 默认24小时过期
          isValid: true
        };

        // 保存令牌信息
        await this.saveTokenInfo(tokenInfo);
        this.tokenInfo = tokenInfo;
        this.startTokenRefreshTimer();

        this.emit('loginSuccess', { tokenInfo });
        console.log('[AuthManager] Login successful');
        return { success: true, tokenInfo };
      }

      const error = status?.error || 'No token info received';
      this.emit('loginFailed', { error });
      return { success: false, error };
    } catch (error) {
      const errorMsg = `QR status check failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error('[AuthManager]', errorMsg);
      this.emit('loginFailed', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    try {
      // 清除内存中的令牌信息
      this.tokenInfo = null;

      // 停止令牌刷新定时器
      if (this.tokenRefreshTimer) {
        clearInterval(this.tokenRefreshTimer);
        this.tokenRefreshTimer = undefined;
      }

      // 清除持久化的令牌信息
      if (fs.existsSync(this.secretsPath)) {
        const data = JSON.parse(fs.readFileSync(this.secretsPath, 'utf-8'));
        const obj = { ...data };

        // 清除新格式的TokenInfo字段
        delete obj.userID;
        delete obj.securityKey;
        delete obj.serviceToken;
        delete obj.deviceID;
        delete obj.cookies;
        delete obj.expiresAt;
        delete obj.isValid;

        // 清除旧格式的字段（兼容性）
        delete obj.userId;
        delete obj.acfun_token;
        delete obj.refresh_token;
        delete obj.token_expires_at;

        fs.writeFileSync(this.secretsPath, JSON.stringify(obj, null, 2));
      }

      this.emit('logout');
      console.log('[AuthManager] Logout completed');
    } catch (error) {
      console.error('[AuthManager] Error during logout:', error);
    }
  }

  /**
   * 获取当前令牌信息
   */
  async getTokenInfo(): Promise<ExtendedTokenInfo | null> {
    try {
      if (!fs.existsSync(this.secretsPath)) {
        return null;
      }

      const data = JSON.parse(fs.readFileSync(this.secretsPath, 'utf-8'));

      // 检查是否有新格式的TokenInfo数据
      if (data.userID && data.securityKey && data.serviceToken && data.deviceID) {
        const now = Date.now();
        const expiresAt = data.expiresAt || 0;
        const isValid = expiresAt > now;

        return {
          userID: data.userID,
          securityKey: data.securityKey,
          serviceToken: data.serviceToken,
          deviceID: data.deviceID,
          cookies: data.cookies || [],
          expiresAt,
          isValid
        };
      }

      // 兼容旧格式的数据（如果存在）
      if (data.acfun_token && data.userId) {
        const now = Date.now();
        const expiresAt = data.token_expires_at || 0;
        const isValid = expiresAt > now;

        return {
          userID: data.userId,
          securityKey: '',
          serviceToken: data.acfun_token,
          deviceID: '',
          cookies: [],
          expiresAt,
          isValid
        };
      }

      return null;
    } catch (err) {
      console.error('[AuthManager] Failed to get token info:', err);
      return null;
    }
  }

  /**
   * 检查令牌是否即将过期（30分钟内）
   */
  async isTokenExpiringSoon(): Promise<boolean> {
    const tokenInfo = this.tokenInfo || await this.getTokenInfo();
    if (!tokenInfo || !tokenInfo.expiresAt) return false;

    const now = Date.now();
    const twentyMinutes = 20 * 60 * 1000; // 20分钟阈值，这样15分钟的token会被认为即将过期
    return tokenInfo.expiresAt - now < twentyMinutes;
  }

  /**
   * 验证token的有效性（包括格式和过期时间）
   */
  async validateToken(tokenInfo?: ExtendedTokenInfo): Promise<{ isValid: boolean; reason?: string }> {
    const token = tokenInfo || await this.getTokenInfo();

    if (!token) {
      return { isValid: false, reason: 'Token不存在' };
    }

    // 检查必需字段
    if (!token.userID || !token.serviceToken || !token.securityKey || !token.deviceID) {
      return { isValid: false, reason: '缺少必要字段' };
    }

    // 检查过期时间
    if (token.expiresAt && token.expiresAt <= Date.now()) {
      return { isValid: false, reason: 'Token已过期' };
    }

    return { isValid: true };
  }

  /**
   * 检查是否已认证（同步方法）
   */
  isAuthenticated(): boolean {
    // 如果内存中有有效的token信息，直接检查
    if (this.tokenInfo) {
      return this.tokenInfo.isValid === true &&
        (this.tokenInfo.expiresAt ? this.tokenInfo.expiresAt > Date.now() : true);
    }

    // 如果内存中没有，尝试从文件中快速检查
    try {
      if (!fs.existsSync(this.secretsPath)) {
        return false;
      }

      const data = JSON.parse(fs.readFileSync(this.secretsPath, 'utf-8'));

      // 检查是否有必要的字段
      if (!data.userID || !data.securityKey || !data.serviceToken || !data.deviceID) {
        return false;
      }

      // 检查过期时间
      const expiresAt = data.expiresAt || 0;
      return expiresAt > Date.now();
    } catch (error) {
      console.error('[AuthManager] Error checking authentication status:', error);
      return false;
    }
  }

  /**
   * 获取token的剩余有效时间（毫秒）
   */
  async getTokenRemainingTime(): Promise<number> {
    const tokenInfo = this.tokenInfo || await this.getTokenInfo();
    if (!tokenInfo || !tokenInfo.expiresAt) return 0;

    return Math.max(0, tokenInfo.expiresAt - Date.now());
  }

  /**
   * 刷新令牌（注意：acfunlive-http-api 的 AuthService 不支持令牌刷新）
   * 返回新的二维码登录信息供用户重新登录
   */
  async refreshToken(): Promise<{ success: boolean; qrCode?: any; message?: string }> {
    console.warn('[AuthManager] acfunlive-http-api AuthService does not support token refreshing. Initiating new QR login process.');

    try {
      // 由于无法刷新，启动新的二维码登录流程
      const authService = this.api.auth;

      const qrResult = await authService.qrLogin();
      if (qrResult.success && qrResult.data) {
        return {
          success: true,
          qrCode: qrResult.data,
          message: 'Token expired. Please scan the new QR code to re-authenticate.'
        };
      } else {
        return {
          success: false,
          message: 'Failed to generate new QR code for re-authentication.'
        };
      }
    } catch (error) {
      console.error('[AuthManager] Error generating new QR code:', error);
      return {
        success: false,
        message: 'Error occurred while generating new QR code for re-authentication.'
      };
    }
  }

  /**
   * 启动令牌刷新定时器
   */
  private startTokenRefreshTimer(): void {
    // 清除现有定时器
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
    }

    // 每3分钟检查一次令牌状态
    this.tokenRefreshTimer = setInterval(async () => {
      try {
        const tokenInfo = await this.getTokenInfo();
        if (!tokenInfo) {
          return; // 没有token，无需检查
        }

        const isExpiringSoon = await this.isTokenExpiringSoon();
        if (isExpiringSoon) {
          console.log('[AuthManager] Token is expiring soon, notifying user for re-authentication...');

          // 更新内存中的token信息
          this.tokenInfo = tokenInfo;

          // 发出令牌即将过期的事件通知
          this.emit('tokenExpiring', {
            message: 'Authentication token is expiring soon. Please re-authenticate.',
            expiresAt: tokenInfo.expiresAt,
            timeRemaining: tokenInfo.expiresAt ? tokenInfo.expiresAt - Date.now() : 0
          });

          // 尝试获取新的二维码
          const refreshResult = await this.refreshToken();
          if (refreshResult.success && refreshResult.qrCode) {
            this.emit('qrCodeReady', {
              qrCode: refreshResult.qrCode,
              message: refreshResult.message
            });
          } else {
            console.warn('[AuthManager] Failed to generate new QR code, clearing expired token');
            await this.logout();
            this.emit('tokenExpired', {
              message: 'Authentication token has expired. Please log in again.'
            });
          }
        }
      } catch (error) {
        console.error('[AuthManager] Error in token refresh timer:', error);
      }
    }, 3 * 60 * 1000); // 3分钟
  }

  /**
   * 销毁 AuthManager
   */
  destroy(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = undefined;
    }
  }

  /**
   * 保存令牌信息到文件
   */
  private async saveTokenInfo(tokenInfo: ExtendedTokenInfo): Promise<void> {
    try {
      const existing = fs.existsSync(this.secretsPath)
        ? JSON.parse(fs.readFileSync(this.secretsPath, 'utf-8'))
        : {};

      const next = {
        ...existing,
        // 保存acfunlive-http-api格式的令牌信息
        userID: tokenInfo.userID,
        securityKey: tokenInfo.securityKey,
        serviceToken: tokenInfo.serviceToken,
        deviceID: tokenInfo.deviceID,
        cookies: tokenInfo.cookies,
        expiresAt: tokenInfo.expiresAt,
        isValid: tokenInfo.isValid,
        updated_at: Date.now(),
      };

      fs.mkdirSync(path.dirname(this.secretsPath), { recursive: true });
      fs.writeFileSync(this.secretsPath, JSON.stringify(next, null, 2));
    } catch (err) {
      console.error('[AuthManager] Failed to persist token info:', err);
    }
  }

  private saveToken(data: { token: string; userId: string; expiresAt: number; refreshToken?: string }) {
    try {
      const existing = fs.existsSync(this.secretsPath)
        ? JSON.parse(fs.readFileSync(this.secretsPath, 'utf-8'))
        : {};
      const next = {
        ...existing,
        acfun_token: data.token,
        refresh_token: data.refreshToken,
        userId: data.userId,
        token_expires_at: data.expiresAt,
        updated_at: Date.now(),
      };
      fs.mkdirSync(path.dirname(this.secretsPath), { recursive: true });
      fs.writeFileSync(this.secretsPath, JSON.stringify(next, null, 2));
    } catch (err) {
      // Do not expose sensitive details to renderer
      console.error('[AuthManager] Failed to persist token:', err);
    }
  }
}