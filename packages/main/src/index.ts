import type { AppInitConfig } from './AppInitConfig.js';
import { createModuleRunner } from './ModuleRunner.js';
import { createAcfunDanmuModule } from './modules/AcfunDanmuModule.js';
import { disallowMultipleAppInstance } from './modules/SingleInstanceApp.js';
import { createWindowManagerModule } from './modules/WindowManager.js';
import { terminateAppOnLastWindowClose } from './modules/ApplicationTerminatorOnLastWindowClose.js';
import { hardwareAccelerationMode } from './modules/HardwareAccelerationModule.js';
import { autoUpdater } from './modules/AutoUpdater.js';
import { chromeDevToolsExtension } from './modules/ChromeDevToolsExtension.js';
import { HttpManager } from './utils/HttpManager.js';
import { ConfigManager } from './utils/ConfigManager.js';
import { DataManager } from './utils/DataManager.js';
import { AppManager } from './utils/AppManager.js';
<<<<<<< HEAD
import { AuthManager } from './utils/AuthManager.js';
import { initializeElectronApi } from './apis/electronApi';
import { initializeLiveApi } from './apis/liveApi';
import { initializeStatsApi } from './apis/statsApi';
import { initializeAuthApi } from './apis/authApi';
import { httpApi } from './apis/httpApi.js';
import { app, ipcMain } from "electron";
=======
import { initializeElectronApi } from './apis/electronApi.js';
import { initializeHttpApi } from './apis/httpApi.js';
import { app } from "electron";
>>>>>>> 800cd5e (Add AcfunDanmu module and HTTP API integration)

export async function initApp(initConfig: AppInitConfig) {
    const moduleRunner = createModuleRunner()
        .init(disallowMultipleAppInstance())
        .init(terminateAppOnLastWindowClose())
        .init(hardwareAccelerationMode({ enable: true }))
        .init(autoUpdater())
        .init(createAcfunDanmuModule({ debug: process.env.NODE_ENV === 'development' }))
    // Install DevTools extension if needed
    // .init(chromeDevToolsExtension({extension: 'VUEJS3_DEVTOOLS'}))
    // 初始化Electron API
initializeElectronApi();

// 初始化直播API
initializeLiveApi();

// 初始化统计API
initializeStatsApi();

// 初始化认证API
initializeAuthApi();

    globalThis.appName = app.getName();
    globalThis.appVersion = app.getVersion();

    // 延迟初始化WindowManager，确保IPC事件处理器已注册
    const windowManager = createWindowManagerModule({ initConfig, openDevTools: process.env.NODE_ENV === 'development' });
    moduleRunner.init(windowManager);

    // 初始化全局变量
    globalThis.configManager = new ConfigManager();
    globalThis.dataManager = DataManager.getInstance();
    globalThis.httpManager = new HttpManager();
    // Initialize HTTP server to set APP_DIR before AppManager uses it
    await globalThis.httpManager.initializeServer(); // <-- Add this line
<<<<<<< HEAD
// 挂载HTTP API
globalThis.httpManager.addApiRoutes('/api', httpApi);
=======

    // 初始化HTTP API并挂载路由
    const apiRouter = initializeHttpApi();
    globalThis.httpManager.addApiRoutes('/api', apiRouter);
>>>>>>> 800cd5e (Add AcfunDanmu module and HTTP API integration)
    // 初始化应用
      globalThis.appManager = new AppManager();
      // 初始化认证管理器
      globalThis.authManager = AuthManager.getInstance();

      // 添加获取进程列表的事件监听器
      ipcMain.on('get-process-list', (event) => {
        try {
          // 获取当前进程列表
          // 注意：在实际应用中，你可能需要使用系统API或第三方库来获取进程列表
          // 这里只是一个示例
          const processes = [{
            pid: process.pid,
            name: 'main-process',
            command: process.execPath,
            args: process.argv
          }];
          // 发送响应
          event.reply('process-list-response', processes);
        } catch (error) {
          console.error('获取进程列表失败:', error);
          event.reply('process-list-response', []);
        }
      });

      // 添加启动进程的事件监听器
      ipcMain.on('start-process', (event, { command, args, cwd }) => {
        try {
          const { spawn } = require('child_process');
          const options = cwd ? { cwd } : {};
          const child = spawn(command, args || [], options);
          console.log(`启动进程: ${command} ${args?.join(' ') || ''}`);
          // 在实际应用中，你可能需要存储子进程引用以便后续管理
        } catch (error) {
          console.error('启动进程失败:', error);
        }
      });

      // 添加终止进程的事件监听器
      ipcMain.on('stop-process', (event, { pid }) => {
        try {
          // 在实际应用中，你需要确保这个pid是由应用启动的子进程
          // 直接终止任意进程可能会有安全风险
          process.kill(pid);
          console.log(`终止进程: ${pid}`);
        } catch (error) {
          console.error('终止进程失败:', error);
        }
      });
    await globalThis.appManager.init();
    globalThis.dataManager.setAppManager(globalThis.appManager);

    await moduleRunner;

    // 应用数据准备就绪后通过windowManager通知所有窗口
    windowManager.getWindows().forEach((window: Electron.BrowserWindow) => {
      if (!window.isDestroyed()) {
        window.webContents.send('apps-ready');
      }
    });
}