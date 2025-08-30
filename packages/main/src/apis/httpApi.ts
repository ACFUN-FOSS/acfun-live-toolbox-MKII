import express, { Request, Response, NextFunction } from 'express';

// 基础响应接口
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 请求验证错误接口
interface ValidationError {
  field: string;
  message: string;
}

// 缺少的接口定义
interface WindowInfo {
  id: number;
  title: string;
  isFocused: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  alwaysOnTop: boolean;
}

interface MiniProgramInfo {
  id: string;
  name: string;
  path: string;
  config: Record<string, any>;
  lastUsed: Date;
}

// 请求验证辅助函数
const validateRequest = (validations: ((req: Request) => ValidationError[])[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    validations.forEach(validation => {
      errors.push(...validation(req));
    });
    if (errors.length > 0) {
      return res.status(400).json<ApiResponse<ValidationError[]>>({
        success: false,
        error: 'Validation failed',
        data: errors
      });
    }
    next();
  };
}
import { initializeElectronApi } from './electronApi.js';
import { acfunDanmuModule } from '../modules/AcfunDanmuModule.js';
import { getLogManager } from '../utils/logger';
import { AppManager } from '../core/AppManager';
import { WindowManager } from '../modules/WindowManager';

// 统一错误处理中间件
const errorHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      const logger = getLogManager().getLogger('httpApi');
      logger.error('API Error:', error);
      res.status(500).json<ApiResponse>({
        success: false,
        error: error.message || 'An unexpected error occurred'
      });
    });
  };

// 请求验证辅助函数
const validateRequest = (validations: ((req: Request) => ValidationError[])[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    validations.forEach(validation => {
      errors.push(...validation(req));
    });
    if (errors.length > 0) {
      return res.status(400).json<ApiResponse<ValidationError[]>>({
        success: false,
        error: 'Validation failed',
        data: errors
      });
    }
    next();
  };
}
import { initializeElectronApi } from './electronApi.js';
import { acfunDanmuModule } from '../modules/AcfunDanmuModule.js';
import { getLogManager } from '../utils/LogManager.js';
import { setupEventSourceRoutes } from './eventSourceApi.js';


export function initializeHttpApi() {
  // 创建路由
  const router = express.Router();

  // 设置EventSource路由
  setupEventSourceRoutes(router);


  // 健康检查接口
router.get('/health', errorHandler(async (req: Request, res: Response) => {
  res.json<ApiResponse<{ status: string; timestamp: string }>>({
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() }
  });
}));

// 用户认证相关接口
const validateLogin = (req: Request): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!req.body.username) errors.push({ field: 'username', message: '用户名必填' });
  if (!req.body.password) errors.push({ field: 'password', message: '密码必填' });
  return errors;
};

// 用户登录
router.post('/auth/login', validateRequest([validateLogin]), errorHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const token = await acfunDanmuModule.login(username, password);
  res.json<ApiResponse<{ token }>>({ success: true, data: { token } });
}));

// 用户注销
router.post('/auth/logout', errorHandler(async (req: Request, res: Response) => {
  const { token } = req.body;
  await acfunDanmuModule.logout(token);
  res.json<ApiResponse<{}>>({ success: true, data: {} });
}));

