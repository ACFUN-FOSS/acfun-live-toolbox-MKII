import { EventEmitter } from 'events';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { AcFunLiveApi, createApi, ApiConfig, TokenInfo } from 'acfunlive-http-api';
import { getLogManager } from '../logging/LogManager';

/**
 * 扩展的令牌信息接口
 */
export interface ExtendedTokenInfo extends TokenInfo {
  /** 令牌过期时间戳 */
  expiresAt?: number;
  /** 令牌是否有效 */
  isValid?: boolean;
}

/**
 * TokenManager 事件接口定义
 */
export interface TokenManagerEvents {
  /** 令牌状态变化事件 */
  'tokenStateChanged': (data: { isAuthenticated: boolean; tokenInfo?: ExtendedTokenInfo }) => void;
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
 * 二维码登录结果接口
 */
export interface QrLoginResult {
  /** 二维码数据URL（base64格式） */
  qrCodeDataUrl: string;
  /** 二维码过期时间（秒） */
  expiresIn: number;
}

/**
 * 统一令牌管理器
 * 
 * TokenManager 是一个单例服务，负责管理整个应用程序的认证状态和API实例。
 * 它确保整个应用只有一个 acfunlive-http-api 实例，避免了多实例导致的状态不一致问题。
 * 
 * 主要功能：
 * - 单例模式管理统一的 AcFunLiveApi 实例
 * - 集中化的认证状态管理
 * - 令牌自动刷新和过期检查
 * - 二维码登录流程管理
 * - 认证状态持久化存储
 * - 认证事件通知
 * 
 * @extends EventEmitter
 */
export class TokenManager extends EventEmitter {
  /** 单例实例 */
  private static instance: TokenManager | null = null;
  
  /** 密钥文件存储路径 */
  private readonly secretsPath: string;
  
  /** 统一的 AcFun Live API 实例 */
  private api: AcFunLiveApi;
  
  /** 令牌刷新定时器 */
  private tokenRefreshTimer?: NodeJS.Timeout;
  
  /** 当前令牌信息 */
  private tokenInfo: ExtendedTokenInfo | null = null;
  
  /** 日志管理器 */
  private logManager: ReturnType<typeof getLogManager>;
  
  /** 是否正在刷新令牌 */
  private isRefreshing: boolean = false;
  
  /** 是否已初始化 */
  private initialized: boolean = false;

  /**
   * 私有构造函数（单例模式）
   * @param customSecretsPath 自定义密钥文件路径（可选，主要用于测试）
   * @param apiConfig 自定义API配置（可选）
   */
  private constructor(customSecretsPath?: string, apiConfig?: Partial<ApiConfig>) {
    super();

    // 创建统一的API实例
    const config: ApiConfig = {
      timeout: 30000,
      retryCount: 3,
      baseUrl: 'https://api-new.acfunchina.com',
      headers: {
        'User-Agent': 'AcFun-Live-Toolbox/2.0'
      },
      ...apiConfig
    };
    
    this.api = createApi(config);
    this.logManager = getLogManager();

    // 设置密钥文件路径
    if (customSecretsPath) {
      this.secretsPath = customSecretsPath;
    } else {
      try {
        this.secretsPath = path.join(app.getPath('userData'), 'secrets.json');
      } catch (error) {
        this.secretsPath = path.join(require('os').tmpdir(), 'secrets.json');
      }
    }
  }

