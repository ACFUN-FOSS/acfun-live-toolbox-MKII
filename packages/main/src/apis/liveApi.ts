import { ipcMain } from 'electron';
import axios from 'axios';
import { AuthManager } from '../utils/AuthManager';
import { ConfigManager } from '../utils/ConfigManager';
import { EventEmitter } from 'events';

// 直播状态事件发射器
export const liveStatusEmitter = new EventEmitter();

// 监听直播状态变更并发送到渲染进程
liveStatusEmitter.on('status-change', (status) => {
  // 发送状态变更事件到所有渲染进程
  ipcMain.emit('live:status-change', null, status);
});

// 直播相关配置
const LIVE_CONFIG = {
  API_BASE_URL: 'https://api.acfun.cn/rest/app',
  LIVE_STATUS_POLL_INTERVAL: 5000, // 直播状态轮询间隔(ms)
};

// 直播状态
let currentLiveStatus = {
  isLive: false,
  liveId: '',
  title: '',
  coverUrl: '',
  viewers: 0,
  startTime: 0,
  duration: 0,
};

// 轮询直播状态的定时器
let liveStatusPollTimer: NodeJS.Timeout | null = null;

/**
 * 初始化直播API
 */
export function initializeLiveApi() {
  console.log('Initializing Live API...');

  // 直播状态相关API
  ipcMain.on('live:get-status', async (event) => {
    try {
      event.reply('live:get-status:reply', {
        success: true,
        data: currentLiveStatus,
      });
    } catch (error) {
      event.reply('live:get-status:reply', {
        success: false,
        message: error instanceof Error ? error.message : '获取直播状态失败',
      });
    }
  });

  // 开始直播
  ipcMain.on('live:start', async (event, params) => {
    try {
      const { title, coverUrl, categoryId, tags } = params;

      if (!title) {
        throw new Error('直播标题不能为空');
      }

      const authManager = AuthManager.getInstance();
      const token = authManager.getToken();

      if (!token) {
        throw new Error('未登录，请先登录');
      }

      // 调用ACFUN API开始直播
      const response = await axios.post(
        `${LIVE_CONFIG.API_BASE_URL}/live/start`,
        {
          title,
          coverUrl: coverUrl || '',
          categoryId: categoryId || 0,
          tags: tags || [],
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.result !== 0) {
        throw new Error(response.data.errorMsg || '开始直播失败');
      }

      // 更新直播状态
      currentLiveStatus = {
        isLive: true,
        liveId: response.data.liveId,
        title,
        coverUrl: coverUrl || '',
        viewers: 0,
        startTime: Date.now(),
        duration: 0,
      };

      // 开始轮询直播状态
      startLiveStatusPolling();

      // 通知直播状态变更
      liveStatusEmitter.emit('status-change', currentLiveStatus);

      event.reply('live:start:reply', {
        success: true,
        data: currentLiveStatus,
      });
    } catch (error) {
      event.reply('live:start:reply', {
        success: false,
        message: error instanceof Error ? error.message : '开始直播失败',
      });
    }
  });

  // 结束直播
  ipcMain.on('live:end', async (event) => {
    try {
      if (!currentLiveStatus.isLive) {
        throw new Error('当前未在直播');
      }

      const authManager = AuthManager.getInstance();
      const token = authManager.getToken();

      if (!token) {
        throw new Error('未登录，请先登录');
      }

      // 调用ACFUN API结束直播
      const response = await axios.post(
        `${LIVE_CONFIG.API_BASE_URL}/live/end`,
        {
          liveId: currentLiveStatus.liveId,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.result !== 0) {
        throw new Error(response.data.errorMsg || '结束直播失败');
      }

      // 更新直播状态
      currentLiveStatus.isLive = false;
      currentLiveStatus.duration = Date.now() - currentLiveStatus.startTime;

      // 停止轮询直播状态
      stopLiveStatusPolling();

      // 通知直播状态变更
      liveStatusEmitter.emit('status-change', currentLiveStatus);

      event.reply('live:end:reply', {
        success: true,
        data: currentLiveStatus,
      });
    } catch (error) {
      event.reply('live:end:reply', {
        success: false,
        message: error instanceof Error ? error.message : '结束直播失败',
      });
    }
  });

  // 更新直播信息
  ipcMain.on('live:update-info', async (event, params) => {
    try {
      if (!currentLiveStatus.isLive) {
        throw new Error('当前未在直播');
      }

      const { title, coverUrl, tags } = params;

      const authManager = AuthManager.getInstance();
      const token = authManager.getToken();

      if (!token) {
        throw new Error('未登录，请先登录');
      }

      // 调用ACFUN API更新直播信息
      const response = await axios.post(
        `${LIVE_CONFIG.API_BASE_URL}/live/update`,
        {
          liveId: currentLiveStatus.liveId,
          title: title || currentLiveStatus.title,
          coverUrl: coverUrl || currentLiveStatus.coverUrl,
          tags: tags || [],
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.result !== 0) {
        throw new Error(response.data.errorMsg || '更新直播信息失败');
      }

      // 更新本地直播状态
      currentLiveStatus.title = title || currentLiveStatus.title;
      currentLiveStatus.coverUrl = coverUrl || currentLiveStatus.coverUrl;

      // 通知直播状态变更
      liveStatusEmitter.emit('status-change', currentLiveStatus);

      event.reply('live:update-info:reply', {
        success: true,
        data: currentLiveStatus,
      });
    } catch (error) {
      event.reply('live:update-info:reply', {
        success: false,
        message: error instanceof Error ? error.message : '更新直播信息失败',
      });
    }
  });

  // 获取直播分类
  ipcMain.on('live:get-categories', async (event) => {
    try {
      const authManager = AuthManager.getInstance();
      const token = authManager.getToken();

      if (!token) {
        throw new Error('未登录，请先登录');
      }

      // 调用ACFUN API获取直播分类
      const response = await axios.get(
        `${LIVE_CONFIG.API_BASE_URL}/live/categories`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.data.result !== 0) {
        throw new Error(response.data.errorMsg || '获取直播分类失败');
      }

      event.reply('live:get-categories:reply', {
        success: true,
        data: response.data.categories || [],
      });
    } catch (error) {
      event.reply('live:get-categories:reply', {
        success: false,
        message: error instanceof Error ? error.message : '获取直播分类失败',
      });
    }
  });

  // 获取历史直播记录
  ipcMain.on('live:get-history', async (event, params) => {
    try {
      const { page = 1, pageSize = 10 } = params;

      const authManager = AuthManager.getInstance();
      const token = authManager.getToken();

      if (!token) {
        throw new Error('未登录，请先登录');
      }

      // 调用ACFUN API获取历史直播记录
      const response = await axios.get(
        `${LIVE_CONFIG.API_BASE_URL}/live/history`,
        {
          params: {
            page,
            pageSize,
          },
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.data.result !== 0) {
        throw new Error(response.data.errorMsg || '获取历史直播记录失败');
      }

      event.reply('live:get-history:reply', {
        success: true,
        data: response.data.lives || [],
        total: response.data.total || 0,
      });
    } catch (error) {
      event.reply('live:get-history:reply', {
        success: false,
        message: error instanceof Error ? error.message : '获取历史直播记录失败',
      });
    }
  });
}

/**
 * 开始轮询直播状态
 */
function startLiveStatusPolling() {
  // 先停止之前的轮询
  stopLiveStatusPolling();

  // 开始新的轮询
  liveStatusPollTimer = setInterval(async () => {
    try {
      if (!currentLiveStatus.isLive) {
        stopLiveStatusPolling();
        return;
      }

      const authManager = AuthManager.getInstance();
      const token = authManager.getToken();

      if (!token) {
        console.error('轮询直播状态失败: 未登录');
        return;
      }

      // 调用ACFUN API获取直播状态
      const response = await axios.get(
        `${LIVE_CONFIG.API_BASE_URL}/live/status`,
        {
          params: {
            liveId: currentLiveStatus.liveId,
          },
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.data.result !== 0) {
        console.error('轮询直播状态失败:', response.data.errorMsg);
        return;
      }

      // 更新直播状态
      const newStatus = response.data.liveStatus;
      if (newStatus) {
        currentLiveStatus.viewers = newStatus.viewers || 0;
        // 如果API返回了结束时间，表示直播已结束
        if (newStatus.endTime) {
          currentLiveStatus.isLive = false;
          currentLiveStatus.duration = newStatus.endTime - currentLiveStatus.startTime;
          stopLiveStatusPolling();
        }

        // 通知直播状态变更
        liveStatusEmitter.emit('status-change', currentLiveStatus);
      }
    } catch (error) {
      console.error('轮询直播状态异常:', error);
    }
  }, LIVE_CONFIG.LIVE_STATUS_POLL_INTERVAL);
}

/**
 * 停止轮询直播状态
 */
function stopLiveStatusPolling() {
  if (liveStatusPollTimer) {
    clearInterval(liveStatusPollTimer);
    liveStatusPollTimer = null;
  }
}