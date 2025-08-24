import { ipcMain } from 'electron';
import { getLogManager } from '../utils/LogManager.js';
import { acfunDanmuModule } from '../modules/AcfunDanmuModule.js';

// 窗口管理相关API实现
// 应用管理相关API实现
// Acfun弹幕模块管理API实现

    // 注册应用模块
    ipcMain.handle('app:registerModule', async (_, moduleName: string, modulePath: string) => {
        try {
            const appManager = globalThis.appManager as any;
            await appManager.registerModule(moduleName, modulePath);
            return { success: true };
        } catch (error) {
            console.error('Error registering app module:', error);
            return { success: false, error: 'Failed to register app module' };
        }
    });

    // 启用应用模块
    ipcMain.handle('app:enableModule', async (_, moduleName: string) => {
        try {
            const appManager = globalThis.appManager as any;
            await appManager.enableModule(moduleName);
            return { success: true };
        } catch (error) {
            console.error('Error enabling app module:', error);
            return { success: false, error: 'Failed to enable app module' };
        }
    });

export function initializeElectronApi() {
    // Acfun弹幕模块相关API
    // 启动Acfun弹幕模块
    ipcMain.handle('acfunDanmu:start', async () => {
        try {
            await acfunDanmuModule.start();
            return { success: true };
        } catch (error) {
            console.error('Error starting acfun danmu module:', error);
            return { success: false, error: 'Failed to start acfun danmu module' };
        }
    });

    // 停止Acfun弹幕模块
    ipcMain.handle('acfunDanmu:stop', async () => {
        try {
            await acfunDanmuModule.stop();
            return { success: true };
        } catch (error) {
            console.error('Error stopping acfun danmu module:', error);
            return { success: false, error: 'Failed to stop acfun danmu module' };
        }
    });

    // 重启Acfun弹幕模块
    ipcMain.handle('acfunDanmu:restart', async () => {
        try {
            await acfunDanmuModule.restart();
            return { success: true };
        } catch (error) {
            console.error('Error restarting acfun danmu module:', error);
            return { success: false, error: 'Failed to restart acfun danmu module' };
        }
    });

    // 更新Acfun弹幕模块配置
    ipcMain.handle('acfunDanmu:updateConfig', async (_, config: Partial<import('../modules/AcfunDanmuModule.js').AcfunDanmuConfig>) => {
        try {
            acfunDanmuModule.updateConfig(config);
            return { success: true };
        } catch (error) {
            console.error('Error updating acfun danmu module config:', error);
            return { success: false, error: 'Failed to update acfun danmu module config' };
        }
    });

    // 获取Acfun弹幕模块配置
    ipcMain.handle('acfunDanmu:getConfig', async () => {
        try {
            const config = acfunDanmuModule.getConfig();
            return { success: true, data: config };
        } catch (error) {
            console.error('Error getting acfun danmu module config:', error);
            return { success: false, error: 'Failed to get acfun danmu module config' };
        }
    });

    // 获取Acfun弹幕模块状态
    ipcMain.handle('acfunDanmu:getStatus', async () => {
        try {
            const status = acfunDanmuModule.getStatus();
            return { success: true, data: status };
        } catch (error) {
            console.error('Error getting acfun danmu module status:', error);
            return { success: false, error: 'Failed to get acfun danmu module status' };
        }
    });

    // 获取Acfun弹幕模块日志
    ipcMain.handle('acfunDanmu:getLogs', async (_, limit: number = 100) => {
        try {
            const logManager = getLogManager();
            const logs = logManager.getLogs('acfunDanmu', limit);
            return { success: true, data: logs };
        } catch (error) {
            console.error('Error getting acfun danmu module logs:', error);
            return { success: false, error: 'Failed to get acfun danmu module logs' };
        }
    });
    // 关闭窗口
    ipcMain.handle('window:close', async (_, windowId?: number) => {
        try {
            const window = await globalThis.windowManager.restoreWindow(windowId);
            if (!window) {
                console.error('Failed to find window for closing');
                return false;
            }
            window.close();
            return true;
        } catch (error) {
            console.error('Error closing window:', error);
            return false;
        }
    });

    // 最小化窗口
    ipcMain.handle('window:minimize', async (_, windowId?: number) => {
        try {
            const window = await globalThis.windowManager.restoreWindow(windowId);
            if (!window) {
                console.error('Failed to find window for minimizing');
                return false;
            }
            window.minimize();
            return true;
        } catch (error) {
            console.error('Error minimizing window:', error);
            return false;
        }
    });

    // 置顶窗口切换
    ipcMain.handle('window:toggleAlwaysOnTop', async (_, windowId?: number, alwaysOnTop?: boolean) => {
        // 通过WindowManager获取目标窗口ID
        const targetWindowId = windowId ?? globalThis.windowManager.getFocusedWindowId();
        if (!targetWindowId) return false;

        // 如果未指定alwaysOnTop参数，则通过WindowManager切换当前状态
        if (alwaysOnTop === undefined) {
            alwaysOnTop = !globalThis.windowManager.isWindowAlwaysOnTop(targetWindowId);
        }

        return globalThis.windowManager.updateWindowProperties(targetWindowId, { alwaysOnTop })
    });

    // 设置窗口是否可聚焦
    ipcMain.handle('window:setFocusable', (_, windowId: number, focusable: boolean) => {
        return globalThis.windowManager.updateWindowProperties(windowId, { focusable })
    });

    // 获取窗口是否置顶
    ipcMain.handle('window:isAlwaysOnTop', (_, windowId?: number) => {
        return globalThis.windowManager.isWindowAlwaysOnTop(windowId);
    });

    // 获取所有窗口
    ipcMain.handle('window:getAllWindows', () => {
        return globalThis.windowManager.getAllWindowsInfo();
    });

    // 获取已安装应用
    ipcMain.handle('app:getInstalledApps', async () => {
        try {
            const appManager = globalThis.appManager as any;
            const apps = Array.from(appManager.apps.entries()).map(([id, config]) => ({
                id,
                ...config
            }));
            return { success: true, data: apps };
        } catch (error) {
            console.error('Error getting installed apps:', error);
            return { success: false, error: 'Failed to get installed apps' };
        }
    });

    // 启动应用
    ipcMain.handle('app:startApp', async (_, appId: string, displayType?: string) => {
        try {
            const appManager = globalThis.appManager as any;
            const window = await appManager.startApp(appId);
            return { success: true, windowId: window.id };
        } catch (error) {
            console.error('Error starting app:', error);
            return { success: false, error: 'Failed to start app' };
        }
    });
}