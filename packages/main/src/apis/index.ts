import { ipcMain } from 'electron';
import electron from 'electron';
import DanmuModule from '../modules/DanmuModule';
import DataReportService from '../services/DataReportService';
import { logger } from '@app/utils/logger';

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
    danmuModule.enable({ app: electron.app });
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
      return DataReportService.getInstance().getDailyDanmuReport(date);
    });

    ipcMain.handle('report:getAudienceAnalysis', async (_, roomId?: number, days?: number) => {
      return DataReportService.getInstance().getAudienceBehaviorAnalysis(roomId, days);
    });

    ipcMain.handle('report:exportToCSV', async (_, reportData: any, reportType: string) => {
      return DataReportService.getInstance().exportReportToCSV(reportData, reportType);
    });

    // 后续将添加更多模块的IPC处理...
  }
}

// 初始化API注册器
export const apiRegistry = new ApiRegistry();

export default apiRegistry;