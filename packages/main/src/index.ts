import type { AppInitConfig } from './AppInitConfig.js';
import { createModuleRunner } from './ModuleRunner.js';
import { disallowMultipleAppInstance } from './modules/SingleInstanceApp.js';
import { createWindowManagerModule } from './modules/WindowManager.js';
import { terminateAppOnLastWindowClose } from './modules/ApplicationTerminatorOnLastWindowClose.js';
import { hardwareAccelerationMode } from './modules/HardwareAccelerationModule.js';
import { autoUpdater } from './modules/AutoUpdater.js';
import { chromeDevToolsExtension } from './modules/ChromeDevToolsExtension.js';
import { HttpManager } from './utils/HttpManager.js';
import { ConfigManager } from './utils/ConfigManager.js';
import { AppManager } from './utils/AppManager.js';
import { initializeElectronApi } from './apis/electronApi.js';
import { app } from "electron";

export async function initApp(initConfig: AppInitConfig) {
    const moduleRunner = createModuleRunner()
        .init(createWindowManagerModule({ initConfig, openDevTools: import.meta.env.DEV }))
        .init(disallowMultipleAppInstance())
        .init(terminateAppOnLastWindowClose())
        .init(hardwareAccelerationMode({ enable: true }))
        .init(autoUpdater())
    // Install DevTools extension if needed
    // .init(chromeDevToolsExtension({extension: 'VUEJS3_DEVTOOLS'}))
    await moduleRunner;

    globalThis.appName = app.getName();
    globalThis.appVersion = app.getVersion();
    // 初始化全局变量
    globalThis.configManager = new ConfigManager();
    globalThis.httpManager = new HttpManager();
    // Initialize HTTP server to set APP_DIR before AppManager uses it
    await globalThis.httpManager.initializeServer(); // <-- Add this line
    // 初始化Electron API
    initializeElectronApi();
    // 初始化应用
    globalThis.appManager = new AppManager();
    await globalThis.appManager.init();
}