// 验证用户令牌
router.get('/auth/verify', errorHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json<ApiResponse>({ success: false, error: '未提供令牌' });
  }
  const isValid = await acfunDanmuModule.verifyToken(token);
  res.json<ApiResponse<{ valid: boolean }>>({ success: true, data: { valid: isValid } });
}));

  // 窗口关闭验证函数
  const validateWindowClose = (req: Request): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (req.body.windowId === undefined) {
      errors.push({ field: 'windowId', message: 'windowId is required' });
    }
    return errors;
  }

  // ====== 窗口管理相关HTTP接口 ======
  // 关闭窗口
  router.post('/window/close', validateRequest([validateWindowClose]), errorHandler(async (req: Request, res: Response) => {
    const logger = getLogManager().getLogger('httpApi');
    const { windowId } = req.body;
    try {
      const windowManager = globalThis.windowManager as WindowManager;
      const result = await windowManager.closeWindow(windowId);
      logger.info(`Closed window ${windowId}: ${result}`);
      res.json<ApiResponse<boolean>>({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Failed to close window ${windowId}:`, error);
      throw error;
    }
  }));

  // 窗口最小化验证函数
  const validateWindowMinimize = (req: Request): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (req.body.windowId === undefined) {
      errors.push({ field: 'windowId', message: 'windowId is required' });
    }
    return errors;
  };

  // 最小化窗口
  router.post('/window/minimize', validateRequest([validateWindowMinimize]), errorHandler(async (req: Request, res: Response) => {
    const { windowId } = req.body;
    const result = await globalThis.windowManager.minimizeWindow(windowId);
    res.json<ApiResponse<boolean>>({
      success: true,
      data: result
    });
  }));

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

  // 设置窗口可聚焦验证函数
  const validateSetFocusable = (req: Request): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (req.body.windowId === undefined) {
      errors.push({ field: 'windowId', message: 'windowId is required' });
    }
    if (req.body.focusable === undefined) {
      errors.push({ field: 'focusable', message: 'focusable is required' });
    }
    if (typeof req.body.focusable !== 'boolean' && req.body.focusable !== undefined) {
      errors.push({ field: 'focusable', message: 'focusable must be a boolean' });
    }
    return errors;
  };

  // 设置窗口是否可聚焦
  router.post('/window/setFocusable', validateRequest([validateSetFocusable]), errorHandler(async (req: Request, res: Response) => {
    const { windowId, focusable } = req.body;
    const result = await globalThis.windowManager.updateWindowProperties(windowId, { focusable });
    res.json<ApiResponse<boolean>>({
      success: true,
      data: result
    });
  }));

   // 获取窗口置顶状态验证函数
  const validateIsAlwaysOnTop = (req: Request): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (req.query.windowId !== undefined && (typeof req.query.windowId !== 'string' || isNaN(Number(req.query.windowId)))) {
      errors.push({ field: 'windowId', message: 'windowId must be a number if provided' });
    }
    return errors;
  };

  // 获取窗口是否置顶
  router.get('/window/isAlwaysOnTop', validateRequest([validateIsAlwaysOnTop]), errorHandler(async (req: Request, res: Response) => {
    const { windowId } = req.query;
    const parsedWindowId = windowId !== undefined ? Number(windowId) : undefined;
    const result = await globalThis.windowManager.isWindowAlwaysOnTop(parsedWindowId);
    res.json<ApiResponse<{ isAlwaysOnTop: boolean }>>({
      success: true,
      data: { isAlwaysOnTop: result }
    });
  }));

  // 获取所有窗口
  router.get('/window/getAllWindows', errorHandler(async (req: Request, res: Response) => {
    const result = await globalThis.windowManager.getAllWindowsInfo();
    res.json<ApiResponse<WindowInfo[]>>({
      success: true,
      data: result
    });
  }));

  // ====== 小程序管理相关HTTP接口 ======
  // 获取小程序列表
  router.get('/miniProgram/list', errorHandler(async (req: Request, res: Response) => {
    const result = await globalThis.appManager.getMiniPrograms();
    res.json<ApiResponse<MiniProgramInfo[]>>({ success: true, data: result });
  }));

  // 添加小程序验证函数
  const validateAddMiniProgram = (req: Request): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!req.body.name) errors.push({ field: 'name', message: '小程序名称必填' });
    if (!req.body.path) errors.push({ field: 'path', message: '小程序路径必填' });
    return errors;
  };

  // 添加小程序
  router.post('/miniProgram/add', validateRequest([validateAddMiniProgram]), errorHandler(async (req: Request, res: Response) => {
    const { name, path, config } = req.body;
    const result = await globalThis.appManager.addMiniProgram(name, path, config);
    res.json<ApiResponse<{ id: string }>>({ success: true, data: { id: result } });
  }));

  // 更新小程序配置
  router.post('/miniProgram/update', errorHandler(async (req: Request, res: Response) => {
    const { id, config } = req.body;
    await globalThis.appManager.updateMiniProgramConfig(id, config);
    res.json<ApiResponse<{}>>({ success: true, data: {} });
  }));

  // 删除小程序
  router.delete('/miniProgram/:id', errorHandler(async (req: Request, res: Response) => {
    await globalThis.appManager.removeMiniProgram(req.params.id);
    res.json<ApiResponse<{}>>({ success: true, data: {} });
  }));

  // 快捷键设置相关接口
router.get('/settings/shortcuts', errorHandler(async (req: Request, res: Response) => {
  const appManager = globalThis.appManager as AppManager;
  const shortcuts = await appManager.getShortcuts();
  res.json<ApiResponse<typeof shortcuts>>({ success: true, data: shortcuts });
}));

router.post('/settings/shortcuts', errorHandler(async (req: Request, res: Response) => {
  const { shortcuts } = req.body;
  const appManager = globalThis.appManager as AppManager;
  await appManager.setShortcuts(shortcuts);
  res.json<ApiResponse<{}>>({ success: true, data: {} });
}));

router.post('/settings/shortcuts/reset', errorHandler(async (req: Request, res: Response) => {
  const appManager = globalThis.appManager as AppManager;
  await appManager.resetShortcuts();
  res.json<ApiResponse<{}>>({ success: true, data: {} });
}));

// 小程序市场相关接口
router.get('/mini-programs/marketplace', async (req, res) => {
  try {
    const marketplaceApps = await appManager.getMarketplaceApps();
    res.json({ success: true, data: marketplaceApps });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mini-programs/install', async (req, res) => {
  try {
    const { name, source } = req.body;
    await appManager.installMiniProgram(name, source);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mini-programs/update', async (req, res) => {
  try {
    const { name } = req.body;
    await appManager.updateMiniProgram(name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 弹幕系统相关接口
router.get('/danmu/send', async (req, res) => {
  try {
    const { roomId, content, userId, nickname } = req.query;
    const result = await acfunDanmuModule.sendDanmu(Number(roomId), Number(userId), nickname as string, content as string);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/danmu/history', async (req, res) => {
  try {
    const { roomId, page = 1, pageSize = 20 } = req.query;
    const history = await acfunDanmuModule.getDanmuHistory(Number(roomId), Number(page), Number(pageSize));
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/danmu/block', async (req, res) => {
  try {
    const { roomId, userId, duration = 3600 } = req.body;
    await acfunDanmuModule.blockUser(Number(roomId), Number(userId), Number(duration));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 房间管理相关接口
router.get('/room/managers', async (req, res) => {
  try {
    const { uid, page = 1, pageSize = 20 } = req.query;
    const managers = await acfunDanmuModule.getManagerList(Number(uid), Number(page), Number(pageSize));
    res.json({ success: true, data: managers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/room/managers/add', async (req, res) => {
  try {
    const { uid, targetId } = req.body;
    await acfunDanmuModule.addManager(Number(uid), Number(targetId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/room/managers/remove', async (req, res) => {
  try {
    const { uid, targetId } = req.body;
    await acfunDanmuModule.removeManager(Number(uid), Number(targetId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/room/kick', async (req, res) => {
  try {
    const { uid, targetId, reason, duration = 3600 } = req.body;
    await acfunDanmuModule.managerKickUser(Number(uid), Number(targetId), reason, Number(duration));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 推流管理相关接口
router.post('/stream/start', async (req, res) => {
  try {
    const { roomId, streamKey, quality = 'medium' } = req.body;
    const result = await acfunDanmuModule.startStream(Number(roomId), streamKey, quality);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stream/stop', async (req, res) => {
  try {
    const { roomId } = req.body;
    await acfunDanmuModule.stopStream(Number(roomId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stream/status', async (req, res) => {
  try {
    const { roomId } = req.query;
    const status = await acfunDanmuModule.getStreamStatus(Number(roomId));
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// RTMP配置管理
router.post('/stream/saveRtmpConfig', async (req, res) => {
  try {
    const { roomId, rtmpUrl, streamKey } = req.body;
    const result = await acfunDanmuModule.saveRtmpConfig(Number(roomId), rtmpUrl, streamKey);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stream/getRtmpConfig', async (req, res) => {
  try {
    const { roomId } = req.query;
    const config = await acfunDanmuModule.getRtmpConfig(Number(roomId));
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// OBS连接状态监控
router.get('/stream/obsStatus', async (req, res) => {
  try {
    const { roomId } = req.query;
    const status = await acfunDanmuModule.getObsConnectionStatus(Number(roomId));
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 日志系统相关接口
router.get('/logs', async (req, res) => {
  try {
    const { source, level, limit = 100 } = req.query;
    const logs = getLogManager().getLogs(source as string, Number(limit));
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/logs', async (req, res) => {
  try {
    const { source } = req.body;
    if (source) {
      getLogManager().clearLogs(source);
    } else {
      getLogManager().clearAllLogs();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 系统功能相关接口
router.get('/system/network-check', async (req, res) => {
  try {
    const status = await appManager.checkNetworkStatus();
    res.json({ success: true, data: { connected: status } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mini-programs/status', async (req, res) => {
  try {
    const statuses = await appManager.getMiniProgramStatuses();
    res.json({ success: true, data: statuses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 小程序安装接口
router.post('/mini-program/install', async (req, res) => {
  try {
    const { packageUrl, version } = req.body;
    const result = await appManager.installMiniProgram(packageUrl, version);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 小程序更新接口
router.post('/mini-program/update', async (req, res) => {
  try {
    const { appId } = req.body;
    const result = await appManager.updateMiniProgram(appId);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====== 应用管理相关HTTP接口 ======
  // 获取已安装应用
  router.get('/app/getInstalledApps', errorHandler(async (req: Request, res: Response) => {
    const result = await globalThis.appManager.getInstalledApps();
    res.json<ApiResponse<AppInfo[]>>({
      success: true,
      data: result
    });
  }));

  // 启动应用验证函数
  const validateStartApp = (req: Request): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!req.body.appId) {
      errors.push({ field: 'appId', message: 'appId is required' });
    }
    if (req.body.displayType !== undefined && !['window', 'fullscreen', 'minimal'].includes(req.body.displayType)) {
      errors.push({ field: 'displayType', message: 'displayType must be one of: window, fullscreen, minimal' });
    }
    return errors;
  };

  // 启动应用
  router.post('/app/startApp', validateRequest([validateStartApp]), errorHandler(async (req: Request, res: Response) => {
    const { appId, displayType } = req.body;
    const appManager = globalThis.appManager;
    const window = await appManager.startApp(appId, displayType);
    res.json<ApiResponse<{ windowId: number }>>({
      success: true,
      data: { windowId: window.id }
    });
  }));

  // 注册应用模块验证函数
  const validateRegisterModule = (req: Request): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!req.body.moduleName) {
      errors.push({ field: 'moduleName', message: 'moduleName is required' });
    }
    if (!req.body.modulePath) {
      errors.push({ field: 'modulePath', message: 'modulePath is required' });
    }
    return errors;
  };

  // 注册应用模块
  router.post('/app/registerModule', validateRequest([validateRegisterModule]), errorHandler(async (req: Request, res: Response) => {
    const { moduleName, modulePath } = req.body;
    const appManager = globalThis.appManager;
    await appManager.registerModule(moduleName, modulePath);
    res.json<ApiResponse<{}>>({
      success: true,
      data: {}
    });
  }));

  // 启用应用模块验证函数
  const validateEnableModule = (req: Request): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!req.body.moduleName) {
      errors.push({ field: 'moduleName', message: 'moduleName is required' });
    }
    return errors;
  };

  // 启用应用模块
  router.post('/app/enableModule', validateRequest([validateEnableModule]), errorHandler(async (req: Request, res: Response) => {
    const { moduleName } = req.body;
    const appManager = globalThis.appManager;
    await appManager.enableModule(moduleName);
    res.json<ApiResponse<{}>>({
      success: true,
      data: {}
    });
  }));

  // ====== Acfun弹幕模块相关HTTP接口 ======
// 启动Acfun弹幕模块
router.post('/acfunDanmu/start', errorHandler(async (req: Request, res: Response) => {
  await acfunDanmuModule.start();
  res.json<ApiResponse<{}>>({
    success: true,
    data: {}
  });
}));

// 停止Acfun弹幕模块
router.post('/acfunDanmu/stop', errorHandler(async (req: Request, res: Response) => {
  await acfunDanmuModule.stop();
  res.json<ApiResponse<{}>>({
    success: true,
    data: {}
  });
}));

// 重启Acfun弹幕模块
router.post('/acfunDanmu/restart', errorHandler(async (req: Request, res: Response) => {
  await acfunDanmuModule.restart();
  res.json<ApiResponse<{}>>({
    success: true,
    data: {}
  });
}));

// 上传直播封面
const validateUploadCover = (req: Request): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!req.body.liveId || req.body.liveId <= 0) errors.push({ field: 'liveId', message: '有效的liveId必填' });
  if (!req.body.imagePath) errors.push({ field: 'imagePath', message: '图片路径必填' });
  return errors;
};

router.post('/acfunDanmu/uploadCover', validateRequest([validateUploadCover]), errorHandler(async (req: Request, res: Response) => {
  const { liveId, imagePath } = req.body;
  const result = await acfunDanmuModule.uploadCover(Number(liveId), imagePath);
  res.json<ApiResponse<{}>>({
    success: true,
    data: result
  });
}));

// 更新Acfun弹幕模块配置验证函数
const validateUpdateConfig = (req: Request): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!req.body || typeof req.body !== 'object') {
    errors.push({ field: 'config', message: 'Valid config object is required' });
  }
  return errors;
};

// 更新Acfun弹幕模块配置
router.post('/acfunDanmu/updateConfig', validateRequest([validateUpdateConfig]), errorHandler(async (req: Request, res: Response) => {
  const config = req.body;
  acfunDanmuModule.updateConfig(config);
  res.json<ApiResponse<{}>>({
    success: true,
    data: {}
  });
}));

// 获取Acfun弹幕模块配置
router.get('/acfunDanmu/getConfig', errorHandler(async (req: Request, res: Response) => {
  const config = acfunDanmuModule.getConfig();
  res.json<ApiResponse<Record<string, any>>>({
    success: true,
    data: config
  });
}));

// 获取Acfun弹幕模块状态
router.get('/acfunDanmu/getStatus', errorHandler(async (req: Request, res: Response) => {
  const status = acfunDanmuModule.getStatus();
  res.json<ApiResponse<Record<string, any>>>({
    success: true,
    data: status
  });
}));

// 获取Acfun弹幕模块日志验证函数
const validateGetLogs = (req: Request): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (req.query.limit !== undefined && (isNaN(Number(req.query.limit)) || Number(req.query.limit) < 1)) {
    errors.push({ field: 'limit', message: 'limit must be a positive number' });
  }
  return errors;
};

// 获取Acfun弹幕模块日志
router.get('/acfunDanmu/getLogs', validateRequest([validateGetLogs]), errorHandler(async (req: Request, res: Response) => {
  const { limit } = req.query;
  const logManager = getLogManager();
  const logs = logManager.getLogs('acfunDanmu', Number(limit) || 100);
  res.json<ApiResponse<LogEntry[]>>({
    success: true,
    data: logs
  });
}));

// ====== 房管相关HTTP接口 ======
// 获取房管列表验证函数
const validateGetManagerList = (req: Request): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!req.query.uid) {
    errors.push({ field: 'uid', message: 'uid is required' });
  } else if (isNaN(Number(req.query.uid))) {
    errors.push({ field: 'uid', message: 'uid must be a number' });
  }
  if (req.query.page !== undefined && (isNaN(Number(req.query.page)) || Number(req.query.page) < 1)) {
    errors.push({ field: 'page', message: 'page must be a positive number' });
  }
  if (req.query.pageSize !== undefined && (isNaN(Number(req.query.pageSize)) || Number(req.query.pageSize) < 1 || Number(req.query.pageSize) > 100)) {
    errors.push({ field: 'pageSize', message: 'pageSize must be between 1 and 100' });
  }
  return errors;
};

// 获取房管列表
router.get('/acfunDanmu/manager/list', validateRequest([validateGetManagerList]), errorHandler(async (req: Request, res: Response) => {
  const { uid, page = 1, pageSize = 20 } = req.query;
  const result = await acfunDanmuModule.getManagerList(Number(uid), Number(page), Number(pageSize));
  res.json<ApiResponse<Record<string, any>>>({
    success: true,
    data: result
  });
});

// 添加房管验证函数
const validateAddManager = (req: Request): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!req.body.uid) {
    errors.push({ field: 'uid', message: 'uid is required' });
  } else if (isNaN(Number(req.body.uid))) {
    errors.push({ field: 'uid', message: 'uid must be a number' });
  }
  if (!req.body.targetId) {
    errors.push({ field: 'targetId', message: 'targetId is required' });
  } else if (isNaN(Number(req.body.targetId))) {
    errors.push({ field: 'targetId', message: 'targetId must be a number' });
  }
  return errors;
};

// 添加房管
router.post('/acfunDanmu/manager/add', validateRequest([validateAddManager]), errorHandler(async (req: Request, res: Response) => {
  const { uid, targetId } = req.body;
  const result = await acfunDanmuModule.addManager(Number(uid), Number(targetId));
  res.json<ApiResponse<Record<string, any>>>({
    success: true,
    data: result
  });
}));

// 删除房管验证函数
const validateRemoveManager = (req: Request): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!req.body.uid) {
    errors.push({ field: 'uid', message: 'uid is required' });
  } else if (isNaN(Number(req.body.uid))) {
    errors.push({ field: 'uid', message: 'uid must be a number' });
  }
  if (!req.body.targetId) {
    errors.push({ field: 'targetId', message: 'targetId is required' });
  } else if (isNaN(Number(req.body.targetId))) {
    errors.push({ field: 'targetId', message: 'targetId must be a number' });
  }
  return errors;
};

// 删除房管
router.post('/acfunDanmu/manager/remove', validateRequest([validateRemoveManager]), errorHandler(async (req: Request, res: Response) => {
  const { uid, targetId } = req.body;
  const result = await acfunDanmuModule.removeManager(Number(uid), Number(targetId));
  res.json<ApiResponse<Record<string, any>>>({
    success: true,
    data: result
  });
});

// 获取踢人记录验证函数
const validateGetKickRecord = (req: Request): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!req.query.uid) {
    errors.push({ field: 'uid', message: 'uid is required' });
  } else if (isNaN(Number(req.query.uid))) {
    errors.push({ field: 'uid', message: 'uid must be a number' });
  }
  if (req.query.page !== undefined && (isNaN(Number(req.query.page)) || Number(req.query.page) < 1)) {
    errors.push({ field: 'page', message: 'page must be a positive number' });
  }
  if (req.query.pageSize !== undefined && (isNaN(Number(req.query.pageSize)) || Number(req.query.pageSize) < 1 || Number(req.query.pageSize) > 100)) {
    errors.push({ field: 'pageSize', message: 'pageSize must be between 1 and 100' });
  }
  return errors;
};

// 获取踢人记录
router.get('/acfunDanmu/manager/kickRecord', validateRequest([validateGetKickRecord]), errorHandler(async (req: Request, res: Response) => {
  const { uid, page = 1, pageSize = 20 } = req.query;
  const result = await acfunDanmuModule.getKickRecord(Number(uid), Number(page), Number(pageSize));
  res.json<ApiResponse<Record<string, any>>>({
    success: true,
    data: result
  });
});

// 房管踢人验证函数
const validateKickUser = (req: Request): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!req.body.uid) {
    errors.push({ field: 'uid', message: 'uid is required' });
  } else if (isNaN(Number(req.body.uid))) {
    errors.push({ field: 'uid', message: 'uid must be a number' });
  }
  if (!req.body.targetId) {
    errors.push({ field: 'targetId', message: 'targetId is required' });
  } else if (isNaN(Number(req.body.targetId))) {
    errors.push({ field: 'targetId', message: 'targetId must be a number' });
  }
  if (req.body.duration !== undefined && (isNaN(Number(req.body.duration)) || Number(req.body.duration) < 60 || Number(req.body.duration) > 86400)) {
    errors.push({ field: 'duration', message: 'duration must be between 60 and 86400 seconds' });
  }
  return errors;
};

// 房管踢人
router.post('/acfunDanmu/manager/kickUser', validateRequest([validateKickUser]), errorHandler(async (req: Request, res: Response) => {
  const { uid, targetId, reason = '', duration = 3600 } = req.body;
  // 注意：根据acfundanmu.js中的定义，managerKickUser只接受3个参数
  // 这里假设targetId是liveID，duration参数可能不需要或需要调整
  const result = await acfunDanmuModule.managerKickUser(Number(uid), Number(targetId), reason);
  res.json<ApiResponse<Record<string, any>>>({
    success: true,
    data: result
  });
}));

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