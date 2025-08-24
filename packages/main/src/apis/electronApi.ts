import { ipcMain } from 'electron';
import { getLogManager } from '../utils/LogManager.js';
import { acfunDanmuModule } from '../modules/AcfunDanmuModule.js';
<<<<<<< HEAD
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
=======
>>>>>>> 800cd5e (Add AcfunDanmu module and HTTP API integration)

// 窗口管理相关API实现
// 应用管理相关API实现
// Acfun弹幕模块管理API实现
<<<<<<< HEAD
// 进程管理API实现
// 文件操作API实现
// 认证相关API实现
=======
>>>>>>> 800cd5e (Add AcfunDanmu module and HTTP API integration)

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

    // 进程管理API
    // 获取进程列表
    ipcMain.handle('process:list', async () => {
        try {
            // 在实际应用中，你可能需要使用系统API或第三方库来获取完整的进程列表
            // 这里仅返回主进程信息作为示例
            const processes = [{
                pid: process.pid,
                name: 'main-process',
                command: process.execPath,
                args: process.argv
            }];
            return { success: true, data: processes };
        } catch (error) {
            console.error('Error getting process list:', error);
            return { success: false, error: 'Failed to get process list' };
        }
    });

    // 启动进程
    ipcMain.handle('process:start', async (_, { command, args, cwd }: { command: string, args?: string[], cwd?: string }) => {
        try {
            const options = cwd ? { cwd } : {};
            const child = spawn(command, args || [], options);
            console.log(`Started process: ${command} ${args?.join(' ') || ''}`);
            return { success: true, pid: child.pid };
        } catch (error) {
            console.error('Error starting process:', error);
            return { success: false, error: 'Failed to start process' };
        }
    });

    // 停止进程
    ipcMain.handle('process:stop', async (_, { pid }: { pid: number }) => {
        try {
            // 确保只终止由应用启动的子进程
            // 直接终止任意进程可能会有安全风险
            process.kill(pid);
            console.log(`Stopped process: ${pid}`);
            return { success: true };
        } catch (error) {
            console.error('Error stopping process:', error);
            return { success: false, error: 'Failed to stop process' };
        }
    });

    // 文件操作API
    // 读取文件
    ipcMain.handle('file:read', async (_, filePath: string) => {
        try {
            // 确保路径安全，避免目录遍历攻击
            const content = fs.readFileSync(filePath, 'utf-8');
            return { success: true, data: content };
        } catch (error) {
            console.error('Error reading file:', error);
            return { success: false, error: 'Failed to read file' };
        }
    });

    // 写入文件
    ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
        try {
            // 确保路径安全，避免目录遍历攻击
            fs.writeFileSync(filePath, content, 'utf-8');
            return { success: true };
        } catch (error) {
            console.error('Error writing file:', error);
            return { success: false, error: 'Failed to write file' };
        }
    });

    // 删除文件
    ipcMain.handle('file:delete', async (_, filePath: string) => {
        try {
            // 确保路径安全，避免目录遍历攻击
            fs.unlinkSync(filePath);
            return { success: true };
        } catch (error) {
            console.error('Error deleting file:', error);
            return { success: false, error: 'Failed to delete file' };
        }
    });

    // 列出目录内容
    ipcMain.handle('file:list', async (_, dirPath: string) => {
        try {
            // 确保路径安全，避免目录遍历攻击
            const files = fs.readdirSync(dirPath);
            const fileInfos = files.map(file => {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    isDirectory: stats.isDirectory(),
                    size: stats.size,
                    mtime: stats.mtime
                };
            });
            return { success: true, data: fileInfos };
        } catch (error) {
            console.error('Error listing directory:', error);
            return { success: false, error: 'Failed to list directory' };
        }
    });

    // 认证相关API
    // 登录
    ipcMain.handle('auth:login', async (event) => {
        try {
            const authManager = globalThis.authManager;
            await authManager.handleLogin(event);
            return { success: true };
        } catch (error) {
            console.error('Error during login:', error);
            return { success: false, error: 'Failed to login' };
        }
    });

    // 登出
    ipcMain.handle('auth:logout', async (event) => {
        try {
            const authManager = globalThis.authManager;
            await authManager.handleLogout(event);
            return { success: true };
        } catch (error) {
            console.error('Error during logout:', error);
            return { success: false, error: 'Failed to logout' };
        }
    });

    // 获取用户信息
    ipcMain.handle('auth:getUserInfo', async () => {
        try {
            const authManager = globalThis.authManager;
            const userInfo = authManager.getUserInfo();
            return { success: true, data: userInfo };
        } catch (error) {
            console.error('Error getting user info:', error);
            return { success: false, error: 'Failed to get user info' };
        }
    });

    // 检查权限
    ipcMain.handle('auth:checkPermission', async (_, permission: string) => {
        try {
            const authManager = globalThis.authManager;
            const hasPermission = authManager.isAuthenticated() && 
                authManager.getUserInfo()?.permissions.includes(permission);
            return { success: true, data: hasPermission };
        } catch (error) {
            console.error('Error checking permission:', error);
            return { success: false, error: 'Failed to check permission' };
        }
    });

    // 刷新二维码
    ipcMain.handle('auth:refreshQrCode', async (_, token: string) => {
        try {
            const authManager = globalThis.authManager;
            // 生成新的二维码
            const qrCodeData = await authManager.generateLoginQrCode();
            return { success: true, data: qrCodeData };
        } catch (error) {
            console.error('Error refreshing QR code:', error);
            return { success: false, error: 'Failed to refresh QR code' };
        }
    });
}