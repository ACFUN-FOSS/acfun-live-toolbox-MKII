import { singleton } from 'tsyringe';
import { authService } from '../utils/AuthService';
import fetch from 'node-fetch';
import { AppModule } from '../core/AppModule';
import { ModuleContext } from '../core/ModuleContext';
import logger from '../utils/logger';

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
export default class DashboardModule implements AppModule {
  private lastStatsUpdate: number = 0;
  private statsCache: Stats | null = null;
  private lastBlocksUpdate: number = 0;
  private blocksCache: DynamicBlock[] | null = null;

  enable(context: ModuleContext): Promise<void> | void {
    // 初始化逻辑（如果需要）
  }

  disable(): Promise<void> | void {
    // 清理逻辑（如果需要）
  }

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
          // 获取认证令牌
            const token = await authService.getCurrentToken();
            if (!token) {
                throw new Error('用户未登录，无法获取统计数据');
            }

            // 调用ACFUN直播API获取真实数据
            const response = await fetch('https://api.acfun.cn/v2/live/stats', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`获取统计数据失败: ${response.statusText}`);
            }

            const liveData = await response.json();
            const statsData = {
                viewerCount: liveData.viewerCount || 0,
                likeCount: liveData.interactionStats?.likeCount || 0,
                bananaCount: liveData.giftStats?.bananaCount || 0,
                acCoinCount: liveData.virtualCurrencyStats?.acCoinCount || 0,
                totalIncome: liveData.incomeStats?.total || 0
            };

          // 更新缓存
          this.statsCache = statsData;
          this.lastStatsUpdate = now;

          return statsData;
        } catch (error) {
          logger.error('获取直播统计数据失败:', error);
          
          // 缓存失败时使用缓存数据或返回默认值
          if (this.statsCache) {
            return this.statsCache;
          }
          
          // 返回保底默认值
          return {
            viewerCount: 0,
            likeCount: 0,
            bananaCount: 0,
            acCoinCount: 0,
            totalIncome: 0
          };
        }
      }

  /**
   * 获取动态内容块
   * @returns 动态内容块数组
   */
  async getDynamicBlocks(): Promise<DynamicBlock[]> {
    // 检查缓存是否有效（10分钟内）
    const now = Date.now();
    if (this.blocksCache && now - this.lastBlocksUpdate < 10 * 60 * 1000) {
      return this.blocksCache;
    }

    try {
      // 获取认证令牌
      const token = await authService.getCurrentToken();
      if (!token) {
          throw new Error('用户未登录，无法获取动态内容');
      }

      // 调用API获取动态内容
      const response = await fetch('https://api.acfun.cn/v2/dashboard/blocks', {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });

      if (!response.ok) {
          throw new Error(`获取动态内容失败: ${response.statusText}`);
      }

      const data = await response.json();
      const currentHour = new Date().getHours();
      const systemNotice = this.getSystemNotice(currentHour);

      // 处理API返回的最近直播数据
      const recentStreams = data.recentStreams.map((stream: any) => 
          `直播标题: ${stream.title} | 观众数: ${stream.viewerCount.toLocaleString()} | 时长: ${stream.duration}`
      );

      // 处理平台活动通知
      const activityNotice = data.platformActivity ? [{
          title: '平台活动',
          type: 'string',
          content: data.platformActivity
      }] : [];

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
      logger.error('获取动态内容块失败:', error);
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
  async refreshStats(): Promise<Stats> {
    // 强制刷新数据
    this.statsCache = null;
    return this.getStats();
  }
}