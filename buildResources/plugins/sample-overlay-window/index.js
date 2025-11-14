/**
 * Window插件事件和生命周期处理模板 - 详细数据说明版
 * 
 * 此文件展示了window插件可以接收的所有事件和生命周期钩子
 * 每个函数都详细说明了ctx对象中包含的数据字段
 */

// ===== 插件基础功能 =====

/**
 * 插件初始化
 * @returns {Object} 返回初始化结果 { ok: boolean, message?: string }
 */
function init() {
  return { ok: true, message: '插件初始化成功' };
}

/**
 * 插件清理
 * @returns {Object} 返回清理结果 { ok: boolean }
 */
function cleanup() {
  return { ok: true };
}

/**
 * 处理来自主进程的消息
 * @param {string} type - 消息类型
 * @param {any} payload - 消息负载
 * @returns {Object} 返回处理结果
 */
async function handleMessage(type, payload) {
  return { ok: true, type, payload };
}

// ===== 直播事件处理 =====

/**
 * 直播开始事件
 * @param {Object} ctx - 事件上下文，包含以下字段：
 * @param {string} ctx.roomId - 房间ID (例如: "123456")
 * @param {string} ctx.streamerName - 主播名称 (例如: "主播小明")
 * @param {string} ctx.liveTitle - 直播标题 (例如: "今晚一起玩游戏")
 * @param {number} ctx.timestamp - 事件时间戳 (毫秒时间戳)
 * @param {Object} ctx.extra - 额外信息对象，可能包含直播分类、标签等
 * @param {string} ctx.source - 事件来源 (例如: "acfun")
 * @param {Object} ctx.raw - 原始事件数据（经过清理的原始数据）
 */
