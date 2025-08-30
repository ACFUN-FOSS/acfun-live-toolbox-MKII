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
      const totalDanmu = this.dbService.getSingleResult(`
        SELECT COUNT(*) as total FROM danmu
        WHERE timestamp BETWEEN ? AND ?
      `, [startDate.toISOString(), endDate.toISOString()]);

      // 查询各房间弹幕分布
      const roomDistribution = this.dbService.executeQuery(`
        SELECT roomId, COUNT(*) as count
        FROM danmu
        WHERE timestamp BETWEEN ? AND ?
        GROUP BY roomId
        ORDER BY count DESC
      `, [startDate.toISOString(), endDate.toISOString()]);

      // 查询弹幕高峰时段
      const hourlyDistribution = this.dbService.executeQuery(`
        SELECT strftime('%H', timestamp) as hour, COUNT(*) as count
        FROM danmu
        WHERE timestamp BETWEEN ? AND ?
        GROUP BY hour
        ORDER BY hour
      `, [startDate.toISOString(), endDate.toISOString()]);

      // 查询礼物统计
      const giftStats = this.dbService.getSingleResult(`
        SELECT SUM(giftValue) as totalGiftValue, COUNT(*) as giftCount
        FROM danmu
        WHERE timestamp BETWEEN ? AND ? AND isGift = 1
      `, [startDate.toISOString(), endDate.toISOString()]);

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
      const activeUsers = this.dbService.executeQuery(`
        SELECT userId, username, COUNT(*) as danmuCount
        FROM danmu
        WHERE timestamp BETWEEN ? AND ? ${roomCondition}
        GROUP BY userId
        ORDER BY danmuCount DESC
        LIMIT 20
      `, [...params]);

      // 查询观众活跃度趋势
      const activityTrend = this.dbService.executeQuery(`
        SELECT strftime('%Y-%m-%d', timestamp) as date, COUNT(DISTINCT userId) as activeUsers
        FROM danmu
        WHERE timestamp BETWEEN ? AND ? ${roomCondition}
        GROUP BY date
        ORDER BY date
      `, [...params]);

      // 查询常用弹幕关键词 (简单版本)
      const keywords = this.dbService.executeQuery(`
        SELECT content, COUNT(*) as count
        FROM danmu
        WHERE timestamp BETWEEN ? AND ? ${roomCondition} AND LENGTH(content) > 2
        GROUP BY content
        ORDER BY count DESC
        LIMIT 50
      `, [...params]);

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

  // 辅助函数：CSV字段转义
  private escapeCSVField(field: string): string {
    if (typeof field !== 'string') {
      field = String(field);
    }
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  // 生成日报CSV内容
  private generateDailyReportCSV(data: any): string {
    // 实现CSV生成逻辑
    let csv = '日期,总弹幕数,礼物总数,礼物总价值\n';
    csv += `${this.escapeCSVField(data.date)},${this.escapeCSVField(data.totalDanmu.toString())},${this.escapeCSVField(data.giftStats.giftCount.toString())},${this.escapeCSVField(data.giftStats.totalGiftValue.toString())}\n\n`;

    csv += '房间ID,弹幕数量\n';
    if (data.roomDistribution && Array.isArray(data.roomDistribution)) {
      data.roomDistribution.forEach((item: any) => {
        csv += `${this.escapeCSVField(item.roomId.toString())},${this.escapeCSVField(item.count.toString())}\n`;
      });
    }

    return csv;
  }

  // 生成观众分析CSV内容
  private generateAudienceReportCSV(data: any): string {
    // 实现CSV生成逻辑
    let csv = `时间范围: ${this.escapeCSVField(data.timeRange.start)} 至 ${this.escapeCSVField(data.timeRange.end)}
`;
    if (data.roomId) csv += `房间ID: ${this.escapeCSVField(data.roomId.toString())}
`;
    csv += '
活跃用户,发送弹幕数
';

    data.activeUsers.forEach((user: any) => {
      csv += `${this.escapeCSVField(user.username)} (${this.escapeCSVField(user.userId.toString())}),${this.escapeCSVField(user.danmuCount.toString())}
`;
    });

    return csv;
  }