import { ipcMain } from 'electron';
import electron from 'electron';
import DanmuModule from '../modules/DanmuModule';
import DataReportService from '../services/DataReportService';
import { logger } from '@app/utils/logger';
import { ModuleContext } from '../core/ModuleContext';

// API注册器 - 集中管理主进程API
class ApiRegistry {
  private modules: Record<string, any> = {};

  constructor() {
    this.registerModules();
    this.setupIpcHandlers();
  }

  // 注册所有功能模块
  private registerModules(): void {
    // 注册弹幕模块
    const danmuModule = new DanmuModule();
    const moduleContext: ModuleContext = {
        mainWindow: electron.BrowserWindow.getFocusedWindow() || null,
        appDataPath: electron.app.getPath('userData'),
        appVersion: electron.app.getVersion(),
        configStore: new Map()
    };
    danmuModule.enable(moduleContext);
    this.modules.danmu = danmuModule.getApi();

    logger.info('All API modules registered successfully');
  }

  // 设置IPC处理器
  private setupIpcHandlers(): void {
    // 弹幕模块API
    ipcMain.handle('danmu:connectToRoom', (_, roomId: number) => {
      return this.modules.danmu.connectToRoom(roomId);
    });

    ipcMain.handle('danmu:disconnectFromRoom', (_, roomId: number) => {
      this.modules.danmu.disconnectFromRoom(roomId);
      return true;
    });

    ipcMain.handle('danmu:getActiveRooms', () => {
      return this.modules.danmu.getActiveRooms();
    });

    // 数据报表模块API
    ipcMain.handle('report:getDailyReport', async (_, date?: Date) => {
      try {
        return await DataReportService.getInstance().getDailyDanmuReport(date);
      } catch (error) {
        logger.error('Failed to get daily report:', error);
        throw new Error('获取日报表失败');
      }
    });

    ipcMain.handle('report:getAudienceAnalysis', async (_, roomId?: number, days?: number) => {
      try {
        return await DataReportService.getInstance().getAudienceBehaviorAnalysis(roomId, days);
      } catch (error) {
        logger.error('Failed to get audience analysis:', error);
        throw new Error('获取观众分析失败');
      }
    });

    ipcMain.handle('report:exportToCSV', async (_, reportData: any, reportType: string) => {
      try {
        return await DataReportService.getInstance().exportReportToCSV(reportData, reportType);
      } catch (error) {
        logger.error('Failed to export report to CSV:', error);
        throw new Error('导出报表失败');
      }
    });

    // 后续将添加更多模块的IPC处理...
  }
}

// 初始化API注册器
export const apiRegistry = new ApiRegistry();

export default apiRegistry;