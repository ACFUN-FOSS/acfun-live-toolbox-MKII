import { EventEmitter } from 'events';
import { app } from 'electron';
import { ConfigManager } from '../utils/ConfigManager';
import { LogManager } from '../utils/LogManager';

// 用户认证状态枚举
export enum AuthStatus {
  LOGGED_OUT = 'logged_out',
  LOGGING_IN = 'logging_in',
  LOGGED_IN = 'logged_in',
  GUEST = 'guest'
}

// 用户信息接口
export interface UserInfo {
  userId: string;
  username: string;
  avatar?: string;
  token?: string;
  permissions: string[];
}

/**
 * 用户认证模块
 * 负责处理登录、登出、会话管理和权限控制
 */
export class UserAuthModule extends EventEmitter {
  private status: AuthStatus = AuthStatus.LOGGED_OUT;
  private currentUser: UserInfo | null = null;
  private configManager: ConfigManager;
  private logManager: LogManager;
  private autoLoginTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.configManager = globalThis.configManager;
    this.logManager = globalThis.logManager;
    this.initialize();
  }

  /**
   * 初始化认证模块
   */
  private async initialize(): Promise<void> {
    this.logManager.addLog('UserAuthModule', 'Initializing user authentication module', 'info');
    await this.checkAutoLogin();
  }

  /**
   * 检查是否需要自动登录
   */
  private async checkAutoLogin(): Promise<void> {
    const authConfig = this.configManager.readConfig().auth || {};

    if (authConfig.autoLogin && authConfig.lastLoginUser) {
      this.logManager.addLog('UserAuthModule', 'Attempting auto-login for user', 'info');
      this.status = AuthStatus.LOGGING_IN;
      this.emit('statusChanged', this.status);

      try {
        // 模拟自动登录过程
        this.autoLoginTimer = setTimeout(async () => {
          // 在实际实现中，这里应该调用ACFUN API验证token有效性
          this.currentUser = authConfig.lastLoginUser;
          this.status = AuthStatus.LOGGED_IN;
          this.logManager.addLog('UserAuthModule', `Auto-login successful for user: ${this.currentUser.username}`, 'info');
          this.emit('statusChanged', this.status);
          this.emit('userChanged', this.currentUser);
        }, 1500);
      } catch (error) {
        this.logManager.addLog('UserAuthModule', `Auto-login failed: ${error.message}`, 'error');
        this.status = AuthStatus.LOGGED_OUT;
        this.emit('statusChanged', this.status);
      }
    }
  }

  /**
   * 以游客模式登录
   */
  public enterGuestMode(): void {
    this.logManager.addLog('UserAuthModule', 'Entering guest mode', 'info');
    this.status = AuthStatus.GUEST;
    this.currentUser = {
      userId: 'guest',
      username: '游客',
      permissions: ['guest']
    };
    this.emit('statusChanged', this.status);
    this.emit('userChanged', this.currentUser);
  }

  /**
   * 用户登录
   * @param token - 认证token
   * @param userInfo - 用户信息
   */
  public async login(token: string, userInfo: UserInfo): Promise<boolean> {
    if (this.status === AuthStatus.LOGGING_IN) {
      this.logManager.addLog('UserAuthModule', 'Login process already in progress', 'warn');
      return false;
    }

    this.status = AuthStatus.LOGGING_IN;
    this.emit('statusChanged', this.status);

    try {
      // 在实际实现中，这里应该验证token并获取完整用户信息
      this.currentUser = {
        ...userInfo,
        token
      };

      // 保存登录状态用于自动登录
      const authConfig = {
        autoLogin: true,
        lastLoginUser: this.currentUser
      };
      this.configManager.writeConfig({ auth: authConfig });

      this.status = AuthStatus.LOGGED_IN;
      this.logManager.addLog('UserAuthModule', `Login successful for user: ${this.currentUser.username}`, 'info');
      this.emit('statusChanged', this.status);
      this.emit('userChanged', this.currentUser);
      return true;
    } catch (error) {
      this.logManager.addLog('UserAuthModule', `Login failed: ${error.message}`, 'error');
      this.status = AuthStatus.LOGGED_OUT;
      this.emit('statusChanged', this.status);
      return false;
    }
  }

  /**
   * 用户登出
   * @param keepAutoLogin - 是否保持自动登录状态
   */
  public logout(keepAutoLogin: boolean = false): void {
    this.logManager.addLog('UserAuthModule', 'User logging out', 'info');

    // 清除自动登录状态（如果需要）
    if (!keepAutoLogin) {
      const authConfig = this.configManager.readConfig().auth || {};
      authConfig.autoLogin = false;
      this.configManager.writeConfig({ auth: authConfig });
    }

    // 清除当前用户信息
    this.currentUser = null;
    this.status = AuthStatus.LOGGED_OUT;
    this.emit('statusChanged', this.status);
    this.emit('userChanged', null);

    // 清除可能的自动登录定时器
    if (this.autoLoginTimer) {
      clearTimeout(this.autoLoginTimer);
      this.autoLoginTimer = undefined;
    }
  }

  /**
   * 获取当前认证状态
   */
  public getStatus(): AuthStatus {
    return this.status;
  }

  /**
   * 获取当前用户信息
   */
  public getUserInfo(): UserInfo | null {
    return this.currentUser;
  }

  /**
   * 检查用户是否有权限执行某个操作
   * @param permission - 权限名称
   */
  public hasPermission(permission: string): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.permissions.includes(permission) || this.currentUser.permissions.includes('admin');
  }

  /**
   * 销毁模块资源
   */
  public destroy(): void {
    if (this.autoLoginTimer) {
      clearTimeout(this.autoLoginTimer);
    }
    this.removeAllListeners();
  }
}