async function onLiveStart(ctx = {}) {
  console.log('[plugin] 直播开始:', {
    roomId: ctx.roomId,
    streamer: ctx.streamerName,
    title: ctx.liveTitle,
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 直播结束事件
 * @param {Object} ctx - 事件上下文，包含以下字段：
 * @param {string} ctx.roomId - 房间ID
 * @param {number} ctx.duration - 直播时长（秒）(例如: 3600 表示1小时)
 * @param {number} ctx.timestamp - 事件时间戳
 * @param {string} ctx.reason - 结束原因（可选，如"user_action", "network_error"）
 * @param {string} ctx.source - 事件来源
 */
async function onLiveStop(ctx = {}) {
  console.log('[plugin] 直播结束:', {
    roomId: ctx.roomId,
    duration: ctx.duration,
    durationFormatted: `${Math.floor(ctx.duration / 60)}分${ctx.duration % 60}秒`,
    reason: ctx.reason
  });
  return { ok: true };
}

/**
 * 弹幕接收事件
 * @param {Object} ctx - 弹幕上下文，包含以下字段：
 * @param {string} ctx.id - 弹幕ID (唯一标识符)
 * @param {string} ctx.roomId - 房间ID
 * @param {string} ctx.userId - 用户ID (发送者的用户ID)
 * @param {string} ctx.userName - 用户名称 (发送者的昵称)
 * @param {string} ctx.content - 弹幕内容 (例如: "主播好棒！")
 * @param {number} ctx.timestamp - 发送时间戳
 * @param {string} ctx.userBadge - 用户徽章 (可选，如"房管", "主播"等)
 * @param {number} ctx.userLevel - 用户等级 (数字，如1-60)
 * @param {Object} ctx.medal - 粉丝牌信息 {name: string, level: number}
 * @param {string} ctx.source - 事件来源
 * @param {Object} ctx.raw - 原始事件数据
 */
async function onDanmuReceived(ctx = {}) {
  console.log('[plugin] 收到弹幕:', {
    content: ctx.content,
    user: ctx.userName,
    level: ctx.userLevel,
    badge: ctx.userBadge,
    medal: ctx.medal,
    time: new Date(ctx.timestamp).toLocaleTimeString()
  });
  return { ok: true };
}

/**
 * 礼物接收事件
 * @param {Object} ctx - 礼物上下文，包含以下字段：
 * @param {string} ctx.id - 礼物ID (唯一标识符)
 * @param {string} ctx.roomId - 房间ID
 * @param {string} ctx.userId - 赠送用户ID
 * @param {string} ctx.userName - 赠送用户名称
 * @param {string} ctx.giftId - 礼物ID (礼物类型标识)
 * @param {string} ctx.giftName - 礼物名称 (例如: "棒棒糖", "火箭")
 * @param {number} ctx.giftCount - 礼物数量 (连续赠送的数量)
 * @param {number} ctx.giftValue - 礼物价值（元，人民币）
 * @param {number} ctx.price - 单个礼物价格（元）
 * @param {number} ctx.combo - 连击数 (连续赠送的连击次数)
 * @param {number} ctx.timestamp - 赠送时间戳
 * @param {string} ctx.userLevel - 赠送者等级
 * @param {string} ctx.source - 事件来源
 * @param {Object} ctx.raw - 原始事件数据
 */
async function onGiftReceived(ctx = {}) {
  console.log('[plugin] 收到礼物:', {
    gift: ctx.giftName,
    count: ctx.giftCount,
    value: ctx.giftValue,
    from: ctx.userName,
    combo: ctx.combo ? `连击x${ctx.combo}` : '',
    time: new Date(ctx.timestamp).toLocaleTimeString()
  });
  return { ok: true };
}

/**
 * 点赞接收事件
 * @param {Object} ctx - 点赞上下文，包含以下字段：
 * @param {string} ctx.id - 点赞ID (唯一标识符)
 * @param {string} ctx.roomId - 房间ID
 * @param {string} ctx.userId - 用户ID
 * @param {string} ctx.userName - 用户名称
 * @param {number} ctx.count - 点赞数量 (一次点赞操作的数量，通常为1)
 * @param {number} ctx.timestamp - 时间戳
 * @param {string} ctx.userLevel - 用户等级
 * @param {string} ctx.source - 事件来源
 * @param {Object} ctx.raw - 原始事件数据
 */
async function onLikeReceived(ctx = {}) {
  console.log('[plugin] 收到点赞:', {
    count: ctx.count,
    from: ctx.userName,
    level: ctx.userLevel,
    time: new Date(ctx.timestamp).toLocaleTimeString()
  });
  return { ok: true };
}

/**
 * 观众进入房间事件
 * @param {Object} ctx - 进入上下文，包含以下字段：
 * @param {string} ctx.userId - 用户ID
 * @param {string} ctx.userName - 用户名称
 * @param {string} ctx.roomId - 房间ID
 * @param {number} ctx.timestamp - 进入时间戳
 * @param {boolean} ctx.isNewUser - 是否新用户 (首次进入该房间)
 * @param {string} ctx.userLevel - 用户等级
 * @param {string} ctx.userBadge - 用户徽章
 * @param {Object} ctx.medal - 粉丝牌信息
 * @param {string} ctx.source - 事件来源
 * @param {Object} ctx.raw - 原始事件数据
 */
async function onAudienceEnter(ctx = {}) {
  console.log('[plugin] 观众进入:', {
    user: ctx.userName,
    isNew: ctx.isNewUser ? '[新用户]' : '',
    level: ctx.userLevel,
    badge: ctx.userBadge,
    time: new Date(ctx.timestamp).toLocaleTimeString()
  });
  return { ok: true };
}

/**
 * 关注事件
 * @param {Object} ctx - 关注上下文，包含以下字段：
 * @param {string} ctx.followerId - 关注者ID
 * @param {string} ctx.followerName - 关注者名称
 * @param {string} ctx.streamerId - 主播ID
 * @param {string} ctx.streamerName - 主播名称
 * @param {number} ctx.timestamp - 关注时间戳
 * @param {boolean} ctx.isFirstFollow - 是否首次关注
 * @param {string} ctx.source - 事件来源
 * @param {Object} ctx.raw - 原始事件数据
 */
async function onFollow(ctx = {}) {
  console.log('[plugin] 新关注:', {
    follower: ctx.followerName,
    streamer: ctx.streamerName,
    isFirst: ctx.isFirstFollow ? '[首次关注]' : '',
    time: new Date(ctx.timestamp).toLocaleTimeString()
  });
  return { ok: true };
}

/**
 * 分享直播事件
 * @param {Object} ctx - 分享上下文，包含以下字段：
 * @param {string} ctx.shareId - 分享ID (唯一标识符)
 * @param {string} ctx.userId - 分享用户ID
 * @param {string} ctx.userName - 分享用户名称
 * @param {string} ctx.platform - 分享平台 (如"wechat", "weibo", "qq")
 * @param {number} ctx.timestamp - 分享时间戳
 * @param {string} ctx.roomId - 被分享的房间ID
 * @param {string} ctx.shareUrl - 分享链接
 * @param {string} ctx.source - 事件来源
 * @param {Object} ctx.raw - 原始事件数据
 */
async function onShareLive(ctx = {}) {
  console.log('[plugin] 直播被分享:', {
    user: ctx.userName,
    platform: ctx.platform,
    roomId: ctx.roomId,
    time: new Date(ctx.timestamp).toLocaleTimeString()
  });
  return { ok: true };
}

// ===== 用户认证事件 =====

/**
 * 用户登录事件
 * @param {Object} ctx - 登录上下文，包含以下字段：
 * @param {string} ctx.userId - 用户ID
 * @param {string} ctx.userName - 用户名称
 * @param {string} ctx.token - 登录令牌 (JWT令牌，敏感信息)
 * @param {number} ctx.timestamp - 登录时间戳
 * @param {string} ctx.loginType - 登录方式 (如"password", "sms", "oauth")
 * @param {string} ctx.ip - 登录IP地址
 * @param {string} ctx.userAgent - 用户代理字符串
 * @param {Object} ctx.userInfo - 用户信息对象
 * @param {number} ctx.expiresIn - 令牌有效期（秒）
 * @param {string} ctx.source - 事件来源
 */
async function onUserLogin(ctx = {}) {
  console.log('[plugin] 用户登录:', {
    user: ctx.userName,
    loginType: ctx.loginType,
    ip: ctx.ip,
    expiresIn: ctx.expiresIn,
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 用户登出事件
 * @param {Object} ctx - 登出上下文，包含以下字段：
 * @param {string} ctx.userId - 用户ID
 * @param {string} ctx.userName - 用户名称
 * @param {number} ctx.timestamp - 登出时间戳
 * @param {string} ctx.reason - 登出原因 (如"user_action", "token_expire", "system_logout")
 * @param {number} ctx.loginDuration - 登录时长（秒）
 * @param {string} ctx.ip - 登出IP地址
 * @param {string} ctx.source - 事件来源
 */
async function onUserLogout(ctx = {}) {
  console.log('[plugin] 用户登出:', {
    user: ctx.userName,
    reason: ctx.reason,
    duration: ctx.loginDuration ? `${Math.floor(ctx.loginDuration / 60)}分钟` : '',
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

// ===== 房间管理事件 =====

/**
 * 房间添加事件
 * @param {Object} ctx - 房间上下文，包含以下字段：
 * @param {string} ctx.roomId - 房间ID
 * @param {string} ctx.streamerName - 主播名称
 * @param {string} ctx.roomTitle - 房间标题
 * @param {number} ctx.timestamp - 添加时间戳
 * @param {string} ctx.streamerId - 主播用户ID
 * @param {number} ctx.viewerCount - 当前观众数量
 * @param {string} ctx.category - 直播分类 (如"游戏", "娱乐", "教育")
 * @param {string[]} ctx.tags - 直播标签数组
 * @param {string} ctx.coverImage - 封面图片URL
 * @param {string} ctx.source - 事件来源
 */
async function onRoomAdded(ctx = {}) {
  console.log('[plugin] 房间添加:', {
    roomId: ctx.roomId,
    streamer: ctx.streamerName,
    title: ctx.roomTitle,
    category: ctx.category,
    viewers: ctx.viewerCount,
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 房间移除事件
 * @param {Object} ctx - 房间上下文，包含以下字段：
 * @param {string} ctx.roomId - 房间ID
 * @param {string} ctx.reason - 移除原因 (如"user_action", "stream_end", "error")
 * @param {number} ctx.timestamp - 移除时间戳
 * @param {string} ctx.streamerName - 主播名称
 * @param {number} ctx.duration - 房间存在时长（秒）
 * @param {string} ctx.source - 事件来源
 */
async function onRoomRemoved(ctx = {}) {
  console.log('[plugin] 房间移除:', {
    roomId: ctx.roomId,
    streamer: ctx.streamerName,
    reason: ctx.reason,
    duration: ctx.duration ? `${Math.floor(ctx.duration / 60)}分钟` : '',
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 房间状态变化事件
 * @param {Object} ctx - 状态上下文，包含以下字段：
 * @param {string} ctx.roomId - 房间ID
 * @param {string} ctx.oldStatus - 旧状态 (connecting, connected, disconnected, error, closed)
 * @param {string} ctx.newStatus - 新状态 (同上)
 * @param {number} ctx.timestamp - 变化时间戳
 * @param {string} ctx.reason - 状态变化原因
 * @param {number} ctx.retryInMs - 重试等待时间（毫秒，如果适用）
 * @param {string} ctx.streamerName - 主播名称
 * @param {string} ctx.source - 事件来源
 */
async function onRoomStatusChange(ctx = {}) {
  console.log('[plugin] 房间状态变化:', {
    roomId: ctx.roomId,
    streamer: ctx.streamerName,
    change: `${ctx.oldStatus} -> ${ctx.newStatus}`,
    reason: ctx.reason,
    retry: ctx.retryInMs ? `${ctx.retryInMs}ms后重试` : '',
    time: new Date(ctx.timestamp).toLocaleTimeString()
  });
  return { ok: true };
}

// ===== 插件生命周期事件 =====

/**
 * 插件即将启用
 * @param {Object} ctx - 生命周期上下文，包含以下字段：
 * @param {string} ctx.pluginId - 插件ID
 * @param {Object} ctx.manifest - 插件清单 (包含插件配置信息)
 * @param {number} ctx.timestamp - 时间戳
 * @param {string} ctx.pluginPath - 插件路径
 * @param {Object} ctx.config - 插件配置对象
 * @param {string} ctx.version - 插件版本
 */
async function onBeforeEnable(ctx = {}) {
  console.log('[plugin] 即将启用:', {
    pluginId: ctx.pluginId,
    version: ctx.version,
    path: ctx.pluginPath,
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 插件已启用
 * @param {Object} ctx - 生命周期上下文，包含以下字段：
 * @param {string} ctx.pluginId - 插件ID
 * @param {number} ctx.timestamp - 时间戳
 * @param {number} ctx.enableTime - 启用耗时（毫秒）
 * @param {Object} ctx.api - 提供的API对象
 * @param {string} ctx.version - 插件版本
 */
async function onAfterEnable(ctx = {}) {
  console.log('[plugin] 已启用:', {
    pluginId: ctx.pluginId,
    version: ctx.version,
    enableTime: ctx.enableTime ? `${ctx.enableTime}ms` : '',
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 插件即将禁用
 * @param {Object} ctx - 生命周期上下文，包含以下字段：
 * @param {string} ctx.pluginId - 插件ID
 * @param {number} ctx.timestamp - 时间戳
 * @param {string} ctx.reason - 禁用原因
 * @param {number} ctx.runTime - 运行时长（毫秒）
 */
async function onBeforeDisable(ctx = {}) {
  console.log('[plugin] 即将禁用:', {
    pluginId: ctx.pluginId,
    reason: ctx.reason,
    runTime: ctx.runTime ? `${Math.floor(ctx.runTime / 1000)}秒` : '',
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 插件已禁用
 * @param {Object} ctx - 生命周期上下文，包含以下字段：
 * @param {string} ctx.pluginId - 插件ID
 * @param {number} ctx.timestamp - 时间戳
 * @param {string} ctx.reason - 禁用原因
 */
async function onAfterDisable(ctx = {}) {
  console.log('[plugin] 已禁用:', {
    pluginId: ctx.pluginId,
    reason: ctx.reason,
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * UI页面即将打开
 * @param {Object} ctx - 页面上下文，包含以下字段：
 * @param {string} ctx.pluginId - 插件ID
 * @param {string} ctx.pageType - 页面类型 (ui/window/overlay)
 * @param {string} ctx.pageId - 页面ID
 * @param {number} ctx.timestamp - 时间戳
 * @param {Object} ctx.pageOptions - 页面选项 (尺寸、位置等)
 * @param {string} ctx.url - 页面URL
 */
async function onBeforeUiOpen(ctx = {}) {
  console.log('[plugin] UI即将打开:', {
    pluginId: ctx.pluginId,
    pageType: ctx.pageType,
    pageId: ctx.pageId,
    url: ctx.url,
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * UI页面已打开
 * @param {Object} ctx - 页面上下文，包含以下字段：
 * @param {string} ctx.pluginId - 插件ID
 * @param {string} ctx.pageType - 页面类型
 * @param {string} ctx.pageId - 页面ID
 * @param {number} ctx.timestamp - 时间戳
 * @param {number} ctx.loadTime - 页面加载耗时（毫秒）
 * @param {Object} ctx.window - 窗口对象引用
 */
async function onAfterUiOpen(ctx = {}) {
  console.log('[plugin] UI已打开:', {
    pluginId: ctx.pluginId,
    pageType: ctx.pageType,
    pageId: ctx.pageId,
    loadTime: ctx.loadTime ? `${ctx.loadTime}ms` : '',
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * UI页面已关闭
 * @param {Object} ctx - 页面上下文，包含以下字段：
 * @param {string} ctx.pluginId - 插件ID
 * @param {string} ctx.pageType - 页面类型
 * @param {string} ctx.pageId - 页面ID
 * @param {string} ctx.reason - 关闭原因 (如"user_close", "system_close", "error")
 * @param {number} ctx.timestamp - 时间戳
 * @param {number} ctx.openTime - 页面打开时长（毫秒）
 */
async function onUiClosed(ctx = {}) {
  console.log('[plugin] UI已关闭:', {
    pluginId: ctx.pluginId,
    pageType: ctx.pageType,
    pageId: ctx.pageId,
    reason: ctx.reason,
    openTime: ctx.openTime ? `${Math.floor(ctx.openTime / 1000)}秒` : '',
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

// ===== 系统事件 =====

/**
 * SSE连接已建立
 * @param {Object} ctx - 连接上下文，包含以下字段：
 * @param {string} ctx.endpoint - 连接端点 (如"/api/events")
 * @param {number} ctx.timestamp - 连接时间戳
 * @param {string} ctx.connectionId - 连接ID
 * @param {Object} ctx.headers - 连接头信息
 * @param {number} ctx.retryCount - 重试次数
 */
async function onSseConnected(ctx = {}) {
  console.log('[plugin] SSE已连接:', {
    endpoint: ctx.endpoint,
    connectionId: ctx.connectionId,
    retryCount: ctx.retryCount,
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * SSE连接已断开
 * @param {Object} ctx - 断开上下文，包含以下字段：
 * @param {string} ctx.endpoint - 原连接端点
 * @param {string} ctx.reason - 断开原因 (如"network_error", "timeout", "server_close")
 * @param {number} ctx.timestamp - 断开时间戳
 * @param {string} ctx.connectionId - 连接ID
 * @param {number} ctx.duration - 连接时长（毫秒）
 * @param {boolean} ctx.willReconnect - 是否会自动重连
 */
async function onSseDisconnected(ctx = {}) {
  console.log('[plugin] SSE已断开:', {
    endpoint: ctx.endpoint,
    reason: ctx.reason,
    duration: ctx.duration ? `${Math.floor(ctx.duration / 1000)}秒` : '',
    willReconnect: ctx.willReconnect ? '将重连' : '不重连',
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 配置更新事件
 * @param {Object} ctx - 配置上下文，包含以下字段：
 * @param {Object} ctx.oldConfig - 旧配置对象
 * @param {Object} ctx.newConfig - 新配置对象
 * @param {number} ctx.timestamp - 更新时间戳
 * @param {string} ctx.configVersion - 配置版本号
 * @param {string[]} ctx.changedKeys - 变更的配置键数组
 */
async function onConfigUpdated(ctx = {}) {
  console.log('[plugin] 配置已更新:', {
    changedKeys: ctx.changedKeys,
    configVersion: ctx.configVersion,
    changeCount: ctx.changedKeys ? ctx.changedKeys.length : 0,
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 错误处理事件
 * @param {Object} ctx - 错误上下文，包含以下字段：
 * @param {string} ctx.errorType - 错误类型 (如"runtime_error", "api_error", "validation_error")
 * @param {string} ctx.errorMessage - 错误消息
 * @param {Object} ctx.errorStack - 错误堆栈信息
 * @param {number} ctx.timestamp - 错误时间戳
 * @param {string} ctx.pluginId - 发生错误的插件ID
 * @param {string} ctx.context - 错误发生上下文
 * @param {boolean} ctx.isRecoverable - 是否可恢复
 */
async function onError(ctx = {}) {
  console.error('[plugin] 发生错误:', {
    type: ctx.errorType,
    message: ctx.errorMessage,
    pluginId: ctx.pluginId,
    context: ctx.context,
    recoverable: ctx.isRecoverable ? '可恢复' : '不可恢复',
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

/**
 * 警告事件
 * @param {Object} ctx - 警告上下文，包含以下字段：
 * @param {string} ctx.warningType - 警告类型 (如"performance_warning", "deprecated_api", "rate_limit")
 * @param {string} ctx.warningMessage - 警告消息
 * @param {number} ctx.timestamp - 警告时间戳
 * @param {string} ctx.pluginId - 相关插件ID
 * @param {Object} ctx.metrics - 相关性能指标
 */
async function onWarning(ctx = {}) {
  console.warn('[plugin] 发生警告:', {
    type: ctx.warningType,
    message: ctx.warningMessage,
    pluginId: ctx.pluginId,
    metrics: ctx.metrics,
    time: new Date(ctx.timestamp).toLocaleString()
  });
  return { ok: true };
}

// ===== 插件导出 =====

export default {
  // 基础功能
  init,
  cleanup,
  handleMessage,
  
  // 直播事件
  onLiveStart,
  onLiveStop,
  onDanmuReceived,
  onGiftReceived,
  onLikeReceived,
  onAudienceEnter,
  onFollow,
  onShareLive,
  
  // 用户认证事件
  onUserLogin,
  onUserLogout,
  
  // 房间管理事件
  onRoomAdded,
  onRoomRemoved,
  onRoomStatusChange,
  
  // 插件生命周期事件
  onBeforeEnable,
  onAfterEnable,
  onBeforeDisable,
  onAfterDisable,
  onBeforeUiOpen,
  onAfterUiOpen,
  onUiClosed,
  
  // 系统事件
  onSseConnected,
  onSseDisconnected,
  onConfigUpdated,
  onError,
  onWarning
};