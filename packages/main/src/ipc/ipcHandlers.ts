import { ipcMain, app } from 'electron';
import { RoomManager } from '../rooms/RoomManager';
import { AuthManager } from '../services/AuthManager';

/**
 * Initializes all IPC handlers for the main process.
 * This is where the renderer process can communicate with the main process.
 */
export function initializeIpcHandlers(roomManager: RoomManager, authManager: AuthManager) {
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

}
