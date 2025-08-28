import { app } from 'electron';
import danmuEventSourceConnector from './modules/danmuEventSourceConnector.js';
import { acfunDanmuModule } from './modules/AcfunDanmuModule.js';
import { getLogManager } from './utils/LogManager.js';
import { DataManager } from './utils/DataManager.js';

/**
 * 初始化EventSource相关服务
 */
export async function initEventSourceServices() {
  try {
    // 确保应用已就绪
    await app.whenReady();

    // 启动弹幕模块
    await acfunDanmuModule.start();

    // 设置日志
    const logManager = getLogManager();
    logManager.addLog('eventSource', 'Initializing EventSource services', 'info');

    // 添加应用关闭时的清理操作
    app.on('will-quit', () => {
      logManager.addLog('eventSource', 'Shutting down EventSource services', 'info');
      danmuEventSourceConnector.disconnectFromRoom();
    });

    // 监听房间状态变化
    const dataManager = DataManager.getInstance();
    dataManager.subscribe('room:change', 'eventSource', 'main', async (data) => {
      const roomId = data.value;
      logManager.addLog('eventSource', `Connecting to room ${roomId}`, 'info');
      try {
        await danmuEventSourceConnector.connectToRoom(roomId);
        logManager.addLog('eventSource', `Successfully connected to room ${roomId}`, 'info');
      } catch (error) {
        logManager.addLog('eventSource', `Failed to connect to room ${roomId}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    });

    // 初始连接到默认房间（如果有）
    const defaultRoomId = globalThis.configManager?.readConfig(undefined).defaultRoomId;
    if (defaultRoomId) {
      logManager.addLog('eventSource', `Connecting to default room ${defaultRoomId}`, 'info');
      try {
        await danmuEventSourceConnector.connectToRoom(defaultRoomId);
        logManager.addLog('eventSource', `Successfully connected to default room ${defaultRoomId}`, 'info');
      } catch (error) {
        logManager.addLog('eventSource', `Failed to connect to default room ${defaultRoomId}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }

    logManager.addLog('eventSource', 'EventSource services initialized successfully', 'info');
    console.log('EventSource services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize EventSource services:', error);
    const logManager = getLogManager();
    logManager.addLog('eventSource', `Failed to initialize EventSource services: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

// 自动初始化
if (require.main === module) {
  initEventSourceServices().catch(console.error);
}