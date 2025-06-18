import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';

// 窗口管理相关API实现
export function initializeElectronApi() {
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
}