import express from 'express';
import { initializeElectronApi } from './electronApi.js';
import { acfunDanmuModule } from '../modules/AcfunDanmuModule.js';
import { getLogManager } from '../utils/LogManager.js';

export function initializeHttpApi() {
  // 创建路由
  const router = express.Router();

  // 健康检查接口
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ====== 窗口管理相关HTTP接口 ======
  // 关闭窗口
  router.post('/window/close', async (req, res) => {
    try {
      const { windowId } = req.body;
      const result = await globalThis.windowManager.closeWindow(windowId);
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 最小化窗口
  router.post('/window/minimize', async (req, res) => {
    try {
      const { windowId } = req.body;
      const result = await globalThis.windowManager.minimizeWindow(windowId);
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 置顶窗口切换
  router.post('/window/toggleAlwaysOnTop', async (req, res) => {
    try {
      const { windowId, alwaysOnTop } = req.body;
      const targetWindowId = windowId ?? globalThis.windowManager.getFocusedWindowId();
      if (!targetWindowId) {
        return res.status(400).json({ success: false, error: 'No window specified or focused' });
      }

      const finalAlwaysOnTop = alwaysOnTop !== undefined ? alwaysOnTop : !globalThis.windowManager.isWindowAlwaysOnTop(targetWindowId);
      const result = await globalThis.windowManager.updateWindowProperties(targetWindowId, { alwaysOnTop: finalAlwaysOnTop });
      res.json({ success: result, alwaysOnTop: finalAlwaysOnTop });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 设置窗口是否可聚焦
  router.post('/window/setFocusable', async (req, res) => {
    try {
      const { windowId, focusable } = req.body;
      if (windowId === undefined || focusable === undefined) {
        return res.status(400).json({ success: false, error: 'windowId and focusable are required' });
      }
      const result = await globalThis.windowManager.updateWindowProperties(windowId, { focusable });
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 获取窗口是否置顶
  router.get('/window/isAlwaysOnTop', async (req, res) => {
    try {
      const { windowId } = req.query;
      const result = await globalThis.windowManager.isWindowAlwaysOnTop(Number(windowId) || undefined);
      res.json({ success: true, isAlwaysOnTop: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 获取所有窗口
  router.get('/window/getAllWindows', async (req, res) => {
    try {
      const result = await globalThis.windowManager.getAllWindowsInfo();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ====== 应用管理相关HTTP接口 ======
  // 获取已安装应用
  router.get('/app/getInstalledApps', async (req, res) => {
    try {
      const appManager = globalThis.appManager;
      const apps = Array.from(appManager.apps.entries()).map(([id, config]) => ({
        id,
        ...config
      }));
      res.json({ success: true, data: apps });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 启动应用
  router.post('/app/startApp', async (req, res) => {
    try {
      const { appId, displayType } = req.body;
      if (!appId) {
        return res.status(400).json({ success: false, error: 'appId is required' });
      }
      const appManager = globalThis.appManager;
      const window = await appManager.startApp(appId, displayType);
      res.json({ success: true, windowId: window.id });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 注册应用模块
  router.post('/app/registerModule', async (req, res) => {
    try {
      const { moduleName, modulePath } = req.body;
      if (!moduleName || !modulePath) {
        return res.status(400).json({ success: false, error: 'moduleName and modulePath are required' });
      }
      const appManager = globalThis.appManager;
      await appManager.registerModule(moduleName, modulePath);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 启用应用模块
  router.post('/app/enableModule', async (req, res) => {
    try {
      const { moduleName } = req.body;
      if (!moduleName) {
        return res.status(400).json({ success: false, error: 'moduleName is required' });
      }
      const appManager = globalThis.appManager;
      await appManager.enableModule(moduleName);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ====== Acfun弹幕模块相关HTTP接口 ======
// 启动Acfun弹幕模块
router.post('/acfunDanmu/start', async (req, res) => {
  try {
    await acfunDanmuModule.start();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 停止Acfun弹幕模块
router.post('/acfunDanmu/stop', async (req, res) => {
  try {
    await acfunDanmuModule.stop();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重启Acfun弹幕模块
router.post('/acfunDanmu/restart', async (req, res) => {
  try {
    await acfunDanmuModule.restart();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新Acfun弹幕模块配置
router.post('/acfunDanmu/updateConfig', async (req, res) => {
  try {
    const config = req.body;
    acfunDanmuModule.updateConfig(config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取Acfun弹幕模块配置
router.get('/acfunDanmu/getConfig', async (req, res) => {
  try {
    const config = acfunDanmuModule.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取Acfun弹幕模块状态
router.get('/acfunDanmu/getStatus', async (req, res) => {
  try {
    const status = acfunDanmuModule.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取Acfun弹幕模块日志
router.get('/acfunDanmu/getLogs', async (req, res) => {
  try {
    const { limit } = req.query;
    const logManager = getLogManager();
    const logs = logManager.getLogs('acfunDanmu', Number(limit) || 100);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 房管相关HTTP接口 ======
// 获取房管列表
router.get('/acfunDanmu/manager/list', async (req, res) => {
  try {
    const { uid, page = 1, pageSize = 20 } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getManagerList(Number(uid), Number(page), Number(pageSize));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加房管
router.post('/acfunDanmu/manager/add', async (req, res) => {
  try {
    const { uid, targetId } = req.body;
    if (!uid || !targetId) {
      return res.status(400).json({ success: false, error: 'uid and targetId are required' });
    }
    const result = await acfunDanmuModule.addManager(Number(uid), Number(targetId));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除房管
router.post('/acfunDanmu/manager/remove', async (req, res) => {
  try {
    const { uid, targetId } = req.body;
    if (!uid || !targetId) {
      return res.status(400).json({ success: false, error: 'uid and targetId are required' });
    }
    const result = await acfunDanmuModule.removeManager(Number(uid), Number(targetId));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取踢人记录
router.get('/acfunDanmu/manager/kickRecord', async (req, res) => {
  try {
    const { uid, page = 1, pageSize = 20 } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getKickRecord(Number(uid), Number(page), Number(pageSize));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 房管踢人
router.post('/acfunDanmu/manager/kickUser', async (req, res) => {
  try {
    const { uid, targetId, reason = '', duration = 3600 } = req.body;
    if (!uid || !targetId) {
      return res.status(400).json({ success: false, error: 'uid and targetId are required' });
    }
    const result = await acfunDanmuModule.managerKickUser(Number(uid), Number(targetId), reason, Number(duration));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 主播踢人
router.post('/acfunDanmu/author/kickUser', async (req, res) => {
  try {
    const { uid, targetId, reason = '', duration = 3600 } = req.body;
    if (!uid || !targetId) {
      return res.status(400).json({ success: false, error: 'uid and targetId are required' });
    }
    const result = await acfunDanmuModule.authorKickUser(Number(uid), Number(targetId), reason, Number(duration));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 守护徽章相关HTTP接口 ======
// 获取徽章详情
router.get('/acfunDanmu/medal/detail', async (req, res) => {
  try {
    const { uid, medalId } = req.query;
    if (!uid || !medalId) {
      return res.status(400).json({ success: false, error: 'uid and medalId are required' });
    }
    const result = await acfunDanmuModule.getMedalDetail(Number(uid), Number(medalId));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取徽章列表
router.get('/acfunDanmu/medal/list', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getMedalList(Number(uid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取徽章排行榜
router.get('/acfunDanmu/medal/rank', async (req, res) => {
  try {
    const { uid, medalId, rankType = 1 } = req.query;
    if (!uid || !medalId) {
      return res.status(400).json({ success: false, error: 'uid and medalId are required' });
    }
    const result = await acfunDanmuModule.getMedalRank(Number(uid), Number(medalId), Number(rankType));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取用户佩戴徽章
router.get('/acfunDanmu/medal/wearing', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getUserWearingMedal(Number(uid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 佩戴徽章
router.post('/acfunDanmu/medal/wear', async (req, res) => {
  try {
    const { uid, medalId } = req.body;
    if (!uid || !medalId) {
      return res.status(400).json({ success: false, error: 'uid and medalId are required' });
    }
    const result = await acfunDanmuModule.wearMedal(Number(uid), Number(medalId));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 取消佩戴徽章
router.post('/acfunDanmu/medal/unwear', async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.unwearMedal(Number(uid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 观看列表相关HTTP接口 ======
// 获取观看列表
router.get('/acfunDanmu/watchingList', async (req, res) => {
  try {
    const { uid, page = 1, pageSize = 20 } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getWatchingList(Number(uid), Number(page), Number(pageSize));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 排行榜相关HTTP接口 ======
// 获取排行榜
router.get('/acfunDanmu/billboard', async (req, res) => {
  try {
    const { type, size = 10 } = req.query;
    if (!type) {
      return res.status(400).json({ success: false, error: 'type is required' });
    }
    const result = await acfunDanmuModule.getBillboard(type as string, Number(size));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 摘要信息相关HTTP接口 ======
// 获取摘要信息
router.get('/acfunDanmu/summary', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getSummary(Number(uid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 幸运列表相关HTTP接口 ======
// 获取幸运列表
router.get('/acfunDanmu/luckList', async (req, res) => {
  try {
    const { uid, activityId, page = 1, pageSize = 20 } = req.query;
    if (!uid || !activityId) {
      return res.status(400).json({ success: false, error: 'uid and activityId are required' });
    }
    const result = await acfunDanmuModule.getLuckList(Number(uid), activityId as string, Number(page), Number(pageSize));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 回放信息相关HTTP接口 ======
// 获取回放信息
router.get('/acfunDanmu/playback', async (req, res) => {
  try {
    const { uid, vid } = req.query;
    if (!uid || !vid) {
      return res.status(400).json({ success: false, error: 'uid and vid are required' });
    }
    const result = await acfunDanmuModule.getPlayback(Number(uid), vid as string);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 礼物列表相关HTTP接口 ======
// 获取全部礼物列表
router.get('/acfunDanmu/gift/all', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getAllGiftList(Number(uid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取直播间礼物列表
router.get('/acfunDanmu/gift/list', async (req, res) => {
  try {
    const { uid, rid } = req.query;
    if (!uid || !rid) {
      return res.status(400).json({ success: false, error: 'uid and rid are required' });
    }
    const result = await acfunDanmuModule.getGiftList(Number(uid), Number(rid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 账户钱包相关HTTP接口 ======
// 获取账户钱包数据
router.get('/acfunDanmu/wallet/balance', async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getWalletBalance(Number(uid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 用户直播信息相关HTTP接口 ======
// 获取用户直播信息
router.get('/acfunDanmu/user/liveInfo', async (req, res) => {
  try {
    const { uid, targetId } = req.query;
    if (!uid || !targetId) {
      return res.status(400).json({ success: false, error: 'uid and targetId are required' });
    }
    const result = await acfunDanmuModule.getUserLiveInfo(Number(uid), Number(targetId));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 直播列表相关HTTP接口 ======
// 获取所有直播列表
router.get('/acfunDanmu/live/all', async (req, res) => {
  try {
    const { uid, page = 1, pageSize = 20 } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getAllLiveList(Number(uid), Number(page), Number(pageSize));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 直播数据相关HTTP接口 ======
// 获取直播数据
router.get('/acfunDanmu/live/data', async (req, res) => {
  try {
    const { uid, rid } = req.query;
    if (!uid || !rid) {
      return res.status(400).json({ success: false, error: 'uid and rid are required' });
    }
    const result = await acfunDanmuModule.getLiveData(Number(uid), Number(rid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 用户信息相关HTTP接口 ======
// 获取用户信息
router.get('/acfunDanmu/user/info', async (req, res) => {
  try {
    const { uid, targetId } = req.query;
    if (!uid || !targetId) {
      return res.status(400).json({ success: false, error: 'uid and targetId are required' });
    }
    const result = await acfunDanmuModule.getUserInfo(Number(uid), Number(targetId));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 上传图片相关HTTP接口 ======
// 上传图片
router.post('/acfunDanmu/image/upload', async (req, res) => {
  try {
    const { uid, imagePath } = req.body;
    if (!uid || !imagePath) {
      return res.status(400).json({ success: false, error: 'uid and imagePath are required' });
    }
    const result = await acfunDanmuModule.uploadImage(Number(uid), imagePath);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 直播预告相关HTTP接口 ======
// 获取直播预告列表
router.get('/acfunDanmu/schedule/list', async (req, res) => {
  try {
    const { uid, page = 1, pageSize = 20 } = req.query;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }
    const result = await acfunDanmuModule.getScheduleList(Number(uid), Number(page), Number(pageSize));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 直播状态相关HTTP接口 ======
// 获取直播状态
router.get('/acfunDanmu/live/status', async (req, res) => {
  try {
    const { uid, rid } = req.query;
    if (!uid || !rid) {
      return res.status(400).json({ success: false, error: 'uid and rid are required' });
    }
    const result = await acfunDanmuModule.getLiveStatus(Number(uid), Number(rid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取转码信息
router.get('/acfunDanmu/live/transcodeInfo', async (req, res) => {
  try {
    const { uid, rid } = req.query;
    if (!uid || !rid) {
      return res.status(400).json({ success: false, error: 'uid and rid are required' });
    }
    const result = await acfunDanmuModule.getTranscodeInfo(Number(uid), Number(rid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 直播控制相关HTTP接口 ======
// 开始直播
router.post('/acfunDanmu/live/start', async (req, res) => {
  try {
    const { uid, title, coverImage } = req.body;
    if (!uid || !title || !coverImage) {
      return res.status(400).json({ success: false, error: 'uid, title and coverImage are required' });
    }
    const result = await acfunDanmuModule.startLive(Number(uid), title, coverImage);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 停止直播
router.post('/acfunDanmu/live/stop', async (req, res) => {
  try {
    const { uid, rid } = req.body;
    if (!uid || !rid) {
      return res.status(400).json({ success: false, error: 'uid and rid are required' });
    }
    const result = await acfunDanmuModule.stopLive(Number(uid), Number(rid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新直播间信息
router.post('/acfunDanmu/live/updateInfo', async (req, res) => {
  try {
    const { uid, rid, title, coverImage } = req.body;
    if (!uid || !rid || !title || !coverImage) {
      return res.status(400).json({ success: false, error: 'uid, rid, title and coverImage are required' });
    }
    const result = await acfunDanmuModule.updateLiveInfo(Number(uid), Number(rid), title, coverImage);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 直播剪辑相关HTTP接口 ======
// 查询是否允许剪辑
router.get('/acfunDanmu/live/checkCanCut', async (req, res) => {
  try {
    const { uid, rid } = req.query;
    if (!uid || !rid) {
      return res.status(400).json({ success: false, error: 'uid and rid are required' });
    }
    const result = await acfunDanmuModule.checkCanCut(Number(uid), Number(rid));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 设置是否允许剪辑
router.post('/acfunDanmu/live/setCanCut', async (req, res) => {
  try {
    const { uid, rid, canCut } = req.body;
    if (!uid || !rid || canCut === undefined) {
      return res.status(400).json({ success: false, error: 'uid, rid and canCut are required' });
    }
    const result = await acfunDanmuModule.setCanCut(Number(uid), Number(rid), canCut);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

  // 启动Acfun弹幕模块
  router.post('/acfunDanmu/start', async (req, res) => {
    try {
      await acfunDanmuModule.start();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 停止Acfun弹幕模块
  router.post('/acfunDanmu/stop', async (req, res) => {
    try {
      await acfunDanmuModule.stop();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 重启Acfun弹幕模块
  router.post('/acfunDanmu/restart', async (req, res) => {
    try {
      await acfunDanmuModule.restart();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 更新Acfun弹幕模块配置
  router.post('/acfunDanmu/updateConfig', async (req, res) => {
    try {
      const config = req.body;
      acfunDanmuModule.updateConfig(config);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 获取Acfun弹幕模块配置
  router.get('/acfunDanmu/getConfig', async (req, res) => {
    try {
      const config = acfunDanmuModule.getConfig();
      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 获取Acfun弹幕模块状态
  router.get('/acfunDanmu/getStatus', async (req, res) => {
    try {
      const status = acfunDanmuModule.getStatus();
      res.json({ success: true, data: status });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 获取Acfun弹幕模块日志
  router.get('/acfunDanmu/getLogs', async (req, res) => {
    try {
      const { limit } = req.query;
      const logManager = getLogManager();
      const logs = logManager.getLogs('acfunDanmu', Number(limit) || 100);
      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}