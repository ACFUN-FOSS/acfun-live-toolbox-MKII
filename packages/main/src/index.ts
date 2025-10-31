import { DatabaseManager } from './persistence/DatabaseManager';
import { EventWriter } from './persistence/EventWriter';
import { RoomManager } from './rooms/RoomManager';
import { ApiServer } from './server/ApiServer';
import { initializeIpcHandlers } from './ipc/ipcHandlers';
import { AuthManager } from './services/AuthManager';
import { app, BrowserWindow } from 'electron';
import { runDependencyGuards } from './bootstrap/dependencyGuards';
import { WindowManager } from './bootstrap/WindowManager';
import { ensureSingleInstance } from './bootstrap/SingleInstanceApp';
import { setupHardwareAcceleration } from './bootstrap/HardwareAccelerationModule';
import { ensureWorkspacePackagesPresent } from './dependencyCheck';
import { ConfigManager } from './config/ConfigManager';
import { PluginManager } from './plugins/PluginManager';
import { DiagnosticsService } from './logging/DiagnosticsService';
import { getLogManager } from './logging/LogManager';
import path from 'path';

async function main() {
  // --- 0. Assert local workspace package integrity ---
  try {
    // 仅在开发模式校验本地工作区包；打包环境中跳过该检查
    if (!app.isPackaged) {
      // From compiled dist at packages/main/dist, go up to project root
      ensureWorkspacePackagesPresent(path.resolve(__dirname, '../../..'));
    }
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
  
  // 初始化配置与插件系统
  const configManager = new ConfigManager();
  
  // 初始化日志和诊断服务
  const logManager = getLogManager();
  const diagnosticsService = new DiagnosticsService(databaseManager, configManager, logManager);
  
  const apiPort = parseInt(process.env.ACFRAME_API_PORT || '18299');
  const apiServer = new ApiServer({ port: apiPort }, databaseManager, diagnosticsService);
  await apiServer.start();
  const authManager = new AuthManager();
  initializeIpcHandlers(roomManager, authManager);

  const pluginManager = new PluginManager({
    apiServer,
    roomManager,
    databaseManager,
    configManager
  });

  // Wire RoomManager -> WsHub broadcasting
  const wsHub = apiServer.getWsHub();
  roomManager.on('event', (event) => {
    try {
      wsHub.broadcastEvent(event);
    } catch (err) {
      console.error('[Main] Failed to broadcast event via WsHub:', err);
    }
  });

  roomManager.on('roomStatusChange', (roomId: string, status: string) => {
    try {
      wsHub.broadcastRoomStatus(roomId, status);
    } catch (err) {
      console.error('[Main] Failed to broadcast room status via WsHub:', err);
    }
  });

  roomManager.on('roomAdded', (roomId: string) => {
    try {
      wsHub.broadcastRoomStatus(roomId, 'connecting');
    } catch (err) {
      console.error('[Main] Failed to broadcast room added via WsHub:', err);
    }
  });

  roomManager.on('roomRemoved', (roomId: string) => {
    try {
      wsHub.broadcastRoomStatus(roomId, 'closed');
    } catch (err) {
      console.error('[Main] Failed to broadcast room removed via WsHub:', err);
    }
  });

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
