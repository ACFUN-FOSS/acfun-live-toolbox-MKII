import { ipcMain, app, dialog } from 'electron';
import { RoomManager } from '../rooms/RoomManager';
import { AuthManager } from '../services/AuthManager';
import { PluginManager } from '../plugins/PluginManager';
import { OverlayManager } from '../plugins/OverlayManager';
import { ConsoleManager } from '../console/ConsoleManager';
import * as fs from 'fs';

/**
 * Initializes all IPC handlers for the main process.
 * This is where the renderer process can communicate with the main process.
 */
export function initializeIpcHandlers(
  roomManager: RoomManager, 
  authManager: AuthManager, 
  pluginManager: PluginManager, 
  overlayManager: OverlayManager,
  consoleManager: ConsoleManager
) {
  console.log('[IPC] Initializing IPC handlers...');

  ipcMain.handle('add-room', (event, roomId: string) => {
    console.log(`[IPC] Received request to add room: ${roomId}`);
    roomManager.addRoom(roomId);
  });

  // Example IPC handler
  ipcMain.handle('get-app-version', (event) => {
    return app.getVersion();
  });

  // Login: QR start -> returns base64 data URL
  ipcMain.handle('login.qrStart', async () => {
    try {
      return await authManager.startQrLogin();
    } catch (err: any) {
      return { error: err?.message || String(err) };
    }
  });

  // Login: poll status
  ipcMain.handle('login.qrCheck', async () => {
    try {
      return await authManager.checkQrLoginStatus();
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // Logout: clear secrets
  ipcMain.handle('login.logout', async () => {
    await authManager.logout();
    return { ok: true };
  });

  // --- Room Management ---
  ipcMain.handle('room.connect', async (_event, roomIdRaw: string) => {
    try {
      const roomId = String(roomIdRaw || '').trim();
      if (!roomId) {
        return { success: false, code: 'invalid_room_id', error: '房间ID无效' };
      }

      // 最大房间数量检查（RoomManager 当前最大为 3）
      if (roomManager.getRoomCount() >= 3) {
        return { success: false, code: 'max_rooms_reached', error: '已达到最大房间数' };
      }

      // 重复连接检查
      if (roomManager.getRoomInfo(roomId)) {
        return { success: false, code: 'already_connected', error: '房间已连接' };
      }

      const success = await roomManager.addRoom(roomId);
      return success
        ? { success: true }
        : { success: false, code: 'connect_failed', error: '连接失败' };
    } catch (err: any) {
      return { success: false, code: 'exception', error: err?.message || String(err) };
    }
  });

  ipcMain.handle('room.disconnect', async (_event, roomIdRaw: string) => {
    try {
      const roomId = String(roomIdRaw || '').trim();
      if (!roomId) {
        return { success: false, code: 'invalid_room_id', error: '房间ID无效' };
      }
      if (!roomManager.getRoomInfo(roomId)) {
        return { success: false, code: 'not_found', error: '房间未连接' };
      }
      const success = await roomManager.removeRoom(roomId);
      return success
        ? { success: true }
        : { success: false, code: 'disconnect_failed', error: '断开失败' };
    } catch (err: any) {
      return { success: false, code: 'exception', error: err?.message || String(err) };
    }
  });

  ipcMain.handle('room.list', async () => {
    try {
      const rooms = roomManager.getAllRooms().map(r => ({
        roomId: r.roomId,
        status: r.status,
        eventCount: r.eventCount,
        connectedAt: r.connectedAt ?? null,
        lastEventAt: r.lastEventAt ?? null,
        reconnectAttempts: r.reconnectAttempts
      }));
      return { rooms };
    } catch (err: any) {
      return { error: err?.message || String(err) };
    }
  });

  ipcMain.handle('room.status', async (_event, roomId: string) => {
    try {
      const info = roomManager.getRoomInfo(String(roomId));
      return info
        ? {
            roomId: info.roomId,
            status: info.status,
            eventCount: info.eventCount,
            connectedAt: info.connectedAt ?? null,
            lastEventAt: info.lastEventAt ?? null,
            reconnectAttempts: info.reconnectAttempts
          }
        : { error: 'not_found', code: 'not_found' };
    } catch (err: any) {
      return { error: err?.message || String(err) };
    }
  });

  // 设置房间优先级
  ipcMain.handle('room.setPriority', async (_event, roomIdRaw: string, priorityRaw: number) => {
    try {
      const roomId = String(roomIdRaw || '').trim();
      const priority = Number(priorityRaw);
      if (!roomId) return { success: false, code: 'invalid_room_id', error: '房间ID无效' };
      if (!Number.isFinite(priority)) return { success: false, code: 'invalid_priority', error: '优先级无效' };
      const ok = roomManager.setRoomPriority(roomId, priority);
      return ok ? { success: true } : { success: false, code: 'not_found', error: '房间未连接' };
    } catch (err: any) {
      return { success: false, code: 'exception', error: err?.message || String(err) };
    }
  });

  // 设置房间标签
  ipcMain.handle('room.setLabel', async (_event, roomIdRaw: string, labelRaw: string) => {
    try {
      const roomId = String(roomIdRaw || '').trim();
      const label = String(labelRaw || '').trim();
      if (!roomId) return { success: false, code: 'invalid_room_id', error: '房间ID无效' };
      const ok = roomManager.setRoomLabel(roomId, label);
      return ok ? { success: true } : { success: false, code: 'not_found', error: '房间未连接' };
    } catch (err: any) {
      return { success: false, code: 'exception', error: err?.message || String(err) };
    }
  });

  // TODO: Re-implement handlers for the new architecture
  // - Window management (minimize, maximize, close)
  // - Settings management
  // - Room management (connect, disconnect)
  // - Data queries (get events, etc.)

  // --- Plugin Management ---
  
  // 获取已安装插件列表
  ipcMain.handle('plugin.list', async () => {
    try {
      const plugins = await pluginManager.getInstalledPlugins();
      return { success: true, data: plugins };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 安装插件
  ipcMain.handle('plugin.install', async (_event, options: any) => {
    try {
      const result = await pluginManager.installPlugin(options);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 卸载插件
  ipcMain.handle('plugin.uninstall', async (_event, pluginId: string) => {
    try {
      await pluginManager.uninstallPlugin(pluginId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 启用插件
  ipcMain.handle('plugin.enable', async (_event, pluginId: string) => {
    try {
      await pluginManager.enablePlugin(pluginId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 禁用插件
  ipcMain.handle('plugin.disable', async (_event, pluginId: string) => {
    try {
      await pluginManager.disablePlugin(pluginId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取单个插件信息
  ipcMain.handle('plugin.get', async (_event, pluginId: string) => {
    try {
      const plugin = await pluginManager.getPlugin(pluginId);
      return plugin ? { success: true, data: plugin } : { success: false, error: '插件未找到' };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取插件统计信息
  ipcMain.handle('plugin.stats', async () => {
    try {
      const stats = await pluginManager.getPluginStats();
      return { success: true, data: stats };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取插件日志
  ipcMain.handle('plugin.logs', async (_event, pluginId?: string, limit?: number) => {
    try {
      const logs = await pluginManager.getPluginLogs(pluginId, limit);
      return { success: true, data: logs };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取插件错误历史
  ipcMain.handle('plugin.errorHistory', async (_event, pluginId: string) => {
    try {
      const history = await pluginManager.getPluginErrorHistory(pluginId);
      return { success: true, data: history };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取插件错误统计
  ipcMain.handle('plugin.errorStats', async () => {
    try {
      const stats = await pluginManager.getPluginErrorStats();
      return { success: true, data: stats };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 执行插件恢复操作
  ipcMain.handle('plugin.recovery', async (_event, pluginId: string, action: string, context?: Record<string, any>) => {
    try {
      const result = await pluginManager.executePluginRecovery(pluginId, action as any, context);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 重置插件错误计数
  ipcMain.handle('plugin.resetErrorCount', async (_event, pluginId: string, errorType?: string) => {
    try {
      pluginManager.resetPluginErrorCount(pluginId, errorType as any);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // --- 文件对话框和安装相关 ---
  
  // 打开文件选择对话框
  ipcMain.handle('plugin.selectFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择插件文件',
        filters: [
          { name: '插件文件', extensions: ['zip', 'tar', 'gz', 'tgz'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      
      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true };
      }
      
      return { success: true, filePath: result.filePaths[0] };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 安装插件（带文件选择）
  ipcMain.handle('plugin.installFromFile', async (_event, options?: any) => {
    try {
      // 如果没有提供文件路径，先打开文件选择对话框
      let filePath = options?.filePath;
      
      if (!filePath) {
        const fileResult = await dialog.showOpenDialog({
          title: '选择要安装的插件文件',
          filters: [
            { name: '插件文件', extensions: ['zip', 'tar', 'gz', 'tgz'] },
            { name: '所有文件', extensions: ['*'] }
          ],
          properties: ['openFile']
        });
        
        if (fileResult.canceled || !fileResult.filePaths.length) {
          return { success: false, canceled: true };
        }
        
        filePath = fileResult.filePaths[0];
      }
      
      const installOptions = {
        filePath,
        overwrite: options?.overwrite || false,
        enable: options?.enable || false,
        skipSignatureVerification: options?.skipSignatureVerification || false,
        skipChecksumVerification: options?.skipChecksumVerification || false,
        allowUnsafe: options?.allowUnsafe || false,
        expectedChecksum: options?.expectedChecksum
      };
      
      const result = await pluginManager.installPlugin(installOptions);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 验证插件文件
  ipcMain.handle('plugin.validateFile', async (_event, filePath: string) => {
    try {
      const manifest = await pluginManager.validatePluginFile(filePath);
      return { success: true, data: manifest };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // --- Plugin Popup System ---
  
  // 创建插件弹窗
  ipcMain.handle('plugin.popup.create', async (_event, pluginId: string, options: any) => {
    try {
      const api = pluginManager.getApi(pluginId);
      const popupId = await api.popup.create(options);
      return { success: true, data: { popupId } };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 关闭插件弹窗
  ipcMain.handle('plugin.popup.close', async (_event, pluginId: string, popupId: string) => {
    try {
      const api = pluginManager.getApi(pluginId);
      const result = await api.popup.close(popupId);
      return { success: true, data: { closed: result } };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 处理插件弹窗动作
  ipcMain.handle('plugin.popup.action', async (_event, pluginId: string, popupId: string, actionId: string) => {
    try {
      const api = pluginManager.getApi(pluginId);
      const result = await api.popup.action(popupId, actionId);
      return { success: true, data: { handled: result } };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 将插件弹窗置于前台
  ipcMain.handle('plugin.popup.bringToFront', async (_event, pluginId: string, popupId: string) => {
    try {
      const api = pluginManager.getApi(pluginId);
      const result = await api.popup.bringToFront(popupId);
      return { success: true, data: { focused: result } };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // --- Overlay System ---
  
  // 创建overlay
  ipcMain.handle('overlay.create', async (_event, options: any) => {
    try {
      const result = await overlayManager.createOverlay(options);
      return result;
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 更新overlay
  ipcMain.handle('overlay.update', async (_event, overlayId: string, updates: any) => {
    try {
      const result = await overlayManager.updateOverlay(overlayId, updates);
      return result;
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 关闭overlay
  ipcMain.handle('overlay.close', async (_event, overlayId: string) => {
    try {
      const result = await overlayManager.closeOverlay(overlayId);
      return result;
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 显示overlay
  ipcMain.handle('overlay.show', async (_event, overlayId: string) => {
    try {
      const result = await overlayManager.showOverlay(overlayId);
      return result;
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 隐藏overlay
  ipcMain.handle('overlay.hide', async (_event, overlayId: string) => {
    try {
      const result = await overlayManager.hideOverlay(overlayId);
      return result;
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 将overlay置于前台
  ipcMain.handle('overlay.bringToFront', async (_event, overlayId: string) => {
    try {
      const result = await overlayManager.bringToFront(overlayId);
      return result;
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取overlay列表
  ipcMain.handle('overlay.list', async () => {
    try {
      const result = await overlayManager.listOverlays();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 处理overlay动作
  ipcMain.handle('overlay.action', async (_event, overlayId: string, action: string, data?: any) => {
    try {
      const result = await overlayManager.handleOverlayAction(overlayId, action, data);
      return result;
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // --- Console Management ---
  
  // 创建控制台会话
  ipcMain.handle('console:createSession', async (_event, options: { source: 'local' | 'remote'; userId?: string }) => {
    try {
      const sessionId = consoleManager.createSession(options.source, options.userId);
      const session = consoleManager.getSession(sessionId);
      return { success: true, data: session };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 结束控制台会话
  ipcMain.handle('console:endSession', async (_event, options: { sessionId: string }) => {
    try {
      consoleManager.endSession(options.sessionId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 执行控制台命令
  ipcMain.handle('console:executeCommand', async (_event, options: { sessionId: string; commandLine: string }) => {
    try {
      const result = await consoleManager.executeCommand(options.sessionId, options.commandLine);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取可用命令列表
  ipcMain.handle('console:getCommands', async () => {
    try {
      const commands = consoleManager.getCommands();
      return { success: true, data: commands };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取会话信息
  ipcMain.handle('console:getSession', async (_event, options: { sessionId: string }) => {
    try {
      const session = consoleManager.getSession(options.sessionId);
      if (session) {
        return { success: true, data: session };
      } else {
        return { success: false, error: 'Session not found' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取活跃会话列表
  ipcMain.handle('console:getActiveSessions', async () => {
    try {
      const sessions = consoleManager.getActiveSessions();
      return { success: true, data: sessions };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // --- Plugin Development Tools ---
  
  // 保存开发工具配置
  ipcMain.handle('plugin.devtools.saveConfig', async (_event, config: any) => {
    try {
      const result = await pluginManager.saveDevConfig(config);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取开发工具配置
  ipcMain.handle('plugin.devtools.getConfig', async (_event, pluginId?: string) => {
    try {
      const config = await pluginManager.getDevConfig(pluginId);
      return { success: true, data: config };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 启动外部项目调试
  ipcMain.handle('plugin.devtools.startDebug', async (_event, config: any) => {
    try {
      const result = await pluginManager.startExternalDebug(config);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 停止外部项目调试
  ipcMain.handle('plugin.devtools.stopDebug', async (_event, pluginId: string) => {
    try {
      const result = await pluginManager.stopExternalDebug(pluginId);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 测试外部项目连接
  ipcMain.handle('plugin.devtools.testConnection', async (_event, config: any) => {
    try {
      const result = await pluginManager.testExternalConnection(config);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 获取调试状态
  ipcMain.handle('plugin.devtools.getDebugStatus', async (_event, pluginId: string) => {
    try {
      const status = await pluginManager.getDebugStatus(pluginId);
      return { success: true, data: status };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 启用热重载
  ipcMain.handle('plugin.devtools.enableHotReload', async (_event, pluginId: string) => {
    try {
      const result = await pluginManager.enableHotReload(pluginId);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // 禁用热重载
  ipcMain.handle('plugin.devtools.disableHotReload', async (_event, pluginId: string) => {
    try {
      const result = await pluginManager.disableHotReload(pluginId);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  // --- Dialog API ---
  
  // 显示打开文件对话框
  ipcMain.handle('dialog.showOpenDialog', async (_event, options: any) => {
    try {
      const result = await dialog.showOpenDialog(options);
      return result;
    } catch (err: any) {
      return { canceled: true, error: err?.message || String(err) };
    }
  });

  // 显示保存文件对话框
  ipcMain.handle('dialog.showSaveDialog', async (_event, options: any) => {
    try {
      const result = await dialog.showSaveDialog(options);
      return result;
    } catch (err: any) {
      return { canceled: true, error: err?.message || String(err) };
    }
  });

  // --- File System API ---
  
  // 检查文件/目录是否存在
  ipcMain.handle('fs.exists', async (_event, path: string) => {
    try {
      return fs.existsSync(path);
    } catch (err: any) {
      return false;
    }
  });

  // 读取文件
  ipcMain.handle('fs.readFile', async (_event, path: string) => {
    try {
      return fs.readFileSync(path, 'utf8');
    } catch (err: any) {
      throw new Error(`Failed to read file: ${err?.message || String(err)}`);
    }
  });

  // 写入文件
  ipcMain.handle('fs.writeFile', async (_event, path: string, data: string) => {
    try {
      fs.writeFileSync(path, data, 'utf8');
      return true;
    } catch (err: any) {
      throw new Error(`Failed to write file: ${err?.message || String(err)}`);
    }
  });

  console.log('[IPC] All IPC handlers initialized successfully');
}
