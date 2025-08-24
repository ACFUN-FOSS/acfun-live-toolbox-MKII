// 用户认证管理
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { EventEmitter } from 'events';
import { ConfigManager } from './ConfigManager.js';
import crypto from 'crypto';
import axios from 'axios';
import { DataManager } from './DataManager';

export interface UserInfo {
  userId: string;
  username: string;
  avatar: string;
  token: string;
  permissions: string[];
  expireTime: number;
}

export class AuthManager extends EventEmitter {
  private static instance: AuthManager;
  private isLoggedIn: boolean = false;
  private userInfo: UserInfo | null = null;
  private configManager: ConfigManager = globalThis.configManager;
  private loginWindow: BrowserWindow | null = null;
  private apiBaseUrl: string = 'https://api.acfun.cn';

  private constructor() {
    super();
    this.init();
  }

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private async init(): Promise<void> {
    // 尝试从配置中加载登录状态
    await this.loadAuthState();

    // 注册IPC事件
    ipcMain.on('auth:login', this.handleLogin.bind(this));
    ipcMain.on('auth:logout', this.handleLogout.bind(this));
    ipcMain.on('auth:getUserInfo', this.handleGetUserInfo.bind(this));
    ipcMain.on('auth:checkPermission', this.handleCheckPermission.bind(this));

    // 定期检查登录状态
    setInterval(this.checkLoginStatus.bind(this), 60000); // 每分钟检查一次
  }

  private async loadAuthState(): Promise<void> {
    try {
      const savedAuth = await this.configManager.readConfig('auth');
      if (savedAuth && savedAuth.userInfo && savedAuth.expireTime > Date.now()) {
        this.userInfo = savedAuth.userInfo;
        this.isLoggedIn = true;
        this.emit('login', this.userInfo);
        DataManager.getInstance().set('userInfo', this.userInfo);
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
    }
  }

  public async handleLogin(event: Electron.IpcMainEvent): Promise<void> {
    try {
      // 生成登录二维码
      const qrCodeData = await this.generateLoginQrCode();

      // 创建登录窗口
      this.createLoginWindow(qrCodeData);

      // 监听登录状态
      const loginResult = await this.pollLoginStatus(qrCodeData.token);

      if (loginResult.success) {
        this.userInfo = loginResult.userInfo;
        this.isLoggedIn = true;

        // 保存登录状态
        await this.configManager.saveConfig('auth', {
          userInfo: this.userInfo,
          expireTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7天有效期
        });

        // 通知成功
        event.reply('auth:login-success', this.userInfo);
        this.emit('login', this.userInfo);
        DataManager.getInstance().set('userInfo', this.userInfo);

        // 关闭登录窗口
        if (this.loginWindow) {
          this.loginWindow.close();
          this.loginWindow = null;
        }
      } else {
        event.reply('auth:login-failed', { message: loginResult.message });
      }
    } catch (error) {
      console.error('Login error:', error);
      event.reply('auth:login-failed', { message: '登录失败，请重试' });
    }
  }

  private async generateLoginQrCode(): Promise<{ token: string; qrCodeUrl: string }> {
    try {
      // 生成随机token
      const token = crypto.randomBytes(16).toString('hex');

      // 调用API生成二维码
      const response = await axios.post(`${this.apiBaseUrl}/login/qrcode`, {
        token,
        clientType: 'DESKTOP_APP',
      });

      return {
        token,
        qrCodeUrl: response.data.qrCodeUrl,
      };
    } catch (error) {
      console.error('Generate QR code error:', error);
      throw new Error('生成登录二维码失败');
    }
  }

  private createLoginWindow(qrCodeData: { token: string; qrCodeUrl: string }): void {
    this.loginWindow = new BrowserWindow({
      width: 400,
      height: 500,
      resizable: false,
      maximizable: false,
      parent: BrowserWindow.getFocusedWindow() || undefined,
      modal: true,
      webPreferences: {
        preload: `${__dirname}/preload.js`,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // 加载登录页面
    this.loginWindow.loadFile(path.join(__dirname, '../../../renderer/login.html'), {
      query: {
        qrCodeUrl: qrCodeData.qrCodeUrl,
        token: qrCodeData.token,
      },
    });

    // 监听窗口关闭事件
    this.loginWindow.on('closed', () => {
      this.loginWindow = null;
    });
  }

  private async pollLoginStatus(token: string): Promise<{ success: boolean; userInfo?: UserInfo; message?: string }> {
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        try {
          const response = await axios.get(`${this.apiBaseUrl}/login/qrcode/status`, {
            params: { token },
          });

          if (response.data.status === 'SCANNED') {
            // 二维码已扫描，等待确认
            this.loginWindow?.webContents.send('auth:qr-scanned');
          } else if (response.data.status === 'CONFIRMED') {
            // 已确认登录
            clearInterval(interval);
            const userInfo: UserInfo = {
              userId: response.data.userId,
              username: response.data.username,
              avatar: response.data.avatar,
              token: response.data.token,
              permissions: response.data.permissions || [],
              expireTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
            };
            resolve({ success: true, userInfo });
          } else if (response.data.status === 'EXPIRED') {
            // 二维码已过期
            clearInterval(interval);
            resolve({ success: false, message: '登录二维码已过期' });
          }
        } catch (error) {
          console.error('Poll login status error:', error);
          clearInterval(interval);
          resolve({ success: false, message: '查询登录状态失败' });
        }
      }, 2000); // 每2秒查询一次
    });
  }

  public async handleLogout(event: Electron.IpcMainEvent): Promise<void> {
    try {
      // 清除登录状态
      this.isLoggedIn = false;
      this.userInfo = null;

      // 删除保存的认证信息
      await this.configManager.deleteConfig('auth');

      // 通知
      event.reply('auth:logout-success');
      this.emit('logout');
      DataManager.getInstance().delete('userInfo');
    } catch (error) {
      console.error('Logout error:', error);
      event.reply('auth:logout-failed', { message: '登出失败，请重试' });
    }
  }

  public handleGetUserInfo(event: Electron.IpcMainEvent): void {
    event.reply('auth:user-info', this.userInfo);
  }

  public handleCheckPermission(event: Electron.IpcMainEvent, permission: string): void {
    const hasPermission = this.isLoggedIn && this.userInfo?.permissions.includes(permission);
    event.reply('auth:permission-check', hasPermission);
  }

  public checkLoginStatus(): void {
    if (this.isLoggedIn && this.userInfo && this.userInfo.expireTime < Date.now()) {
      // 登录已过期
      this.handleLogout({} as Electron.IpcMainEvent);
    }
  }

  public isAuthenticated(): boolean {
    return this.isLoggedIn;
  }

  public getUserInfo(): UserInfo | null {
    return this.userInfo;
  }
}

// 初始化AuthManager并挂载到globalThis
globalThis.authManager = AuthManager.getInstance();