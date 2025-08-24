import { app, ipcMain, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { AuthManager, UserInfo } from '../utils/AuthManager';
import { ConfigManager } from '../utils/ConfigManager';

// 认证状态事件发射器
const authStatusEmitter = new EventEmitter();

// 认证管理器实例
const authManager = AuthManager.getInstance();

// 配置管理器实例
const configManager = new ConfigManager();

/**
 * 初始化认证API
 */
export function initializeAuthApi() {
  console.log('Initializing Auth API...');

  // 设置认证状态变更事件监听
  setupAuthStateListeners();

  // 注册IPC事件处理器
  registerIpcHandlers();

  // 同步初始认证状态
  syncAuthState();
}

/**
 * 同步认证状态
 */
function syncAuthState() {
  const currentState = authManager.getAuthState();
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('auth-status-changed', currentState);
    }
  });
}

/**
 * 设置认证状态变更事件监听
 */
function setupAuthStateListeners() {
  // 监听AuthManager的登录事件
  authManager.on('login', (userInfo: UserInfo) => {
    console.log('User logged in:', userInfo.username);
    const authState = authManager.getAuthState();

    // 通知所有窗口认证状态变更
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('auth-status-changed', authState);
        window.webContents.send('auth:login-success', userInfo);
      }
    });
  });

  // 监听AuthManager的登出事件
  authManager.on('logout', () => {
    console.log('User logged out');
    const authState = authManager.getAuthState();

    // 通知所有窗口认证状态变更
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('auth-status-changed', authState);
        window.webContents.send('auth:logout-success');
      }
    });
  });
}

/**
 * 注册IPC事件处理器
 */
function registerIpcHandlers() {
  // 获取认证状态
  ipcMain.on('get-auth-status', (event) => {
    const authState = authManager.getAuthState();
    event.reply('auth-status-response', authState);
  });

  // 生成登录二维码
  ipcMain.on('generate-login-qr-code', async (event) => {
    try {
      // 调用AuthManager生成二维码
      const qrCodeData = await authManager.generateLoginQrCode();
      event.reply('login-qr-code-generated', qrCodeData);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      event.reply('login-qr-code-error', { message: error.message });
    }
  });

  // 登录
  ipcMain.on('auth:login', async (event, loginData) => {
    try {
      // 委托给AuthManager处理登录
      if (loginData && loginData.username && loginData.password) {
        // 密码登录
        await authManager.loginWithCredentials(loginData.username, loginData.password, loginData.rememberMe || false);
        event.reply('auth:login-success');
      } else {
        // 二维码登录
        authManager.handleLogin(event);
      }
    } catch (error) {
      console.error('Login failed:', error);
      event.reply('auth:login-failed', { message: error.message });
    }
  });

  // 登出
  ipcMain.on('auth:logout', async (event) => {
    try {
      // 调用AuthManager的登出方法
      authManager.logout();
      event.reply('auth:logout-success');
    } catch (error) {
      console.error('Logout failed:', error);
      event.reply('auth:logout-failed', { message: error.message });
    }
  });

  // 获取用户信息
  ipcMain.on('auth:getUserInfo', (event) => {
    const userInfo = authManager.getAuthState().userInfo;
    event.reply('auth:getUserInfo-response', { userInfo });
  });

  // 检查权限
  ipcMain.on('auth:checkPermission', (event, permission) => {
    try {
      const hasPermission = authManager.getAuthState().userInfo?.permissions.includes(permission) || false;
      event.reply('auth:checkPermission-response', { hasPermission });
    } catch (error) {
      console.error('Check permission failed:', error);
      event.reply('auth:checkPermission-error', { message: error.message });
    }
  });
}

// 导出认证状态事件发射器，供其他模块使用
export { authStatusEmitter };