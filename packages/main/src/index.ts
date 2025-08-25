import type { AppInitConfig } from './AppInitConfig.js';
import { createModuleRunner } from './ModuleRunner.js';
import { createAcfunDanmuModule } from './modules/AcfunDanmuModule.js';
import { LiveManagementModule } from './modules/LiveManagementModule.js';

// 创建直播管理模块的工厂函数
function createLiveManagementModule(config: { debug?: boolean } = {}): LiveManagementModule {
  return new LiveManagementModule(config);
}
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
import { initializeElectronApi } from './apis/electronApi.js';
import { initializeHttpApi } from './apis/httpApi.js';
import { app } from "electron";

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

    // 初始化HTTP API并挂载路由
    const apiRouter = initializeHttpApi();
    globalThis.httpManager.addApiRoutes('/api', apiRouter);
    
    // 初始化EventSource服务
    import('./initEventSource.js')
      .then(({ initEventSourceServices }) => {
        initEventSourceServices();
      })
      .catch(error => {
        console.error('Failed to initialize EventSource services:', error);
      });

    // 初始化应用
    globalThis.appManager = new AppManager();
    await globalThis.appManager.init();
    globalThis.dataManager.setAppManager(globalThis.appManager);

    // 创建LiveManagementModule实例
    const liveManagementModule = createLiveManagementModule({ debug: process.env.NODE_ENV === 'development' });
    // 初始化模块
    moduleRunner.init(liveManagementModule);
    // 注册到AppManager
    globalThis.appManager.registerModule('LiveManagementModule', liveManagementModule);

    await moduleRunner;

    // 应用数据准备就绪后通过windowManager通知所有窗口
    windowManager.getWindows().forEach((window: Electron.BrowserWindow) => {
      if (!window.isDestroyed()) {
        window.webContents.send('apps-ready');
      }
    });
}