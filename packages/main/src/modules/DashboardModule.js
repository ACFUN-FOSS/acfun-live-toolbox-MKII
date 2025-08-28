const { acfunLive } = require('acfundanmu');
const { dataManager } = require('../utils/DataManager');

class DashboardModule {
  constructor() {
    this.liveClient = acfunLive;
    this.statsCache = null;
    this.trendCache = null;
    this.giftCache = null;
    this.cacheDuration = 30000; // 30秒缓存
  }

  /**
   * 获取直播统计数据
   */
  async getStats() {
    // 检查缓存是否有效
    if (this.statsCache && Date.now() - this.statsCache.timestamp < this.cacheDuration) {
      return this.statsCache.data;
    }

    try {
      // 从acfunLive API获取数据
      const liveInfo = await this.liveClient.getLiveInfo();
      const giftStats = await this.liveClient.getGiftStats();
      const viewerData = await this.liveClient.getViewerStats();

      // 处理并整合数据
      const stats = {
        viewerCount: viewerData.onlineUsers || 0,
        likeCount: liveInfo.likeCount || 0,
        bananaCount: giftStats.bananaCount || 0,
        acCoinCount: giftStats.acCoinCount || 0,
        peakViewerCount: viewerData.peakOnlineUsers || 0,
        averageViewerCount: viewerData.averageOnlineUsers || 0,
        newFollowerCount: liveInfo.newFollowerCount || 0
      };

      // 更新缓存
      this.statsCache = {
        data: stats,
        timestamp: Date.now()
      };

      return stats;
    } catch (error) {
      console.error('获取统计数据失败:', error);
      // 缓存为空时才返回默认值
      if (!this.statsCache) {
        return {
          viewerCount: 0,
          likeCount: 0,
          bananaCount: 0,
          acCoinCount: 0,
          peakViewerCount: 0,
          averageViewerCount: 0,
          newFollowerCount: 0
        };
      }
      return this.statsCache.data;
    }
  }

  /**
   * 获取观众趋势数据
   */
  async getAudienceTrend() {
    if (this.trendCache && Date.now() - this.trendCache.timestamp < this.cacheDuration) {
      return this.trendCache.data;
    }

    try {
      // 获取最近12个时间点的数据
      const trendData = await this.liveClient.getAudienceTrend({
        interval: '5m',
        count: 12
      });

      // 格式化数据为前端需要的格式
      const formattedData = trendData.map(item => ({
        time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        viewers: item.userCount
      }));

      this.trendCache = {
        data: formattedData,
        timestamp: Date.now()
      };

      return formattedData;
    } catch (error) {
      console.error('获取观众趋势数据失败:', error);
      // 生成模拟数据
      if (!this.trendCache) {
        const mockData = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const time = new Date(now - i * 5 * 60 * 1000);
          mockData.push({
            time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            viewers: Math.floor(Math.random() * 100) + 10
          });
        }
        this.trendCache = {
          data: mockData,
          timestamp: Date.now()
        };
      }
      return this.trendCache.data;
    }
  }

  /**
   * 获取礼物统计数据
   */
  async getGiftTrend() {
    // 模拟礼物趋势数据
    return this.generateTimeSeriesData(24, 100, 500);
  }

  async getAudienceBehavior() {
    // 模拟观众行为数据
    return Array.from({length: 12}, (_, i) => ({
      time: `${i+8}:00`,
      viewers: Math.floor(Math.random() * 500) + 100,
      interactions: Math.floor(Math.random() * 200) + 50,
      conversion: (Math.random() * 10).toFixed(2)
    }));
  }

  async getGiftStats() {
    if (this.giftCache && Date.now() - this.giftCache.timestamp < this.cacheDuration) {
      return this.giftCache.data;
    }

    try {
      const giftData = await this.liveClient.getGiftRank();

      // 取前5名礼物
      const topGifts = giftData.slice(0, 5).map(gift => ({
        name: gift.name,
        value: gift.count
      }));

      this.giftCache = {
        data: topGifts,
        timestamp: Date.now()
      };

      return topGifts;
    } catch (error) {
      console.error('获取礼物统计数据失败:', error);
      // 生成模拟数据
      if (!this.giftCache) {
        this.giftCache = {
          data: [
            { name: '香蕉', value: 120 },
            { name: 'AC币', value: 85 },
            { name: '辣条', value: 60 },
            { name: '火箭', value: 15 },
            { name: '飞机', value: 8 }
          ],
          timestamp: Date.now()
        };
      }
      return this.giftCache.data;
    }
  }

  /**
   * 获取动态内容块
   */
  async getDynamicBlocks() {
    try {
      // 从数据管理器获取配置的动态内容块
      const blocks = await dataManager.get('dashboard_blocks', [
        {
          title: '直播公告',
          type: 'string',
          content: '欢迎使用ACFUN直播工具箱！这是您的直播数据仪表盘，实时展示直播关键指标。'
        },
        {
          title: '今日任务',
          type: 'list',
          content: [
            '完成直播时长2小时',
            '获得100个点赞',
            '新增5名粉丝'
          ]
        }
      ]);

      return blocks;
    } catch (error) {
      console.error('获取动态内容块失败:', error);
      // 返回默认内容块
      return [
        {
          title: '直播公告',
          type: 'string',
          content: '欢迎使用ACFUN直播工具箱！这是您的直播数据仪表盘，实时展示直播关键指标。'
        },
        {
          title: '今日任务',
          type: 'list',
          content: [
            '完成直播时长2小时',
            '获得100个点赞',
            '新增5名粉丝'
          ]
        }
      ];
    }
  }
}

module.exports = DashboardModule;