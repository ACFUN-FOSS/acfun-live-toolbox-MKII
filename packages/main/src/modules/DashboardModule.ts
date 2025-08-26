import { singleton } from 'tsyringe';

import { randomInt } from 'crypto';
import { acfunLiveAPI } from 'acfundanmu';

interface Stats {
    viewerCount: number;
    likeCount: number;
    bananaCount: number;
    acCoinCount: number;
    totalIncome: number;
}

interface DynamicBlock {
  title: string;
  type: 'string' | 'list' | 'html';
  content: string | string[];
}

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5分钟缓存有效期

/**
 * 仪表盘模块 - 处理仪表盘相关数据和功能
 */
@singleton()
export default class DashboardModule {
  private lastStatsUpdate: number = 0;
  private statsCache: Stats | null = null;

  /**
   * 根据当前时间生成系统通知
   */
 private getSystemNotice(currentHour: number): string {
   if (currentHour < 10) {
     return '早上好！祝您直播顺利，观众多多！';
   } else if (currentHour < 18) {
     return '下午好！今天直播数据不错,继续加油！';
   } else {
     return '晚上好！感谢您今天直播,早点休息！';
   }
 }


  /**
   * 获取仪表盘统计数据
   * @returns 统计数据对象
   */
  async getStats(): Promise<Stats> {
        // 检查缓存是否有效（5分钟内）
        const now = Date.now();
        if (this.statsCache && now - this.lastStatsUpdate < CACHE_DURATION_MS) {
          return this.statsCache;
        }

        try {
          // 调用ACFUN直播API获取真实数据
            const liveData = await acfunLiveAPI.getLiveData(1); // 获取最近1天数据
            
            const statsData = {
                viewerCount: liveData.viewerCount || 0,
                likeCount: liveData.interactionStats?.likeCount || 0,
                bananaCount: liveData.giftStats?.bananaCount || 0,
                acCoinCount: liveData.virtualCurrencyStats?.acCoinCount || 0,
                // 添加额外的安全检查
                totalIncome: liveData.incomeStats?.total || 0
            };

          // 更新缓存
          this.statsCache = statsData;
          this.lastStatsUpdate = now;

          return statsData;
        } catch (error) {
          console.error('获取直播统计数据失败:', error);
          
          // 缓存失败时使用缓存数据或返回默认值
          if (this.statsCache) {
            return this.statsCache;
          }
          
          // 返回保底默认值
          return {
            viewerCount: 0,
            likeCount: 0,
            bananaCount: 0,
            acCoinCount: 0
          };
        }
      }

  /**
   * 获取动态内容块
   * @returns 动态内容块数组
   */
  private lastBlocksUpdate: number = 0;
  private blocksCache: DynamicBlock[] | null = null;

  async getDynamicBlocks(): Promise<DynamicBlock[]> {
    // 检查缓存是否有效（10分钟内）
    const now = Date.now();
    if (this.blocksCache && now - this.lastBlocksUpdate < 10 * 60 * 1000) {
      return this.blocksCache;
    }

    try {
      // 模拟从服务器获取动态内容
      // 实际应用中应该调用真实的API
      const currentHour = new Date().getHours();
      const systemNotice = this.getSystemNotice(currentHour);

      // 模拟最近直播数据
      const recentStreams = [
        '直播标题: 今天我们聊聊前端技术 | 观众数: 1,280 | 时长: 2小时30分',
        '直播标题: 我的游戏日常 | 观众数: 850 | 时长: 3小时15分',
        '直播标题: 周末闲聊 | 观众数: 620 | 时长: 1小时45分'
      ];

      // 随机决定是否显示活动通知
      const showActivity = Math.random() > 0.5;
      let activityNotice: DynamicBlock[] = [];

      if (showActivity) {
        activityNotice = [{
          title: '平台活动',
          type: 'string',
          content: '本周末有直播挑战赛活动，参与即可获得丰厚奖励！详情请查看活动中心。'
        }];
      }

      const blocks = [
        {
          title: '系统通知',
          type: 'string',
          content: systemNotice
        },
        {
          title: '最近直播',
          type: 'list',
          content: recentStreams
        },
        ...activityNotice
      ];

      // 更新缓存
      this.blocksCache = blocks;
      this.lastBlocksUpdate = now;

      return blocks;
    } catch (error) {
      console.error('获取动态内容块失败:', error);
      // 返回缓存数据或默认内容
      if (this.blocksCache) {
        return this.blocksCache;
      }
      // 默认内容
      return [{
        title: '系统通知',
        type: 'string',
        content: '当前无法获取系统通知，请稍后重试'
      }];
    }
  }

  /**
   * 刷新统计数据
   * @returns 新的统计数据
   */
  refreshStats(): {
    viewerCount: number;
    likeCount: number;
    bananaCount: number;
    acCoinCount: number;
  } {
    // 强制刷新数据
    this.statsCache = null;
    return this.getStats();
  }
}