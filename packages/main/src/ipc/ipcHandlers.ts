import { ipcMain, app } from 'electron';
import { RoomManager } from '../rooms/RoomManager';

/**
 * Initializes all IPC handlers for the main process.
 * This is where the renderer process can communicate with the main process.
 */
export function initializeIpcHandlers(roomManager: RoomManager) {
  console.log('[IPC] Initializing IPC handlers...');

  ipcMain.handle('add-room', (event, roomId: string) => {
    console.log(`[IPC] Received request to add room: ${roomId}`);
    roomManager.addRoom(roomId);
  });

  // Example IPC handler
  ipcMain.handle('get-app-version', (event) => {
    return app.getVersion();
  });

  // TODO: Re-implement handlers for the new architecture
  // - Window management (minimize, maximize, close)
  // - Settings management
  // - Room management (connect, disconnect)
  // - Data queries (get events, etc.)

}
