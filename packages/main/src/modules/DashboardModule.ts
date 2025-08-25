import { singleton } from 'tsyringe';
import { ConfigManager } from '../utils/ConfigManager';
import { randomInt } from 'crypto';

/**
 * 仪表盘模块 - 处理仪表盘相关数据和功能
 */
@singleton()
export default class DashboardModule {
  private configManager: ConfigManager;
  private lastStatsUpdate: number = 0;
  private statsCache: {
    viewerCount: number;
    likeCount: number;
    bananaCount: number;
    acCoinCount: number;
  } | null = null;

  constructor() {
    this.configManager = new ConfigManager('dashboard');
  }

  /**
   * 获取仪表盘统计数据
   * @returns 统计数据对象
   */
  getStats(): {
    viewerCount: number;
    likeCount: number;
    bananaCount: number;
    acCoinCount: number;
  } {
    // 检查缓存是否有效（5分钟内）
    const now = Date.now();
    if (this.statsCache && now - this.lastStatsUpdate < 5 * 60 * 1000) {
      return this.statsCache;
    }

    // 模拟从服务器获取数据
    // 实际应用中应该调用真实的API
    const stats = {
      viewerCount: randomInt(500, 5000),
      likeCount: randomInt(10000, 100000),
      bananaCount: randomInt(5000, 50000),
      acCoinCount: randomInt(1000, 20000)
    };

    // 更新缓存
    this.statsCache = stats;
    this.lastStatsUpdate = now;

    return stats;
  }

  /**
   * 获取动态内容块
   * @returns 动态内容块数组
   */
  getDynamicBlocks(): Array<{
    title: string;
    type: 'string' | 'list' | 'html';
    content: string | string[];
  }> {
    // 模拟从服务器获取动态内容
    // 实际应用中应该调用真实的API
    const currentHour = new Date().getHours();
    let systemNotice = '当前系统运行正常，无异常通知';

    if (currentHour < 10) {
      systemNotice = '早上好！祝您直播顺利，观众多多！';
    } else if (currentHour < 18) {
      systemNotice = '下午好！今天的直播数据不错，继续加油！';
    } else {
      systemNotice = '晚上好！感谢您今天的直播，早点休息！';
    }

    // 模拟最近直播数据
    const recentStreams = [
      '直播标题: 今天我们聊聊前端技术 | 观众数: 1,280 | 时长: 2小时30分',
      '直播标题: 我的游戏日常 | 观众数: 850 | 时长: 3小时15分',
      '直播标题: 周末闲聊 | 观众数: 620 | 时长: 1小时45分'
    ];

    // 随机决定是否显示活动通知
    const showActivity = Math.random() > 0.5;
    let activityNotice: Array<{
      title: string;
      type: 'string' | 'list' | 'html';
      content: string | string[];
    }> = [];

    if (showActivity) {
      activityNotice = [{
        title: '平台活动',
        type: 'string',
        content: '本周末有直播挑战赛活动，参与即可获得丰厚奖励！详情请查看活动中心。'
      }];
    }

    return [
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