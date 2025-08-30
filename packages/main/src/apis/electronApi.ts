import { ipcMain } from 'electron';
import { authService } from '../utils/AuthService.js';
import { errorHandlingService } from '../utils/ErrorHandlingService';
import { notificationService } from '../utils/NotificationService';

// 用户认证相关API
ipcMain.handle('login', async (event, loginInfo) => {
  try {
    const session = await authService.login(loginInfo);
    return { success: true, session };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('logout', async () => {
  try {
    await authService.logout();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('checkAuthStatus', async () => {
  try {
    const status = await authService.checkStatus();
    return { success: true, status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
import { getLogManager } from '../utils/LogManager.js';
import { acfunDanmuModule } from '../modules/AcfunDanmuModule.js';
import settingsModule from '../modules/SettingsModule.js';
import UserModule from '../modules/UserModule.js';
import DashboardModule from '../modules/DashboardModule.js';
import { appManager } from '../utils/AppManager';

// 初始化用户模块和仪表盘模块
const userModule = new UserModule();
const dashboardModule = new DashboardModule();

// 从全局应用管理器获取直播管理模块实例
let liveManagementModule: any;

// 监听应用就绪事件，以便获取模块实例
ipcMain.on('apps-ready', () => {
  liveManagementModule = globalThis.appManager.getModule('LiveManagementModule');
  if (!liveManagementModule) {
    logger.error('Failed to get LiveManagementModule instance from AppManager');
  }
});

// 窗口管理相关API实现
// 应用管理相关API实现
// Acfun弹幕模块管理API实现

    // 注册应用模块
    ipcMain.handle('app:registerModule', async (_, moduleName: string, modulePath: string) => {
        try {
            const appManager = globalThis.appManager as AppManager;
            await appManager.registerModule(moduleName, modulePath);
            return { success: true };
        } catch (error) {
            console.error('Error registering app module:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 启用应用模块
    ipcMain.handle('app:enableModule', async (_, moduleName: string) => {
        try {
            const appManager = globalThis.appManager as AppManager;
            await appManager.enableModule(moduleName);
            return { success: true };
        } catch (error) {
            console.error('Error enabling app module:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
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
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 更新房间信息
    ipcMain.handle('live:updateRoomInfo', async (_, info) => {
        try {
            await liveManagementModule.updateRoomInfo(info);
            return { success: true };
        } catch (error) {
            console.error('Error updating room info:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 获取推流码
    ipcMain.handle('live:getStreamKey', async () => {
        try {
            const streamKeyInfo = await liveManagementModule.getStreamKey();
            return { success: true, data: streamKeyInfo };
        } catch (error) {
            console.error('Error getting stream key:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 刷新推流码
    ipcMain.handle('live:refreshStreamKey', async () => {
        try {
            const streamKeyInfo = await liveManagementModule.refreshStreamKey();
            return { success: true, data: streamKeyInfo };
        } catch (error) {
            console.error('Error refreshing stream key:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 连接OBS
    ipcMain.handle('live:connectOBS', async () => {
        try {
            await liveManagementModule.connectOBS();
            return { success: true };
        } catch (error) {
            console.error('Error connecting to OBS:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 获取OBS状态
    ipcMain.handle('live:getOBSStatus', async () => {
        try {
            const status = liveManagementModule.getOBSStatus();
            return { success: true, data: { status } };
        } catch (error) {
            console.error('Error getting OBS status:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 获取推流状态
    ipcMain.handle('live:getStreamStatus', async () => {
        try {
            const status = liveManagementModule.getStreamStatus();
            return { success: true, data: { status } };
        } catch (error) {
            console.error('Error getting stream status:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 停止推流
    ipcMain.handle('live:stopStream', async () => {
        try {
            await liveManagementModule.stopStream();
            return { success: true };
        } catch (error) {
            console.error('Error stopping stream:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 启动推流
    ipcMain.handle('live:startStream', async () => {
        try {
            await liveManagementModule.startStream();
            return { success: true };
        } catch (error) {
            console.error('Error starting stream:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 同步开播（设置推流码并启动直播）
    ipcMain.handle('live:syncStartBroadcast', async () => {
        try {
            await liveManagementModule.syncStartBroadcast();
            return { success: true };
        } catch (error) {
            console.error('Error syncing and starting broadcast:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('live:saveOBSConfig', async (_, config) => {
        try {
            const result = await liveManagementModule.saveOBSConfig(config);
            return { success: true, data: result };
        } catch (error) {
            console.error('Error saving OBS config:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('live:getOBSConfig', async () => {
        try {
            const result = await liveManagementModule.getOBSConfig();
            return { success: true, data: result };
        } catch (error) {
            console.error('Error getting OBS config:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 直播管理相关API扩展
ipcMain.handle('live:configureRoom', async (_, roomConfig) => {
  try {
    const result = await liveManagementModule.configureRoom(roomConfig);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error configuring room:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('live:startStreaming', async (_, streamConfig) => {
  try {
    const streamInfo = await liveManagementModule.startStreaming(streamConfig);
    return { success: true, data: streamInfo };
  } catch (error) {
    console.error('Error starting streaming:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('live:stopStreaming', async () => {
  try {
    await liveManagementModule.stopStreaming();
    return { success: true };
  } catch (error) {
    console.error('Error stopping streaming:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// 获取直播分类
ipcMain.handle('live:getCategories', async () => {
  try {
    const categories = await liveService.getCategories();
    return { success: true, data: categories };
  } catch (error) {
    console.error('Error fetching categories:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// 获取推流信息
ipcMain.handle('live:getStreamInfo', async () => {
  try {
    const streamInfo = await liveService.getStreamInfo();
    return { success: true, data: streamInfo };
  } catch (error) {
    console.error('Error fetching stream info:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Acfun弹幕模块相关API
    // 发送弹幕
    ipcMain.handle('acfunDanmu:sendDanmu', async (_, liveId: number, content: string) => {
        try {
            await acfunDanmuModule.sendDanmu(liveId, content);
            return { success: true };
        } catch (error) {
            console.error('Error sending danmu:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 获取房管列表
    ipcMain.handle('acfunDanmu:getManagerList', async (_, uid: number, page: number = 1, pageSize: number = 20) => {
        try {
            const result = await acfunDanmuModule.getManagerList(uid, page, pageSize);
            return { success: true, data: result };
        } catch (error) {
            console.error('Error getting manager list:', error);
            return { success: false, error: 'Failed to get manager list' };
        }
    });

    // 添加房管
    ipcMain.handle('acfunDanmu:addManager', async (_, uid: number, targetId: number) => {
        try {
            await acfunDanmuModule.addManager(uid, targetId);
            return { success: true };
        } catch (error) {
            console.error('Error adding manager:', error);
            return { success: false, error: 'Failed to add manager' };
        }
    });

    // 移除房管
    ipcMain.handle('acfunDanmu:removeManager', async (_, uid: number, targetId: number) => {
        try {
            await acfunDanmuModule.removeManager(uid, targetId);
            return { success: true };
        } catch (error) {
            console.error('Error removing manager:', error);
            return { success: false, error: 'Failed to remove manager' };
        }
    });

    // 获取直播状态
    ipcMain.handle('acfunDanmu:getLiveStatus', async (_, liveId: number) => {
        try {
            const result = await acfunDanmuModule.getLiveStatus(liveId);
            return { success: true, data: result };
        } catch (error) {
            console.error('Error getting live status:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 启动直播
    ipcMain.handle('acfunDanmu:startLive', async (_, categoryId: number, title: string, coverUrl: string) => {
        try {
            await acfunDanmuModule.startLive(categoryId, title, coverUrl);
            return { success: true };
        } catch (error) {
            console.error('Error starting live:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // 停止直播
    ipcMain.handle('acfunDanmu:stopLive', async () => {
        try {
            await acfunDanmuModule.stopLive();
            return { success: true };
        } catch (error) {
            console.error('Error stopping live:', error);
            return { success: false, error: 'Failed to stop live' };
        }
    });

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
            const stats = await dashboardModule.getStats();
            return { success: true, data: stats };
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            return { success: false, error: 'Failed to get dashboard stats' };
        }
    });

    ipcMain.handle('dashboard:getDynamicBlocks', async () => {
        try {
            const blocks = await dashboardModule.getDynamicBlocks();
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

    // 小程序管理相关API
    ipcMain.handle('getInstalledMiniPrograms', async () => {
        try {
            const miniPrograms = await appManager.getMiniPrograms();
            return miniPrograms;
        } catch (error) {
            console.error('获取已安装小程序失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });

    ipcMain.handle('getMarketplaceApps', async () => {
        try {
            const marketplaceApps = await appManager.getMarketplaceApps();
            return marketplaceApps;
        } catch (error) {
            console.error('获取小程序市场应用失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });

    ipcMain.handle('installMiniProgram', async (_, name: string, source: string) => {
        try {
            await appManager.installMiniProgram(name, source);
            return { success: true };
        } catch (error) {
            console.error('安装小程序失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });

    ipcMain.handle('startMiniProgram', async (_, id: string) => {
        try {
            await appManager.startApp(id);
            return { success: true };
        } catch (error) {
            console.error('启动小程序失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });

    ipcMain.handle('stopMiniProgram', async (_, id: string) => {
        try {
            await appManager.closeApp(id);
            return { success: true };
        } catch (error) {
            console.error('停止小程序失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });

    ipcMain.handle('updateMiniProgram', async (_, id: string) => {
        try {
            await appManager.updateMiniProgram(id);
            return { success: true };
        } catch (error) {
            console.error('更新小程序失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });

    ipcMain.handle('removeMiniProgram', async (_, id: string) => {
        try {
            await appManager.removeMiniProgram(id);
            return { success: true };
        } catch (error) {
            console.error('移除小程序失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });

    // 数据分析相关API
ipcMain.handle('getRealTimeStats', async () => {
  try {
    const stats = await analyticsService.getRealTimeStats();
    return { success: true, data: stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('getAudienceAnalysis', async (event, params) => {
  try {
    const analysis = await analyticsService.getAudienceAnalysis(params);
    return { success: true, data: analysis };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('getGiftStats', async (event, timeRange) => {
  try {
    const stats = await analyticsService.getGiftStats(timeRange);
    return { success: true, data: stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generateReport', async (event, reportType) => {
  try {
    const report = await analyticsService.generateReport(reportType);
    return { success: true, data: report };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 小本本相关API
ipcMain.handle('notebook:getNotes', async () => {
  try {
    const notes = await notebookService.getNotes();
    return { success: true, data: notes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notebook:saveNote', async (event, note) => {
  try {
    const savedNote = await notebookService.saveNote(note);
    return { success: true, data: savedNote };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notebook:deleteNote', async (event, noteId) => {
  try {
    await notebookService.deleteNote(noteId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notebook:getNoteById', async (event, noteId) => {
  try {
    const note = await notebookService.getNoteById(noteId);
    return { success: true, data: note };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 系统设置相关API
ipcMain.handle('systemSettings:getAll', async () => {
  try {
    const settings = await systemSettingsService.getAllSettings();
    return { success: true, data: settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('systemSettings:getByCategory', async (event, category) => {
  try {
    const settings = await systemSettingsService.getSettingsByCategory(category);
    return { success: true, data: settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('systemSettings:updateByCategory', async (event, { category, settings }) => {
  try {
    const updatedSettings = await systemSettingsService.updateSettingsByCategory(category, settings);
    return { success: true, data: updatedSettings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('systemSettings:resetToDefault', async (event, category) => {
  try {
    let result;
    if (category) {
      result = await systemSettingsService.resetCategoryToDefault(category);
    } else {
      result = await systemSettingsService.resetToDefault();
    }
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

    // 错误处理相关API
    ipcMain.handle('error:logError', async (event, errorInfo) => {
      try {
        const errorId = await errorHandlingService.logError(errorInfo);
        return { success: true, data: { errorId } };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('error:getErrorHistory', async (event, params) => {
      try {
        const errors = await errorHandlingService.getErrorHistory(params);
        return { success: true, data: errors };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('error:clearErrorHistory', async () => {
      try {
        await errorHandlingService.clearErrorHistory();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('error:reportError', async (event, errorId) => {
      try {
        const reportResult = await errorHandlingService.reportError(errorId);
        return { success: true, data: reportResult };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 通知相关API
    ipcMain.handle('notification:getPermissionStatus', async () => {
      try {
        const status = await notificationService.getPermissionStatus();
        return { success: true, data: status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('notification:requestPermission', async () => {
      try {
        const status = await notificationService.requestPermission();
        return { success: true, data: status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('notification:sendTestNotification', async () => {
      try {
        const result = await notificationService.sendNotification({
          title: '测试通知',
          body: '这是一条测试通知，用于验证通知功能是否正常工作',
          type: 'test'
        });
        return { success: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

}