import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { logger } from './utils/logger';
import { ApiRegistry } from './apis';
import { ConfigManager } from './core/ConfigManager';
import notificationModule from './modules/NotificationModule';
import errorHandlingModule from './modules/ErrorHandlingModule';
import analyticsModule from './modules/AnalyticsModule';
import { ModuleContext } from './core/ModuleContext';

// 声明全局应用名称
declare global {
  var appName: string;
}

globalThis.appName = 'AcfunLiveToolbox';

// 初始化核心服务
const configManager = new ConfigManager();

// 确保单实例运行
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

// 创建主窗口
function createWindow() {
  // 从配置获取窗口尺寸
  configManager.get('windowSize').then(windowSize => {
    mainWindow = new BrowserWindow({
      width: windowSize?.width || 1024,
      height: windowSize?.height || 768,
      title: globalThis.appName,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true
      },
      show: false,
      frame: true,
      titleBarStyle: 'default'
    });

    // 创建模块上下文
    const moduleContext: ModuleContext = {
      mainWindow,
      appDataPath: app.getPath('userData'),
      appVersion: app.getVersion(),
      configStore: new Map()
    };

    // 初始化所有模块
    notificationModule.enable(moduleContext);
    errorHandlingModule.enable(moduleContext);
    analyticsModule.enable(moduleContext);

    // 加载应用页面
    if (process.env.NODE_ENV === 'development') {
      mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // 窗口准备就绪后显示
    mainWindow.on('ready-to-show', () => {
      mainWindow?.show();
    });

    // 窗口关闭事件
    mainWindow.on('closed', () => {
      // 保存窗口尺寸
      if (mainWindow) {
        const { width, height } = mainWindow.getBounds();
        configManager.set('windowSize', { width, height });
      }
      mainWindow = null;
    });

    // 注册API接口
    ApiRegistry.register(mainWindow);
  });
}

// 应用就绪事件
app.on('ready', () => {
  logger.info('应用启动');
  createWindow();
});

// 所有窗口关闭事件
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用激活事件
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 第二实例启动事件
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// 错误捕获
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
});