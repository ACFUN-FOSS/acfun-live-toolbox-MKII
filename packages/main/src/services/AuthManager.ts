import { EventEmitter } from 'events';
import { getLogManager } from '../logging/LogManager';
import { TokenManager, ExtendedTokenInfo, QrLoginResult, ApiConfig } from './TokenManager';

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
 * 认证管理器类（已重构为使用 TokenManager）
 * 
 * 这个类现在作为 TokenManager 的包装器，提供向后兼容的接口。
 * 所有实际的认证逻辑都委托给 TokenManager 处理。
 * 
 * @deprecated 建议直接使用 TokenManager，此类仅为向后兼容保留
 * @extends EventEmitter
 */
export class AuthManager extends EventEmitter {
  /** TokenManager 实例 */
  private tokenManager: TokenManager;
  /** 日志管理器 */
  private logManager: ReturnType<typeof getLogManager>;

  /**
   * 构造函数
   * @param customSecretsPath 自定义密钥文件路径（可选，主要用于测试）
   * @param apiConfig 自定义API配置（可选）
   */
  constructor(customSecretsPath?: string, apiConfig?: Partial<ApiConfig>) {
    super();

    this.logManager = getLogManager();
    
    // 获取 TokenManager 实例
    this.tokenManager = TokenManager.getInstance(customSecretsPath, apiConfig);
    
    // 转发 TokenManager 的事件
    this.setupEventForwarding();
    
    // 初始化 TokenManager
    this.tokenManager.initialize().catch(error => {
      this.logManager.error('[AuthManager] Failed to initialize TokenManager:', error);
    });
  }

  /**
   * 设置事件转发
   * 将 TokenManager 的事件转发到 AuthManager
   */
  private setupEventForwarding(): void {
    this.tokenManager.on('tokenExpiring', (data) => {
      this.emit('tokenExpiring', data);
    });

    this.tokenManager.on('tokenExpired', (data) => {
      this.emit('tokenExpired', data);
    });

    this.tokenManager.on('qrCodeReady', (data) => {
      this.emit('qrCodeReady', data);
    });

    this.tokenManager.on('loginSuccess', (data) => {
      this.emit('loginSuccess', data);
    });

    this.tokenManager.on('loginFailed', (data) => {
      this.emit('loginFailed', data);
    });

    this.tokenManager.on('logout', () => {
      this.emit('logout');
    });
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

      // 处理acfunlive-http-api返回的原始错误格式
      let errorMessage = status?.error || 'No token info received';
      
      // 检查是否是等待用户操作的状态（不应该触发 loginFailed 事件）
      const isWaitingStatus = errorMessage.includes('请等待用户扫描') || 
                             errorMessage.includes('请等待用户确认') ||
                             errorMessage.includes('二维码状态为');
      
      // 如果status.data包含result和error_msg，说明是后端API的原始错误响应
      if (status?.data && typeof status.data === 'object') {
        const data = status.data as any;
        if (data.result !== undefined && data.error_msg) {
          errorMessage = `API错误: ${data.error_msg} (代码: ${data.result})`;
          
          // result: 10 通常表示等待用户操作，不是真正的错误
          if (data.result === 10) {
            console.log('[AuthManager] Waiting for user action:', errorMessage);
            return { success: false, error: errorMessage };
          }
        }
      }

      // 只有在真正的错误情况下才发送 loginFailed 事件
      if (!isWaitingStatus) {
        this.emit('loginFailed', { error: errorMessage });
      } else {
        console.log('[AuthManager] QR login waiting:', errorMessage);
      }
      
      return { success: false, error: errorMessage };
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
    return this.tokenManager.logout();
  }

  /**
   * 获取当前令牌信息
   */
  async getTokenInfo(): Promise<ExtendedTokenInfo | null> {
    return this.tokenManager.getTokenInfo();
  }

  /**
   * 检查令牌是否即将过期（30分钟内）
   */
  async isTokenExpiringSoon(): Promise<boolean> {
    return this.tokenManager.isTokenExpiringSoon();
  }

  /**
   * 验证token的有效性（包括格式和过期时间）
   */
  async validateToken(tokenInfo?: ExtendedTokenInfo): Promise<{ isValid: boolean; reason?: string }> {
    return this.tokenManager.validateToken(tokenInfo);
  }

  /**
   * 检查是否已认证（同步方法）
   */
  isAuthenticated(): boolean {
    return this.tokenManager.isAuthenticated();
  }

  /**
   * 获取token的剩余有效时间（毫秒）
   */
  async getTokenRemainingTime(): Promise<number> {
    return this.tokenManager.getTokenRemainingTime();
  }

  /**
   * 刷新令牌（注意：acfunlive-http-api 的 AuthService 不支持令牌刷新）
   * 返回新的二维码登录信息供用户重新登录
   */
  async refreshToken(): Promise<{ success: boolean; qrCode?: any; message?: string }> {
    return this.tokenManager.refreshToken();
  }

  /**
   * 销毁 AuthManager
   */
  destroy(): void {
    this.tokenManager.destroy();
  }

  /**
   * 更新令牌信息
   */
  async updateTokenInfo(tokenInfo: any): Promise<void> {
    return this.tokenManager.updateTokenInfo(tokenInfo);
  }

  /**
   * 清除令牌信息
   */
  async clearTokenInfo(): Promise<void> {
    return this.tokenManager.clearTokenInfo();
  }

  /**
   * 获取API实例
   */
  getApiInstance() {
    return this.tokenManager.getApiInstance();
  }
}