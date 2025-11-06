import { DatabaseManager, EventWriter } from './persistence';
import { RoomManager } from './rooms';
import { ApiServer } from './server/ApiServer';
import { initializeIpcHandlers } from './ipc/ipcHandlers';
import { TokenManager } from './server/TokenManager';
import { app, BrowserWindow } from 'electron';
import { runDependencyGuards } from './bootstrap/dependencyGuards';
import { WindowManager } from './bootstrap/WindowManager';
import { ensureSingleInstance } from './bootstrap/SingleInstanceApp';
import { setupHardwareAcceleration } from './bootstrap/HardwareAccelerationModule';
import { ensureWorkspacePackagesPresent } from './dependencyCheck';
import { ConfigManager } from './config/ConfigManager';
import { PluginManager } from './plugins/PluginManager';
import { OverlayManager } from './plugins/OverlayManager';
import { DiagnosticsService } from './logging/DiagnosticsService';
import { getLogManager, LogManager } from './logging/LogManager';
import { ConsoleManager } from './console/ConsoleManager';
import { acfunDanmuModule } from './adapter/AcfunDanmuModule';
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
  const logManager = getLogManager();

  const eventWriter = new EventWriter(databaseManager);
  const roomManager = new RoomManager(eventWriter);
  
  // 初始化配置与插件系统
  const configManager = new ConfigManager();
  
  // 初始化日志和诊断服务
  const diagnosticsService = new DiagnosticsService(databaseManager, configManager);
  
  // 初始化Overlay管理器
  const overlayManager = new OverlayManager();
  
  const apiPort = parseInt(process.env.ACFRAME_API_PORT || '18299');
  
  const tokenManager = TokenManager.getInstance();
  
  const pluginManager = new PluginManager({
    apiServer: null as any, // 临时设置，稍后更新
    roomManager,
    databaseManager,
    configManager,
    tokenManager
  });

  // 初始化控制台管理器
  const consoleManager = new ConsoleManager({
    apiServer: null as any, // 临时设置，稍后更新
    roomManager,
    pluginManager,
    databaseManager,
    configManager
  });

  // 初始化API服务器，传入所有必要的管理器
  const apiServer = new ApiServer({ port: apiPort }, databaseManager, diagnosticsService, overlayManager, consoleManager);
  
  // 更新管理器中的apiServer引用
  (pluginManager as any).apiServer = apiServer;
  (consoleManager as any).apiServer = apiServer;
  // 向 ApiServer 注入 PluginManager 以支持统一静态托管
  apiServer.setPluginManager(pluginManager);
  
  await apiServer.start();

  // 自动启用内置示例插件（若已安装但未启用）
  try {
    const example = pluginManager.getPlugin('base-example');
    if (example && !example.enabled) {
      await pluginManager.enablePlugin('base-example');
      console.log('[Main] Auto-enabled bundled example plugin: base-example');
    }
  } catch (err) {
    console.warn('[Main] Failed to auto-enable base-example plugin:', err);
  }

  // 预先实例化窗口管理器以供 IPC 处理程序使用（窗口创建仍在 app ready 后）
  const windowManager = new WindowManager(); // This will need refactoring

  initializeIpcHandlers(
    roomManager,
    tokenManager,
    pluginManager,
    overlayManager,
    consoleManager,
    windowManager,
    configManager,
    logManager,
    diagnosticsService
  );

  // --- 4. Start API Server ---
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
      // 同步活动事件（直播开始/结束）
      if (status === 'open') {
        wsHub.broadcastActivity('live.start', { roomId, status });
      } else if (status === 'closed') {
        wsHub.broadcastActivity('live.stop', { roomId, status });
      }
    } catch (err) {
      console.error('[Main] Failed to broadcast room status via WsHub:', err);
    }
  });

  roomManager.on('roomAdded', (roomId: string) => {
    try {
      wsHub.broadcastRoomStatus(roomId, 'connecting');
      wsHub.broadcastActivity('room.added', { roomId });
    } catch (err) {
      console.error('[Main] Failed to broadcast room added via WsHub:', err);
    }
  });

  roomManager.on('roomRemoved', (roomId: string) => {
    try {
      wsHub.broadcastRoomStatus(roomId, 'closed');
      wsHub.broadcastActivity('room.removed', { roomId });
    } catch (err) {
      console.error('[Main] Failed to broadcast room removed via WsHub:', err);
    }
  });

  // Wire TokenManager -> WsHub broadcasting for auth lifecycle
  const sanitizeTokenInfo = (ti: any) => ({
    userId: ti?.userID || '',
    expiresAt: ti?.expiresAt || null,
    isValid: ti?.isValid !== false
  });

  tokenManager.on('tokenStateChanged', ({ isAuthenticated, tokenInfo }: any) => {
    try {
      wsHub.broadcastActivity('auth.stateChanged', {
        isAuthenticated,
        userId: tokenInfo?.userID
      });
    } catch (err) {
      console.error('[Main] Failed to broadcast auth.stateChanged:', err);
    }
  });

  tokenManager.on('tokenExpiring', (data: any) => {
    try {
      wsHub.broadcastActivity('auth.tokenExpiring', {
        expiresAt: data?.expiresAt || null,
        timeRemaining: data?.timeRemaining
      });
    } catch (err) {
      console.error('[Main] Failed to broadcast auth.tokenExpiring:', err);
    }
  });

  tokenManager.on('tokenExpired', (_data: any) => {
    try {
      wsHub.broadcastActivity('auth.tokenExpired', {});
    } catch (err) {
      console.error('[Main] Failed to broadcast auth.tokenExpired:', err);
    }
  });

  tokenManager.on('loginSuccess', ({ tokenInfo }: any) => {
    try {
      wsHub.broadcastActivity('auth.login', sanitizeTokenInfo(tokenInfo));
    } catch (err) {
      console.error('[Main] Failed to broadcast auth.login:', err);
    }
  });

  tokenManager.on('loginFailed', ({ error }: any) => {
    try {
      wsHub.broadcastActivity('auth.loginFailed', { error: String(error || 'unknown') });
    } catch (err) {
      console.error('[Main] Failed to broadcast auth.loginFailed:', err);
    }
  });

  tokenManager.on('logout', () => {
    try {
      wsHub.broadcastActivity('auth.logout', {});
    } catch (err) {
      console.error('[Main] Failed to broadcast auth.logout:', err);
    }
  });

  // --- 3. Application Ready ---
  await app.whenReady();

  console.log('[Main] App is ready.');

  // Ensure AcfunDanmuModule is initialized so IPC room.details can fetch data
  try {
    await acfunDanmuModule.initialize();
    console.log('[Main] AcfunDanmuModule initialized.');
  } catch (err) {
    console.error('[Main] Failed to initialize AcfunDanmuModule:', err);
  }

  windowManager.createWindow(); // Placeholder for creating the main UI

  // Wire OverlayManager -> Renderer (UI/Window → Overlay messaging downlink)
  try {
    overlayManager.on('overlay-message', (payload: { overlayId: string; event: string; payload?: any }) => {
      const win = windowManager.getMainWindow();
      if (win) {
        try {
          win.webContents.send('overlay-message', payload.overlayId, { event: payload.event, payload: payload.payload });
        } catch (err) {
          console.error('[Main] Failed to forward overlay-message to renderer:', err);
        }
      }
    });
  } catch (err) {
    console.error('[Main] Failed to attach overlay-message forwarder:', err);
  }

  // Wire PopupManager -> Renderer (forward popup lifecycle updates)
  try {
    const popupManager = pluginManager.getPopupManager();
    const forward = (data: any) => {
      const win = windowManager.getMainWindow();
      if (win) {
        try {
          win.webContents.send('plugin-popup-event', data);
        } catch (err) {
          console.error('[Main] Failed to forward plugin-popup-event to renderer:', err);
        }
      }
    };

    popupManager.on('popup.created', ({ popup }) => forward({ type: 'popup-created', popup }));
    popupManager.on('popup.closed', ({ popupId, pluginId }) => forward({ type: 'popup-closed', popupId, pluginId }));
    popupManager.on('popup.updated', ({ popup }) => forward({ type: 'popup-updated', popup }));
  } catch (err) {
    console.error('[Main] Failed to attach plugin popup forwarders:', err);
  }

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
