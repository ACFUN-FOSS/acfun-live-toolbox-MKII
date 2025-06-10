import type {AppInitConfig} from './AppInitConfig.js';
import {createModuleRunner} from './ModuleRunner.js';
import {disallowMultipleAppInstance} from './modules/SingleInstanceApp.js';
import {createWindowManagerModule} from './modules/WindowManager.js';
import {terminateAppOnLastWindowClose} from './modules/ApplicationTerminatorOnLastWindowClose.js';
import {hardwareAccelerationMode} from './modules/HardwareAccelerationModule.js';
import {autoUpdater} from './modules/AutoUpdater.js';
import {chromeDevToolsExtension} from './modules/ChromeDevToolsExtension.js';
import {initializeServer} from './utils/HttpManager.js';

export async function initApp(initConfig: AppInitConfig) {
  const moduleRunner = createModuleRunner()
    .init(createWindowManagerModule({initConfig, openDevTools: import.meta.env.DEV}))
    .init(disallowMultipleAppInstance())
    .init(terminateAppOnLastWindowClose())
    .init(hardwareAccelerationMode({enable: true}))
    .init(autoUpdater())
    // Install DevTools extension if needed
    .init(chromeDevToolsExtension({extension: 'VUEJS3_DEVTOOLS'}))
  await moduleRunner;

  await initializeServer();
  
}