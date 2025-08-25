import { ipcMain } from 'electron';
import { getLogManager } from '../utils/LogManager.js';
import { acfunDanmuModule } from '../modules/AcfunDanmuModule.js';
import settingsModule from '../modules/SettingsModule.js';
import UserModule from '../modules/UserModule.js';
import DashboardModule from '../modules/DashboardModule.js';

// 初始化用户模块和仪表盘模块
const userModule = new UserModule();
const dashboardModule = new DashboardModule();

// 从全局应用管理器获取直播管理模块实例
let liveManagementModule: any;

// 监听应用就绪事件，以便获取模块实例
ipcMain.on('apps-ready', () => {
  liveManagementModule = globalThis.appManager.getModule('LiveManagementModule');
  if (!liveManagementModule) {
    console.error('Failed to get LiveManagementModule instance from AppManager');
  }
});

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
    // 直播管理模块相关API
    // 获取房间信息
    ipcMain.handle('live:getRoomInfo', async () => {
        try {
            const roomInfo = await liveManagementModule.getRoomInfo();
            return { success: true, data: roomInfo };
        } catch (error) {
            console.error('Error getting room info:', error);
            return { success: false, error: 'Failed to get room info' };
        }
    });

    // 更新房间信息
    ipcMain.handle('live:updateRoomInfo', async (_, info) => {
        try {
            await liveManagementModule.updateRoomInfo(info);
            return { success: true };
        } catch (error) {
            console.error('Error updating room info:', error);
            return { success: false, error: 'Failed to update room info' };
        }
    });

    // 获取推流码
    ipcMain.handle('live:getStreamKey', async () => {
        try {
            const streamKeyInfo = await liveManagementModule.getStreamKey();
            return { success: true, data: streamKeyInfo };
        } catch (error) {
            console.error('Error getting stream key:', error);
            return { success: false, error: 'Failed to get stream key' };
        }
    });

    // 刷新推流码
    ipcMain.handle('live:refreshStreamKey', async () => {
        try {
            const streamKeyInfo = await liveManagementModule.refreshStreamKey();
            return { success: true, data: streamKeyInfo };
        } catch (error) {
            console.error('Error refreshing stream key:', error);
            return { success: false, error: 'Failed to refresh stream key' };
        }
    });

    // 连接OBS
    ipcMain.handle('live:connectOBS', async () => {
        try {
            await liveManagementModule.connectOBS();
            return { success: true };
        } catch (error) {
            console.error('Error connecting to OBS:', error);
            return { success: false, error: 'Failed to connect to OBS' };
        }
    });

    // 获取OBS状态
    ipcMain.handle('live:getOBSStatus', async () => {
        try {
            const status = liveManagementModule.getOBSStatus();
            return { success: true, data: { status } };
        } catch (error) {
            console.error('Error getting OBS status:', error);
            return { success: false, error: 'Failed to get OBS status' };
        }
    });

    // 获取推流状态
    ipcMain.handle('live:getStreamStatus', async () => {
        try {
            const status = liveManagementModule.getStreamStatus();
            return { success: true, data: { status } };
        } catch (error) {
            console.error('Error getting stream status:', error);
            return { success: false, error: 'Failed to get stream status' };
        }
    });

    // 停止推流
    ipcMain.handle('live:stopStream', async () => {
        try {
            await liveManagementModule.stopStream();
            return { success: true };
        } catch (error) {
            console.error('Error stopping stream:', error);
            return { success: false, error: 'Failed to stop stream' };
        }
    });

    // 启动推流
    ipcMain.handle('live:startStream', async () => {
        try {
            await liveManagementModule.startStream();
            return { success: true };
        } catch (error) {
            console.error('Error starting stream:', error);
            return { success: false, error: 'Failed to start stream' };
        }
    });

    // Acfun弹幕模块相关API
    // 设置模块相关API
    // 获取应用设置
    ipcMain.handle('settings:getSettings', async () => {
        try {
            const settings = await settingsModule.getSettings();
            return { success: true, data: settings };
        } catch (error) {
            console.error('Error getting settings:', error);
            return { success: false, error: 'Failed to get settings' };
        }
    });

    // 更新应用设置
    ipcMain.handle('settings:updateSettings', async (_, settings) => {
        try {
            const result = await settingsModule.updateSettings(settings);
            return { success: result };
        } catch (error) {
            console.error('Error updating settings:', error);
            return { success: false, error: 'Failed to update settings' };
        }
    });

    // 打开设置文件夹
    ipcMain.handle('settings:openSettingsFolder', async (_, folderType: string) => {
        try {
            settingsModule.openSettingsFolder(folderType);
            return { success: true };
        } catch (error) {
            console.error('Error opening settings folder:', error);
            return { success: false, error: 'Failed to open settings folder' };
        }
    });

    // 选择推流工具路径
    ipcMain.handle('settings:selectStreamToolPath', async () => {
        try {
            const path = await settingsModule.selectStreamToolPath();
            return { success: true, data: path };
        } catch (error) {
            console.error('Error selecting stream tool path:', error);
            return { success: false, error: 'Failed to select stream tool path' };
        }
    });

    // 备份配置
    ipcMain.handle('settings:backupConfig', async () => {
        try {
            const backupPath = await settingsModule.backupConfig();
            return { success: !!backupPath, data: backupPath };
        } catch (error) {
            console.error('Error backing up config:', error);
            return { success: false, error: 'Failed to backup config' };
        }
    });

    // 还原配置
    ipcMain.handle('settings:restoreConfig', async (_, backupPath) => {
        try {
            const result = await settingsModule.restoreConfig(backupPath);
            return { success: result };
        } catch (error) {
            console.error('Error restoring config:', error);
            return { success: false, error: 'Failed to restore config' };
        }
    });

    // 清理缓存
    ipcMain.handle('settings:clearCache', async (_, cacheType: string) => {
        try {
            const result = await settingsModule.clearCache(cacheType);
            return { success: result };
        } catch (error) {
            console.error('Error clearing cache:', error);
            return { success: false, error: 'Failed to clear cache' };
        }
    });

    // 用户相关API
    ipcMain.handle('user:getUserInfo', async () => {
        try {
            const userInfo = userModule.getUserInfo();
            return { success: true, data: userInfo };
        } catch (error) {
            console.error('Error getting user info:', error);
            return { success: false, error: 'Failed to get user info' };
        }
    });

    // 仪表盘相关API
    ipcMain.handle('dashboard:getStats', async () => {
        try {
            const stats = dashboardModule.getStats();
            return { success: true, data: stats };
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            return { success: false, error: 'Failed to get dashboard stats' };
        }
    });

    ipcMain.handle('dashboard:getDynamicBlocks', async () => {
        try {
            const blocks = dashboardModule.getDynamicBlocks();
            return { success: true, data: blocks };
        } catch (error) {
            console.error('Error getting dynamic blocks:', error);
            return { success: false, error: 'Failed to get dynamic blocks' };
        }
    });

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