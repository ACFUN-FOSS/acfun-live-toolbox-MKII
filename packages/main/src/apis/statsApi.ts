import { ipcMain } from 'electron';
import axios from 'axios';
import { AuthManager } from '../utils/AuthManager';
import { EventEmitter } from 'events';

// 数据统计事件发射器
export const statsEmitter = new EventEmitter();

// 监听统计数据变更并发送到渲染进程
statsEmitter.on('stats-updated', (stats) => {
  // 发送统计数据变更事件到所有渲染进程
  ipcMain.emit('stats:stats-updated', null, stats);
});

// 统计相关配置
const STATS_CONFIG = {
  API_BASE_URL: 'https://api.acfun.cn/rest/app',
  STATS_REFRESH_INTERVAL: 60000, // 统计数据刷新间隔(ms)
};

// 当前统计数据
let currentStats = {
  today: {
    viewers: 0,
    newFollowers: 0,
    income: 0,
    liveDuration: 0,
  },
  comparedToYesterday: {
    viewers: 0,
    newFollowers: 0,
    income: 0,
    liveDuration: 0,
  },
  allTime: {
    totalViewers: 0,
    totalFollowers: 0,
    totalIncome: 0,
    totalLiveDuration: 0,
  },
};

// 统计数据刷新定时器
let statsRefreshTimer: NodeJS.Timeout | null = null;

/**
 * 初始化统计API
 */
export function initializeStatsApi() {
  console.log('Initializing Stats API...');

  // 获取今日统计数据
  ipcMain.on('stats:get-today', async (event) => {
    try {
      event.reply('stats:get-today:reply', {
        success: true,
        data: currentStats.today,
      });
    } catch (error) {
      event.reply('stats:get-today:reply', {
        success: false,
        message: error instanceof Error ? error.message : '获取今日统计数据失败',
      });
    }
  });

  // 获取对比统计数据
  ipcMain.on('stats:get-comparison', async (event) => {
    try {
      event.reply('stats:get-comparison:reply', {
        success: true,
        data: currentStats.comparedToYesterday,
      });
    } catch (error) {
      event.reply('stats:get-comparison:reply', {
        success: false,
        message: error instanceof Error ? error.message : '获取对比统计数据失败',
      });
    }
  });

  // 获取总统计数据
  ipcMain.on('stats:get-all-time', async (event) => {
    try {
      event.reply('stats:get-all-time:reply', {
        success: true,
        data: currentStats.allTime,
      });
    } catch (error) {
      event.reply('stats:get-all-time:reply', {
        success: false,
        message: error instanceof Error ? error.message : '获取总统计数据失败',
      });
    }
  });

  // 手动刷新统计数据
  ipcMain.on('stats:refresh', async (event) => {
    try {
      await fetchAndUpdateStats();
      event.reply('stats:refresh:reply', {
        success: true,
        data: currentStats,
      });
    } catch (error) {
      event.reply('stats:refresh:reply', {
        success: false,
        message: error instanceof Error ? error.message : '刷新统计数据失败',
      });
    }
  });

  // 启动定时刷新统计数据
  startStatsRefreshTimer();
}

/**
 * 启动统计数据定时刷新
 */
function startStatsRefreshTimer() {
  // 先停止之前的定时器
  stopStatsRefreshTimer();

  // 立即刷新一次
  fetchAndUpdateStats().catch(error => {
    console.error('初始化统计数据失败:', error);
  });

  // 启动新的定时器
  statsRefreshTimer = setInterval(async () => {
    try {
      await fetchAndUpdateStats();
    } catch (error) {
      console.error('刷新统计数据失败:', error);
    }
  }, STATS_CONFIG.STATS_REFRESH_INTERVAL);
}

/**
 * 停止统计数据定时刷新
 */
function stopStatsRefreshTimer() {
  if (statsRefreshTimer) {
    clearInterval(statsRefreshTimer);
    statsRefreshTimer = null;
  }
}

/**
 * 从API获取并更新统计数据
 */
async function fetchAndUpdateStats() {
  const authManager = AuthManager.getInstance();
  const token = authManager.getToken();

  if (!token) {
    console.error('刷新统计数据失败: 未登录');
    return;
  }

  try {
    // 获取今日统计数据
    const todayResponse = await axios.get(
      `${STATS_CONFIG.API_BASE_URL}/stats/today`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (todayResponse.data.result !== 0) {
      throw new Error(todayResponse.data.errorMsg || '获取今日统计数据失败');
    }

    // 获取昨日统计数据用于对比
    const yesterdayResponse = await axios.get(
      `${STATS_CONFIG.API_BASE_URL}/stats/yesterday`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (yesterdayResponse.data.result !== 0) {
      throw new Error(yesterdayResponse.data.errorMsg || '获取昨日统计数据失败');
    }

    // 获取总统计数据
    const allTimeResponse = await axios.get(
      `${STATS_CONFIG.API_BASE_URL}/stats/all-time`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (allTimeResponse.data.result !== 0) {
      throw new Error(allTimeResponse.data.errorMsg || '获取总统计数据失败');
    }

    // 更新今日统计数据
    currentStats.today = {
      viewers: todayResponse.data.viewers || 0,
      newFollowers: todayResponse.data.newFollowers || 0,
      income: todayResponse.data.income || 0,
      liveDuration: todayResponse.data.liveDuration || 0,
    };

    // 计算对比数据（百分比）
    currentStats.comparedToYesterday = {
      viewers: calculatePercentageChange(
        yesterdayResponse.data.viewers || 0,
        currentStats.today.viewers
      ),
      newFollowers: calculatePercentageChange(
        yesterdayResponse.data.newFollowers || 0,
        currentStats.today.newFollowers
      ),
      income: calculatePercentageChange(
        yesterdayResponse.data.income || 0,
        currentStats.today.income
      ),
      liveDuration: calculatePercentageChange(
        yesterdayResponse.data.liveDuration || 0,
        currentStats.today.liveDuration
      ),
    };

    // 更新总统计数据
    currentStats.allTime = {
      totalViewers: allTimeResponse.data.totalViewers || 0,
      totalFollowers: allTimeResponse.data.totalFollowers || 0,
      totalIncome: allTimeResponse.data.totalIncome || 0,
      totalLiveDuration: allTimeResponse.data.totalLiveDuration || 0,
    };

    // 通知统计数据变更
    statsEmitter.emit('stats-updated', currentStats);

  } catch (error) {
    console.error('获取统计数据异常:', error);
    throw error;
  }
}

/**
 * 计算百分比变化
 * @param previous 先前的值
 * @param current 当前的值
 * @returns 百分比变化
 */
function calculatePercentageChange(previous: number, current: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}