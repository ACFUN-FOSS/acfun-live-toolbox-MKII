import { session } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// 定义会话接口
interface AuthSession {
  userId: string;
  username: string;
  token: string;
  expiresAt: number;
  roles: string[];
}

// 定义登录信息接口
interface LoginInfo {
  username: string;
  password: string;
  loginMethod: 'qr' | 'password' | 'guest';
  qrCodeId?: string;
}

// 认证服务类
export class AuthService {
  private static instance: AuthService;
  private sessionStore: Map<string, AuthSession> = new Map();
  private sessionFilePath: string;
  private guestSession: AuthSession = {
    userId: 'guest',
    username: '游客',
    token: 'guest-token',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30天有效期
    roles: ['guest']
  };

  private constructor() {
    // 初始化会话存储路径
    this.sessionFilePath = path.join(__dirname, '../../sessions.json');
    this.loadSessions();
  }

  // 单例模式获取实例
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // 加载会话数据
  private loadSessions(): void {
    try {
      if (fs.existsSync(this.sessionFilePath)) {
        const data = fs.readFileSync(this.sessionFilePath, 'utf8');
        const sessions = JSON.parse(data) as Record<string, AuthSession>;
        Object.entries(sessions).forEach(([token, session]) => {
          if (session.expiresAt > Date.now()) {
            this.sessionStore.set(token, session);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  // 保存会话数据
  private saveSessions(): void {
    try {
      const sessions: Record<string, AuthSession> = {};
      this.sessionStore.forEach((session, token) => {
        sessions[token] = session;
      });
      fs.writeFileSync(this.sessionFilePath, JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }

  // 登录方法
  async login(loginInfo: LoginInfo): Promise<AuthSession> {
    // 游客登录处理
    if (loginInfo.loginMethod === 'guest') {
      return this.guestSession;
    }

    // 真实账号密码登录实现
    if (loginInfo.loginMethod === 'password') {
      try {
        const response = await fetch('https://api.acfun.cn/v2/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: loginInfo.username,
            password: loginInfo.password
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || '登录失败: ' + response.statusText);
        }

        const data = await response.json();
        const newSession: AuthSession = {
          userId: data.userId,
          username: data.username,
          token: data.token,
          expiresAt: Date.now() + data.expiresIn * 1000,
          roles: data.roles || ['user']
        };

        this.sessionStore.set(newSession.token, newSession);
        this.saveSessions();
        return newSession;
      } catch (error) {
        console.error('登录API调用失败:', error);
        throw new Error('登录失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    }

    // 二维码登录处理（实际项目中需要实现二维码验证逻辑）
    if (loginInfo.loginMethod === 'qr' && loginInfo.qrCodeId) {
      throw new Error('二维码登录功能尚未实现');
    }

    throw new Error('无效的登录方式');
  }

  // 登出方法
  async logout(token?: string): Promise<void> {
    if (token) {
      this.sessionStore.delete(token);
      this.saveSessions();
    } else {
      // 清除当前会话
      const currentSession = session.defaultSession;
      await currentSession.clearStorageData();
    }
  }

  // 检查认证状态
  async checkStatus(token?: string): Promise<AuthSession | null> {
    if (!token) {
      return null;
    }

    // 游客会话特殊处理
    if (token === 'guest-token') {
      return this.guestSession;
    }

    const session = this.sessionStore.get(token);
    if (session && session.expiresAt > Date.now()) {
      return session;
    }

    // 会话过期或不存在
    if (session) {
      this.sessionStore.delete(token);
      this.saveSessions();
    }
    return null;
  }

  // 获取当前令牌
  async getCurrentToken(): Promise<string | null> {
    try {
      const sessions = Array.from(this.sessionStore.values());
      const now = Date.now();
      // 查找未过期的最新会话
      const validSession = sessions
        .filter(s => s.expiresAt > now)
        .sort((a, b) => b.expiresAt - a.expiresAt)[0];
      return validSession?.token || null;
    } catch (error) {
      console.error('获取当前令牌失败:', error);
      return null;
    }
  }

  // 验证权限
  hasPermission(token: string, requiredPermission: string): boolean {
    const session = this.sessionStore.get(token);
    if (!session) {
      return false;
    }

    // 管理员拥有所有权限
    if (session.roles.includes('admin')) {
      return true;
    }

    // 这里可以实现更复杂的权限验证逻辑
    return session.roles.includes(requiredPermission);
  }
}

export const authService = AuthService.getInstance();