  /**
   * 获取 TokenManager 单例实例
   * @param customSecretsPath 自定义密钥文件路径（仅在首次创建时有效）
   * @param apiConfig 自定义API配置（仅在首次创建时有效）
   * @returns TokenManager 实例
   */
  public static getInstance(customSecretsPath?: string, apiConfig?: Partial<ApiConfig>): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager(customSecretsPath, apiConfig);
    }
    return TokenManager.instance;
  }

  /**
   * 初始化 TokenManager
   * 加载保存的令牌信息并启动刷新定时器
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 加载保存的令牌信息
      await this.loadTokenInfo();
      
      // 启动令牌刷新检查定时器
      this.startTokenRefreshTimer();
      
      this.initialized = true;
      this.logManager.info('[TokenManager] Initialized successfully');
    } catch (error) {
      this.logManager.error('[TokenManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 获取统一的 API 实例
   * 这是整个应用程序获取 AcFunLiveApi 实例的唯一入口
   * @returns AcFunLiveApi 实例
   */
  public getApiInstance(): AcFunLiveApi {
    return this.api;
  }

  /**
   * 检查是否已认证
   * @returns 是否已认证
   */
  public isAuthenticated(): boolean {
    if (!this.tokenInfo) {
      return false;
    }

    // 检查令牌是否过期
    if (this.tokenInfo.expiresAt && this.tokenInfo.expiresAt <= Date.now()) {
      return false;
    }

    return this.tokenInfo.isValid !== false;
  }

  /**
   * 获取当前令牌信息
   * @returns 当前令牌信息或 null
   */
  public async getTokenInfo(): Promise<ExtendedTokenInfo | null> {
    if (!this.tokenInfo) {
      await this.loadTokenInfo();
    }
    return this.tokenInfo;
  }

  /**
   * 使用二维码登录 - 获取二维码
   * @returns 登录结果
   */
  public async loginWithQRCode(): Promise<{ success: boolean; qrCode?: QrLoginResult; error?: string }> {
    try {
      const qrResult = await this.api.auth.qrLogin();

      if (!qrResult?.success || !qrResult?.data) {
        const error = qrResult?.error || 'Failed to initiate QR login';
        this.emit('loginFailed', { error });
        return { success: false, error };
      }

      const { qrCode, expiresIn } = qrResult.data;
      const qrCodeDataUrl = `data:image/png;base64,${qrCode}`;
      const qrData = { qrCodeDataUrl, expiresIn };

      this.emit('qrCodeReady', { qrCode: qrData });
      return { success: true, qrCode: qrData };
    } catch (error) {
      const errorMsg = `QR login failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logManager.error('[TokenManager]', errorMsg);
      this.emit('loginFailed', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 检查二维码登录状态
   * @returns 登录状态检查结果
   */
  public async checkQRLoginStatus(): Promise<{ success: boolean; tokenInfo?: ExtendedTokenInfo; error?: string }> {
    try {
      const status = await this.api.auth.checkQrLoginStatus();

      if (status?.success && status?.data) {
        const tokenInfo: ExtendedTokenInfo = {
          userID: status.data.userId || '',
          securityKey: status.data.securityKey || '',
          serviceToken: status.data.serviceToken || status.data.token || '',
          deviceID: status.data.deviceId || '',
          cookies: (status.data as any).cookies || [],
          expiresAt: status.data.expiresAt || (Date.now() + 24 * 60 * 60 * 1000),
          isValid: true
        };

        await this.setTokenInfo(tokenInfo);
        this.emit('loginSuccess', { tokenInfo });
        this.logManager.info('[TokenManager] Login successful');
        return { success: true, tokenInfo };
      }

      const errorMessage = status?.error || 'No token info received';
      return { success: false, error: errorMessage };
    } catch (error) {
      const errorMsg = `Check QR login status failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logManager.error('[TokenManager]', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 刷新令牌
   * @returns 刷新结果
   */
  public async refreshToken(): Promise<{ success: boolean; qrCode?: QrLoginResult; message?: string }> {
    if (this.isRefreshing) {
      return { success: false, message: 'Token refresh already in progress' };
    }

    this.isRefreshing = true;

    try {
      if (!this.tokenInfo) {
        // 没有令牌信息，需要重新登录
        const qrResult = await this.loginWithQRCode();
        return {
          success: false,
          qrCode: qrResult.qrCode,
          message: 'No existing token, please login again'
        };
      }

      // 尝试刷新令牌
      const refreshResult = await this.api.auth.refreshToken();
      
      if (refreshResult?.success && refreshResult?.data) {
        const newTokenInfo: ExtendedTokenInfo = {
          ...this.tokenInfo,
          serviceToken: refreshResult.data.serviceToken || refreshResult.data.token || this.tokenInfo.serviceToken,
          expiresAt: refreshResult.data.expiresAt || (Date.now() + 24 * 60 * 60 * 1000),
          isValid: true
        };

        await this.setTokenInfo(newTokenInfo);
        this.logManager.info('[TokenManager] Token refreshed successfully');
        return { success: true, message: 'Token refreshed successfully' };
      } else {
        // 刷新失败，需要重新登录
        const qrResult = await this.loginWithQRCode();
        return {
          success: false,
          qrCode: qrResult.qrCode,
          message: 'Token refresh failed, please login again'
        };
      }
    } catch (error) {
      this.logManager.error('[TokenManager] Token refresh error:', error);
      // 刷新出错，需要重新登录
      const qrResult = await this.loginWithQRCode();
      return {
        success: false,
        qrCode: qrResult.qrCode,
        message: `Token refresh error: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * 登出
   */
  public async logout(): Promise<void> {
    try {
      // 清除令牌信息
      await this.clearTokenInfo();
      
      // 停止刷新定时器
      if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
        this.tokenRefreshTimer = undefined;
      }

      this.emit('logout');
      this.logManager.info('[TokenManager] Logged out successfully');
    } catch (error) {
      this.logManager.error('[TokenManager] Logout error:', error);
      throw error;
    }
  }

  /**
   * 设置令牌信息
   * @param tokenInfo 令牌信息
   */
  private async setTokenInfo(tokenInfo: ExtendedTokenInfo): Promise<void> {
    const wasAuthenticated = this.isAuthenticated();
    this.tokenInfo = tokenInfo;
    
    // 保存到文件
    await this.saveTokenInfo(tokenInfo);
    
    // 重启刷新定时器
    this.startTokenRefreshTimer();
    
    // 触发状态变化事件
    const isAuthenticated = this.isAuthenticated();
    if (wasAuthenticated !== isAuthenticated) {
      this.emit('tokenStateChanged', { isAuthenticated, tokenInfo });
    }
  }

  /**
   * 加载令牌信息
   */
  private async loadTokenInfo(): Promise<void> {
    try {
      if (fs.existsSync(this.secretsPath)) {
        const data = fs.readFileSync(this.secretsPath, 'utf8');
        const parsed = JSON.parse(data);
        
        if (parsed && parsed.userID) {
          this.tokenInfo = {
            ...parsed,
            isValid: true
          };
          this.logManager.info('[TokenManager] Token info loaded from file');
        }
      }
    } catch (error) {
      this.logManager.error('[TokenManager] Failed to load token info:', error);
    }
  }

  /**
   * 保存令牌信息到文件
   * @param tokenInfo 令牌信息
   */
  private async saveTokenInfo(tokenInfo: ExtendedTokenInfo): Promise<void> {
    try {
      const dir = path.dirname(this.secretsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.secretsPath, JSON.stringify(tokenInfo, null, 2), 'utf8');
      this.logManager.info('[TokenManager] Token info saved to file');
    } catch (error) {
      this.logManager.error('[TokenManager] Failed to save token info:', error);
      throw error;
    }
  }

  /**
   * 清除令牌信息
   */
  private async clearTokenInfo(): Promise<void> {
    const wasAuthenticated = this.isAuthenticated();
    this.tokenInfo = null;
    
    try {
      if (fs.existsSync(this.secretsPath)) {
        fs.unlinkSync(this.secretsPath);
      }
    } catch (error) {
      this.logManager.error('[TokenManager] Failed to clear token info file:', error);
    }

    // 触发状态变化事件
    if (wasAuthenticated) {
      this.emit('tokenStateChanged', { isAuthenticated: false });
    }
  }

  /**
   * 启动令牌刷新定时器
   */
  private startTokenRefreshTimer(): void {
    // 清除现有定时器
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    if (!this.tokenInfo || !this.tokenInfo.expiresAt) {
      return;
    }

    const now = Date.now();
    const expiresAt = this.tokenInfo.expiresAt;
    const timeUntilExpiry = expiresAt - now;

    // 如果已经过期，立即尝试刷新
    if (timeUntilExpiry <= 0) {
      this.emit('tokenExpired', { message: 'Token has expired' });
      this.refreshToken();
      return;
    }

    // 在过期前5分钟开始提醒
    const warningTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);
    
    if (warningTime > 0) {
      // 设置过期提醒定时器
      setTimeout(() => {
        this.emit('tokenExpiring', {
          message: 'Token will expire soon',
          expiresAt,
          timeRemaining: Math.max(0, expiresAt - Date.now())
        });
      }, warningTime);
    } else {
      // 立即发出过期提醒
      this.emit('tokenExpiring', {
        message: 'Token will expire soon',
        expiresAt,
        timeRemaining: timeUntilExpiry
      });
    }

    // 在过期前1分钟自动刷新
    const refreshTime = Math.max(0, timeUntilExpiry - 60 * 1000);
    this.tokenRefreshTimer = setTimeout(() => {
      this.refreshToken();
    }, refreshTime);
  }

  /**
   * 销毁 TokenManager 实例
   */
  public destroy(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = undefined;
    }
    
    this.removeAllListeners();
    this.initialized = false;
    
    // 重置单例实例
    TokenManager.instance = null;
  }

  /**
   * 获取令牌剩余时间（毫秒）
   * @returns 剩余时间，如果没有令牌或已过期返回0
   */
  public async getTokenRemainingTime(): Promise<number> {
    if (!this.tokenInfo || !this.tokenInfo.expiresAt) {
      return 0;
    }
    
    return Math.max(0, this.tokenInfo.expiresAt - Date.now());
  }

  /**
   * 检查令牌是否即将过期
   * @param thresholdMinutes 阈值分钟数，默认5分钟
   * @returns 是否即将过期
   */
  public async isTokenExpiringSoon(thresholdMinutes: number = 5): Promise<boolean> {
    const remainingTime = await this.getTokenRemainingTime();
    return remainingTime > 0 && remainingTime <= thresholdMinutes * 60 * 1000;
  }
}

// 导出单例获取函数，方便其他模块使用
export const getTokenManager = (customSecretsPath?: string, apiConfig?: Partial<ApiConfig>): TokenManager => {
  return TokenManager.getInstance(customSecretsPath, apiConfig);
};