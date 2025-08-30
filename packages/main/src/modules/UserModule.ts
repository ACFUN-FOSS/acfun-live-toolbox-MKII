import { singleton } from 'tsyringe';
import { ConfigManager } from '../utils/ConfigManager';
import logger from '../utils/logger';

interface UserInfo {
  name: string;
  avatar: string;
  userId: string;
}

const DEFAULT_USER_INFO: UserInfo = {
  name: 'ACFUN主播',
  avatar: 'https://picsum.photos/200',
  userId: 'default_user'
};

/**
 * 用户模块 - 处理用户信息相关功能
 */
@singleton()
export default class UserModule {
  private configManager: ConfigManager;
  private userInfo: UserInfo | null = null;

  constructor() {
    this.configManager = new ConfigManager('user');
    this.loadUserInfo();
  }

  /**
   * 加载用户信息
   */
  private loadUserInfo(): void {
    try {
      const savedUserInfo = this.configManager.get('userInfo');
      if (savedUserInfo) {
        this.userInfo = savedUserInfo;
      } else {
        // 默认用户信息
        this.userInfo = DEFAULT_USER_INFO;
        this.saveUserInfo();
      }
    } catch (error) {
      logger.error('Failed to load user info:', error);
      // 设置默认用户信息
      this.userInfo = DEFAULT_USER_INFO;
    }
  }

  /**
   * 保存用户信息
   */
  private saveUserInfo(): void {
    try {
      if (this.userInfo) {
        this.configManager.set('userInfo', this.userInfo);
      }
    } catch (error) {
      logger.error('Failed to save user info:', error);
    }
  }

  /**
   * 获取用户信息
   * @returns 用户信息对象
   */
  getUserInfo(): UserInfo {
    if (!this.userInfo) {
      this.loadUserInfo();
    }
    return this.userInfo || DEFAULT_USER_INFO;
  }

  /**
   * 更新用户信息
   * @param info 新的用户信息
   * @returns 是否更新成功
   */
  updateUserInfo(info: Partial<UserInfo>): boolean {
    try {
      if (!this.userInfo) {
        this.loadUserInfo();
      }

      if (this.userInfo) {
        this.userInfo = { ...this.userInfo, ...info };
        this.saveUserInfo();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to update user info:', error);
      return false;
    }
  }

  /**
   * 登录用户
   * @param credentials 登录凭证
   * @returns 登录结果
   */
  async login(credentials: { username: string; password: string }): Promise<boolean> {
    try {
      // 模拟登录过程
      // 实际应用中应该调用真实的登录API
      logger.info('Login attempt with:', credentials.username);

      // 模拟登录成功
      this.userInfo = {
        name: credentials.username,
        avatar: 'https://picsum.photos/200',
        userId: `user_${Date.now()}`
      };

      this.saveUserInfo();
      return true;
    } catch (error) {
      logger.error('Login failed:', error);
      return false;
    }
  }

  /**
   * 登出用户
   * @returns 登出结果
   */
  logout(): boolean {
    try {
      this.userInfo = null;
      this.configManager.delete('userInfo');
      return true;
    } catch (error) {
      logger.error('Logout failed:', error);
      return false;
    }
  }
}