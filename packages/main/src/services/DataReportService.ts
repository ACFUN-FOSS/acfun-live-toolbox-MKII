import { DanmuDatabaseService } from './DanmuDatabaseService';
import { logger } from '@app/utils/logger';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// 数据报表服务 - 处理数据统计与分析功能
export class DataReportService {
  private static instance: DataReportService;
  private dbService: DanmuDatabaseService;
  private exportPath: string;

  private constructor() {
    this.dbService = DanmuDatabaseService.getInstance();
    this.exportPath = path.join(app.getPath('documents'), 'AcfunLiveToolbox', 'Reports');
    this.ensureExportDirectory();
  }

  public static getInstance(): DataReportService {
    if (!DataReportService.instance) {
      DataReportService.instance = new DataReportService();
    }
    return DataReportService.instance;
  }

  // 确保导出目录存在
  private ensureExportDirectory(): void {
    if (!fs.existsSync(this.exportPath)) {
      fs.mkdirSync(this.exportPath, { recursive: true });
    }
  }

  // 获取每日弹幕统计报表
  async getDailyDanmuReport(date: Date = new Date()): Promise<any> {
    try {
      // 设置日期范围为当天
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      // 查询当天弹幕总量
      const totalDanmuStmt = this.dbService.db.prepare(`
        SELECT COUNT(*) as total FROM danmu
        WHERE timestamp BETWEEN ? AND ?
      `);
      const totalDanmu = totalDanmuStmt.get(startDate.toISOString(), endDate.toISOString());

      // 查询各房间弹幕分布
      const roomDistributionStmt = this.dbService.db.prepare(`
        SELECT roomId, COUNT(*) as count
        FROM danmu
        WHERE timestamp BETWEEN ? AND ?
        GROUP BY roomId
        ORDER BY count DESC
      `);
      const roomDistribution = roomDistributionStmt.all(startDate.toISOString(), endDate.toISOString());

      // 查询弹幕高峰时段
      const hourlyDistributionStmt = this.dbService.db.prepare(`
        SELECT strftime('%H', timestamp) as hour, COUNT(*) as count
        FROM danmu
        WHERE timestamp BETWEEN ? AND ?
        GROUP BY hour
        ORDER BY hour
      `);
      const hourlyDistribution = hourlyDistributionStmt.all(startDate.toISOString(), endDate.toISOString());

      // 查询礼物统计
      const giftStatsStmt = this.dbService.db.prepare(`
        SELECT SUM(giftValue) as totalGiftValue, COUNT(*) as giftCount
        FROM danmu
        WHERE timestamp BETWEEN ? AND ? AND isGift = 1
      `);
      const giftStats = giftStatsStmt.get(startDate.toISOString(), endDate.toISOString());

      return {
        date: startDate.toISOString().split('T')[0],
        totalDanmu: totalDanmu.total,
        roomDistribution,
        hourlyDistribution,
        giftStats: {
          totalGiftValue: giftStats.totalGiftValue || 0,
          giftCount: giftStats.giftCount || 0
        }
      };
    } catch (error) {
      logger.error('Failed to generate daily danmu report:', error);
      throw new Error('生成数据报表失败');
    }
  }

  // 获取观众行为分析
  async getAudienceBehaviorAnalysis(roomId?: number, days: number = 7): Promise<any> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 构建查询条件
      const roomCondition = roomId ? 'AND roomId = ?' : '';
      const params: any[] = [startDate.toISOString(), endDate.toISOString()];
      if (roomId) params.push(roomId);

      // 查询活跃用户统计
      const activeUsersStmt = this.dbService.db.prepare(`
        SELECT userId, username, COUNT(*) as danmuCount
        FROM danmu
        WHERE timestamp BETWEEN ? AND ? ${roomCondition}
        GROUP BY userId
        ORDER BY danmuCount DESC
        LIMIT 20
      `);
      const activeUsers = activeUsersStmt.all(...params);

      // 查询观众活跃度趋势
      const activityTrendStmt = this.dbService.db.prepare(`
        SELECT strftime('%Y-%m-%d', timestamp) as date, COUNT(DISTINCT userId) as activeUsers
        FROM danmu
        WHERE timestamp BETWEEN ? AND ? ${roomCondition}
        GROUP BY date
        ORDER BY date
      `);
      const activityTrend = activityTrendStmt.all(...params);

      // 查询常用弹幕关键词 (简单版本)
      const keywordsStmt = this.dbService.db.prepare(`
        SELECT content, COUNT(*) as count
        FROM danmu
        WHERE timestamp BETWEEN ? AND ? ${roomCondition} AND LENGTH(content) > 2
        GROUP BY content
        ORDER BY count DESC
        LIMIT 50
      `);
      const keywords = keywordsStmt.all(...params);

      return {
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        roomId,
        activeUsers,
        activityTrend,
        topKeywords: keywords
      };
    } catch (error) {
      logger.error('Failed to generate audience behavior analysis:', error);
      throw new Error('生成观众行为分析失败');
    }
  }

  // 导出报表为CSV
  async exportReportToCSV(reportData: any, reportType: string): Promise<string> {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `${reportType}_report_${dateStr}.csv`;
      const filePath = path.join(this.exportPath, fileName);

      // 根据报表类型生成CSV内容
      let csvContent = '';
      if (reportType === 'daily') {
        csvContent = this.generateDailyReportCSV(reportData);
      } else if (reportType === 'audience') {
        csvContent = this.generateAudienceReportCSV(reportData);
      }

      // 写入文件
      fs.writeFileSync(filePath, csvContent, 'utf-8');
      return filePath;
    } catch (error) {
      logger.error('Failed to export report to CSV:', error);
      throw new Error('导出报表失败');
    }
  }

  // 生成日报CSV内容
  private generateDailyReportCSV(data: any): string {
    // 实现CSV生成逻辑
    let csv = '日期,总弹幕数,礼物总数,礼物总价值\n';
    csv += `${data.date},${data.totalDanmu},${data.giftStats.giftCount},${data.giftStats.totalGiftValue}\n\n`;

    csv += '房间ID,弹幕数量\n';
    data.roomDistribution.forEach((item: any) => {
      csv += `${item.roomId},${item.count}\n`;
    });

    return csv;
  }

  // 生成观众分析CSV内容
  private generateAudienceReportCSV(data: any): string {
    // 实现CSV生成逻辑
    let csv = `时间范围: ${data.timeRange.start} 至 ${data.timeRange.end}\n`;
    if (data.roomId) csv += `房间ID: ${data.roomId}\n`;
    csv += '\n活跃用户,发送弹幕数\n';

    data.activeUsers.forEach((user: any) => {
      csv += `${user.username} (${user.userId}),${user.danmuCount}\n`;
    });

    return csv;
  }
}