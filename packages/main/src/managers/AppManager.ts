import { singleton } from 'tsyringe';
import { acfunLiveAPI } from 'acfundanmu';
import { ConfigManager } from '../utils/ConfigManager';
import logger from '../utils/logger';

@singleton()
export class AppManager {
  private configManager: ConfigManager;
  private lastGiftStatsUpdate: number = 0;
  private giftStatsCache: any = null;
  private lastAudienceUpdate: number = 0;
  private audienceCache: any = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 获取详细观众分析数据
   */
  async getAudienceAnalysis(roomId: number): Promise<any> {
    const now = Date.now();
    // 检查缓存
    if (this.audienceCache && now - this.lastAudienceUpdate < this.CACHE_DURATION) {
      return this.audienceCache;
    }

    try {
      // 调用ACFUN API获取详细观众数据
      const audienceData = await acfunLiveAPI.getAudienceDetail(roomId);
      // 处理并缓存数据
      this.audienceCache = this.processAudienceData(audienceData);
      this.lastAudienceUpdate = now;
      return this.audienceCache;
    } catch (error) {
      logger.error('获取观众分析数据失败:', error);
      // 返回缓存数据或空对象
      return this.audienceCache || { regions: {}, devices: {}, activeTimes: {} };
    }
  }

  /**
   * 处理观众数据分析
   */
  private processAudienceData(rawData: any): any {
    // 实现观众地域、设备、活跃度等维度分析
    const regions = this.aggregateByRegion(rawData.viewers);
    const devices = this.aggregateByDevice(rawData.viewers);
    const activeTimes = this.aggregateActiveTime(rawData.viewers);

    return {
      totalViewers: rawData.totalViewers || 0,
      newViewers: rawData.newViewers || 0,
      returningViewers: rawData.returningViewers || 0,
      regions,
      devices,
      activeTimes,
      topViewers: rawData.topViewers?.slice(0, 10) || []
    };
  }

  /**
   * 按地域聚合观众数据
   */
  private aggregateByRegion(viewers: any[]): Record<string, number> {
    const regions: Record<string, number> = {};
    viewers.forEach(viewer => {
      const region = viewer.region || '未知';
      regions[region] = (regions[region] || 0) + 1;
    });
    // 排序并返回前10个地域
    return Object.entries(regions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});
  }

  /**
   * 按设备类型聚合观众数据
   */
  private aggregateByDevice(viewers: any[]): Record<string, number> {
    const devices: Record<string, number> = {};
    viewers.forEach(viewer => {
      const device = viewer.device || '未知设备';
      devices[device] = (devices[device] || 0) + 1;
    });
    return devices;
  }

  /**
   * 分析观众活跃时间段
   */
  private aggregateActiveTime(viewers: any[]): Record<string, number> {
    const activeTimes: Record<string, number> = {};
    viewers.forEach(viewer => {
      if (viewer.activeTime) {
        const hour = new Date(viewer.activeTime).getHours();
        const hourRange = `${hour}:00-${hour+1}:00`;
        activeTimes[hourRange] = (activeTimes[hourRange] || 0) + 1;
      }
    });
    return activeTimes;
  }

 /**
   * 获取礼物统计数据
   */
  async getGiftStatistics(roomId: number, days: number = 7): Promise<any> {
    const now = Date.now();
    // 检查缓存
    if (this.giftStatsCache && now - this.lastGiftStatsUpdate < this.CACHE_DURATION) {
      return this.giftStatsCache;
    }

    try {
      // 调用ACFUN API获取礼物数据
      const giftData = await acfunLiveAPI.getGiftStats(roomId, days);
      // 处理并缓存数据
      this.giftStatsCache = this.processGiftData(giftData);
      this.lastGiftStatsUpdate = now;
      return this.giftStatsCache;
    } catch (error) {
      logger.error('获取礼物统计数据失败:', error);
      // 返回缓存数据或空对象
      return this.giftStatsCache || { total: 0, topGifts: [], dailyTrend: [] };
    }
  }

  /**
   * 处理礼物数据
   */
  private processGiftData(rawData: any): any {
    // 计算总收益
    const total = rawData.items?.reduce((sum: number, item: any) => sum + (item.amount || 0) * (item.price || 0), 0) || 0;
    // 获取Top礼物
    const topGifts = (rawData.items || [])
      .sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 10);
    // 生成每日趋势
    const dailyTrend = rawData.dailyData?.map((day: any) => ({
      date: day.date,
      amount: day.totalAmount || 0,
      count: day.giftCount || 0
    })) || [];

    return {
      total,
      topGifts,
      dailyTrend,
      totalGifts: rawData.totalGifts || 0,
      uniqueUsers: rawData.uniqueUsers || 0
    };
  }
}