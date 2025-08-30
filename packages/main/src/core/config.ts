/**
 * 默认应用配置
 * 此文件由系统自动生成，用于提供基础配置模板
 */
const defaultConfig = {
  // 应用基本信息
  appName: 'AcfunLiveToolbox',
  appVersion: '2.0.0',
  copyright: 'Copyright © 2023 AcfunLiveToolbox',

  // 窗口配置
  windowSize: {
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600
  },
  windowPosition: 'center',
  resizable: true,
  maximizable: true,

  // 通知配置
  notificationSettings: {
    enabled: true,
    sound: true,
    showToast: true,
    toastDuration: 5000,
    categories: {
      liveStatus: true,
      danmuHighlight: true,
      giftAlert: true,
      systemUpdate: true,
      reminder: true
    }
  },
  globalNotificationEnabled: true,

  // 网络配置
  network: {
    requestTimeout: 10000,
    retryCount: 3,
    proxyEnabled: false,
    proxyServer: ''
  },

  // 数据存储配置
  storage: {
    maxDanmuHistory: 10000,
    autoCleanup: true,
    cleanupInterval: '7d'
  },

  // 外观配置
  appearance: {
    theme: 'light',
    fontSize: 14,
    compactMode: false,
    language: 'zh-CN'
  },

  // 新增：RTMP配置
  rtmpConfigs: {},
  // 新增：黑名单配置
  blacklist: [],
  // 新增：直播设置
  liveSettings: {
    defaultQuality: '720p',
    autoRecord: false,
    showGiftEffects: true
  },
  // 新增：录制配置
  recordingSettings: {
    savePath: '',
    format: 'mp4',
    quality: 'medium'
  },
  // 新增：自动更新设置
  autoUpdate: {
    enabled: true,
    checkInterval: 86400000,
    ignoreVersions: []
  },

  // 开发者选项
  developer: {
    debugMode: false,
    logLevel: 'info',
    enablePerformanceMonitor: false
  }
};

export default defaultConfig;