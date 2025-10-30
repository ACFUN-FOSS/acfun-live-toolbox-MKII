import { DatabaseManager } from './persistence/DatabaseManager';
import { EventWriter } from './persistence/EventWriter';
import { RoomManager } from './rooms/RoomManager';
import { ApiServer } from './server/ApiServer';
import { initializeIpcHandlers } from './ipc/ipcHandlers';
import { app, BrowserWindow } from 'electron';
import { runDependencyGuards } from './bootstrap/dependencyGuards';
import { WindowManager } from './bootstrap/WindowManager';
import { ensureSingleInstance } from './bootstrap/SingleInstanceApp';
import { setupHardwareAcceleration } from './bootstrap/HardwareAccelerationModule';
import { ensureWorkspacePackagesPresent } from './dependencyCheck';
import path from 'path';

async function main() {
  // --- 0. Assert local workspace package integrity ---
  try {
    ensureWorkspacePackagesPresent(path.resolve(__dirname, '..'));
  } catch (error: any) {
    console.error('[Main] Workspace package check failed:', error);
    app.quit();
    return;
  }

  // --- 1. Pre-flight Checks & Setup ---
  ensureSingleInstance();
  setupHardwareAcceleration();

  try {
    await runDependencyGuards();
  } catch (error: any) {
    // The guard will log the specific error. We just need to exit.
    app.quit();
    return; // Stop execution
  }

  // --- 2. Initialize Managers & Services (Stubs for now) ---
  console.log('[Main] Initializing services...');
  const databaseManager = new DatabaseManager();
  await databaseManager.initialize();
  
  const eventWriter = new EventWriter(databaseManager);
  const roomManager = new RoomManager(eventWriter);
  const apiServer = new ApiServer({ port: 1299 }, databaseManager);
  await apiServer.start();
  initializeIpcHandlers(roomManager);

  // For now, we just create a window manager
  const windowManager = new WindowManager(); // This will need refactoring

  // --- 3. Application Ready ---
  await app.whenReady();

  console.log('[Main] App is ready.');
  windowManager.createWindow(); // Placeholder for creating the main UI

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

main().catch((error: any) => {
  console.error('[Main] Unhandled error in main process:', error);
  app.quit();
});
