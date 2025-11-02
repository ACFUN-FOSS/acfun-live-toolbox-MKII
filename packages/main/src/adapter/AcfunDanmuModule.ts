import type { AppModule } from '../AppModule';
import { ModuleContext } from '../ModuleContext';
import { getLogManager } from '../logging/LogManager';
import { AcFunLiveApi } from 'acfunlive-http-api';
import { connectionPool, PooledConnection } from './ConnectionPoolManager';
import { performanceMonitor } from './PerformanceMonitor';
import { AuthManager } from '../services/AuthManager';

// 定义配置接口
interface DanmuSendResponse {
  success: boolean;
  message?: string;
  danmuId?: string;
}

interface LiveStatusResponse {
  liveId: number;
  status: 'online' | 'offline' | 'reconnecting';
  title?: string;
  viewerCount?: number;
  startTime?: Date;
}

interface AcfunDanmuConfig {
  debug: boolean;
  logLevel: 'info' | 'debug' | 'error';
  timeout: number;
  retries: number;
}

// 默认配置
const DEFAULT_CONFIG: AcfunDanmuConfig = {
  debug: false,
  logLevel: 'info',
  timeout: 30000,
  retries: 3
};

export class AcfunDanmuModule implements AppModule {
  private pooledConnection: PooledConnection | null = null;
  private config: AcfunDanmuConfig;
  private logCallback: ((message: string, type: 'info' | 'error') => void) | null = null;
  private logManager: ReturnType<typeof getLogManager>;
  private isInitialized: boolean = false;
  private authManager: AuthManager;

  constructor(config: Partial<AcfunDanmuConfig> = {}, authManager?: AuthManager) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logManager = getLogManager();
    this.authManager = authManager || new AuthManager();
  }

  // 设置日志回调函数
  setLogCallback(callback: (message: string, type: 'info' | 'error') => void): void {
    this.logCallback = callback;
  }

  // 获取当前状态
  getStatus(): { running: boolean, initialized: boolean } {    
    return { 
      running: this.isInitialized, 
      initialized: this.isInitialized 
    };
  }

  // 获取当前配置
  getConfig(): AcfunDanmuConfig {
    return { ...this.config };
  }

  // 更新配置
  updateConfig(config: Partial<AcfunDanmuConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 如果有活跃连接，释放并重新获取以应用新配置
    if (this.pooledConnection) {
      connectionPool.release(this.pooledConnection.id);
      this.pooledConnection = null;
    }
    
    this.log('Configuration updated', 'info');
  }

  // 初始化模块
  async initialize(): Promise<void> {
    try {
      this.log('Initializing AcfunDanmuModule...', 'info');
      
      // 启动性能监控
      performanceMonitor.start();
      
      // 设置性能监控事件监听器
      performanceMonitor.on('alert', (alert) => {
        this.log(`Performance alert: ${alert.type} - ${alert.message}`, 'error');
      });
      
      performanceMonitor.on('error', (error) => {
        this.log(`Performance monitor error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      });
      
      // 这里可以添加初始化逻辑，比如验证API连接等
      this.isInitialized = true;
      
      this.log('AcfunDanmuModule initialized successfully', 'info');
    } catch (error) {
      this.log(`Failed to initialize AcfunDanmuModule: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  // 销毁模块
  async destroy(): Promise<void> {
    try {
      this.log('Destroying AcfunDanmuModule...', 'info');
      
      // 停止性能监控
      performanceMonitor.stop();
      
      if (this.pooledConnection) {
        connectionPool.destroy(this.pooledConnection.id);
        this.pooledConnection = null;
      }
      
      this.isInitialized = false;
      this.log('AcfunDanmuModule destroyed successfully', 'info');
    } catch (error) {
      this.log(`Error destroying AcfunDanmuModule: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  // 实现AppModule接口
  async enable({ app }: ModuleContext): Promise<void> {
    // 设置日志回调
    this.setLogCallback((message: string, type: 'info' | 'error') => {
      this.logManager.addLog('acfunDanmu', message, type as any);
    });

    // 延迟初始化，确保应用已就绪
    app.on('ready', () => {
      setTimeout(() => {
        this.initialize().catch(error => {
          this.log(`Failed to initialize on app ready: ${error instanceof Error ? error.message : String(error)}`, 'error');
        });
      }, 1000);
    });

    // 主进程退出时销毁模块
    app.on('will-quit', () => {
      this.destroy().catch(error => {
        console.error('Error destroying AcfunDanmuModule on quit:', error);
      });
    });
  }

  // 房管相关方法
  async getManagerList(uid: number, page: number = 1, pageSize: number = 20): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.manager.getManagerList();
    }, 'getManagerList');
  }

  async addManager(uid: number, targetId: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.manager.addManager(targetId);
    }, 'addManager');
  }

  async removeManager(uid: number, targetId: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.manager.deleteManager(targetId);
    }, 'removeManager');
  }

  async getKickRecord(uid: number, page: number = 1, pageSize: number = 20): Promise<any> {
    // 需要 liveId 参数，这里暂时抛出错误
    throw new Error('getKickRecord requires liveId parameter - use getAuthorKickRecords instead');
  }

  async managerKickUser(uid: number, targetId: number, reason: string = '', duration: number = 3600): Promise<any> {
    // 需要 liveId 参数，这里暂时抛出错误
    throw new Error('managerKickUser requires liveId parameter - use managerKick instead');
  }

  async authorKickUser(uid: number, targetId: number, reason: string = '', duration: number = 3600): Promise<any> {
    // 需要 liveId 参数，这里暂时抛出错误
    throw new Error('authorKickUser requires liveId parameter - use authorKick instead');
  }

  // 勋章相关方法
  async getMedalDetail(uid: number, medalId: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.badge.getBadgeDetail(uid);
    }, 'getMedalDetail');
  }

  async getMedalList(uid: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.badge.getBadgeList();
    }, 'getMedalList');
  }

  async getMedalRank(uid: number, medalId: number, rankType: number = 1): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.badge.getBadgeRank(uid);
    }, 'getMedalRank');
  }

  async getUserWearingMedal(uid: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.badge.getWornBadge(uid);
    }, 'getUserWearingMedal');
  }

  async wearMedal(uid: number, medalId: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.badge.wearBadge(uid);
    }, 'wearMedal');
  }

  async unwearMedal(uid: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.badge.unwearBadge();
    }, 'unwearMedal');
  }

  // 登录相关方法
  async login(account: string, password: string): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.auth.qrLogin();
    }, 'login');
  }

  async loginWithQRCode(): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.auth.checkQrLoginStatus();
    }, 'loginWithQRCode');
  }

  // 观看列表相关方法 - 暂时移除，因为 API 中不存在此方法
  // async getWatchingList(liveID: number): Promise<any> {
  //   return this.callApiMethod(async (api) => {
  //     return api.live.getWatchingList(liveID);
  //   }, 'getWatchingList');
  // }

  // 榜单相关方法 - 暂时移除，因为 API 中不存在此方法
  // async getBillboard(): Promise<any> {
  //   return this.callApiMethod(async (api) => {
  //     return api.live.getBillboard();
  //   }, 'getBillboard');
  // }

  // 摘要相关方法
  async getSummary(liveId: string): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.getSummary(liveId);
    }, 'getSummary');
  }

  // 幸运列表相关方法 - 暂时移除，因为 API 中不存在此方法
  // async getLuckList(): Promise<any> {
  //   return this.callApiMethod(async (api) => {
  //     return api.live.getLuckList();
  //   }, 'getLuckList');
  // }

  // 回放相关方法
  async getPlayback(liveID: string): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.replay.getLiveReplay(liveID);
    }, 'getPlayback');
  }

  // 礼物相关方法
  async getAllGiftList(): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.gift.getAllGiftList();
    }, 'getAllGiftList');
  }

  async getGiftList(liveID: string): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.gift.getLiveGiftList(liveID);
    }, 'getGiftList');
  }

  // 钱包相关方法 - 暂时移除，因为 API 中不存在此方法
  // async getWalletBalance(): Promise<any> {
  //   return this.callApiMethod(async (api) => {
  //     return api.live.getWalletBalance();
  //   }, 'getWalletBalance');
  // }

  // 用户直播信息相关方法
  async getUserLiveInfo(userID: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.getUserLiveInfo(userID);
    }, 'getUserLiveInfo');
  }

  // 直播列表相关方法
  async getAllLiveList(): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.getLiveList();
    }, 'getAllLiveList');
  }

  // 直播数据相关方法
  async getLiveData(days: number = 7): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.getLiveStatisticsByDays(days);
    }, 'getLiveData');
  }

  // 用户信息相关方法
  async getUserInfo(userID: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.getUserDetailInfo(userID);
    }, 'getUserInfo');
  }

  // 图片上传相关方法 - 暂时移除，因为 ImageService 不在 AcFunLiveApi 中
  // async uploadImage(imagePath: string): Promise<any> {
  //   return this.callApiMethod(async (api) => {
  //     return api.image.uploadImage(imagePath);
  //   }, 'uploadImage');
  // }

  // 日程相关方法 - 暂时移除，因为 API 中不存在此方法
  // async getScheduleList(): Promise<any> {
  //   return this.callApiMethod(async (api) => {
  //     return api.live.getScheduleList();
  //   }, 'getScheduleList');
  // }

  // 弹幕发送方法
  async sendDanmu(liveId: number, content: string): Promise<DanmuSendResponse> {
    try {
      const result = await this.callApiMethod(async (api) => {
        return api.danmu.sendComment(liveId.toString(), content);
      }, 'sendDanmu');
      
      return {
        success: true,
        message: 'Danmu sent successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // 获取直播状态 - 使用 getUserLiveInfo 替代
  async getLiveStatus(liveId: number): Promise<LiveStatusResponse> {
    const result = await this.callApiMethod(async (api) => {
      return api.live.getUserLiveInfo(liveId);
    }, 'getLiveStatus');
    
    // 转换为 LiveStatusResponse 格式
    return {
      liveId: result.data?.profile?.userID || liveId,
      status: result.data?.liveID ? 'online' : 'offline',
      title: result.data?.title,
      viewerCount: result.data?.onlineCount,
      startTime: result.data?.liveStartTime ? new Date(result.data.liveStartTime) : undefined
    };
  }

  // 转码信息相关方法 - 需要 streamName 参数
  async getTranscodeInfo(streamName: string = 'default'): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.getTranscodeInfo(streamName);
    }, 'getTranscodeInfo');
  }

  // 开始直播 - 使用 startLiveStream 替代
  async startLive(categoryID: number, title: string, coverUrl: string): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.startLiveStream(title, coverUrl, 'stream', false, false, categoryID, 0);
    }, 'startLive');
  }

  // 停止直播 - 使用 stopLiveStream 替代
  async stopLive(liveId: string): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.stopLiveStream(liveId);
    }, 'stopLive');
  }

  async updateLiveInfo(title: string, coverUrl: string): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.updateLiveRoom(title, coverUrl, ''); // 需要 liveId 参数
    }, 'updateLiveInfo');
  }

  // 剪辑权限相关方法
  async checkCanCut(liveID: number): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.checkLiveClipPermission();
    }, 'checkCanCut');
  }

  async setCanCut(liveID: number, canCut: boolean): Promise<any> {
    return this.callApiMethod(async (api) => {
      return api.live.setLiveClipPermission(canCut);
    }, 'setCanCut');
  }

  // 获取API实例（用于其他模块直接访问）
  async getApiInstance(): Promise<AcFunLiveApi> {
    if (!this.pooledConnection) {
      this.pooledConnection = await connectionPool.acquire('auth');
    }
    return this.pooledConnection.api;
  }

  // 性能监控相关方法
  
  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return performanceMonitor.getLatestMetrics();
  }

  /**
   * 获取性能摘要
   */
  getPerformanceSummary() {
    return performanceMonitor.getPerformanceSummary();
  }

  /**
   * 获取性能指标历史
   */
  getPerformanceHistory(limit?: number) {
    return performanceMonitor.getMetricsHistory(limit);
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats() {
    performanceMonitor.reset();
  }

  /**
   * 检查性能监控状态
   */
  isPerformanceMonitoringActive(): boolean {
    return performanceMonitor.isMonitoring();
  }

  // 私有方法：统一的API调用包装器
  private async callApiMethod<T>(apiCall: (api: AcFunLiveApi) => Promise<T>, methodName: string): Promise<T> {
    // 增加请求计数
    performanceMonitor.incrementRequestCount();
    
    try {
      if (!this.isInitialized) {
        throw new Error('AcfunDanmuModule is not initialized');
      }
      
      // 获取连接池中的API实例
      if (!this.pooledConnection) {
        this.pooledConnection = await connectionPool.acquire('live');
      }
      
      // 确保身份验证
      await this.ensureAuthentication();
      
      this.log(`Calling API method: ${methodName}`, 'debug');
      const result = await apiCall(this.pooledConnection.api);
      this.log(`API method ${methodName} completed successfully`, 'debug');
      return result;
    } catch (error) {
      // 增加错误计数
      performanceMonitor.incrementErrorCount();
      
      const errorMessage = `API method ${methodName} failed: ${error instanceof Error ? error.message : String(error)}`;
      this.log(errorMessage, 'error');
      throw error;
    }
  }

  /**
   * 确保API连接已通过身份验证
   */
  private async ensureAuthentication(): Promise<void> {
    if (!this.pooledConnection) {
      throw new Error('No pooled connection available');
    }

    try {
      // 检查当前是否已认证
      const isAuthenticated = this.pooledConnection.api.isAuthenticated();
      
      if (!isAuthenticated) {
        this.log('No authentication found, attempting to authenticate...', 'info');
        
        // 尝试从 AuthManager 获取令牌信息
        const tokenInfo = await this.authManager.getTokenInfo();
        
        if (tokenInfo && tokenInfo.isValid) {
          // 设置认证令牌 - 传递完整的TokenInfo对象的JSON字符串
          this.pooledConnection.api.setAuthToken(JSON.stringify(tokenInfo));
          this.log('Authentication restored from saved token', 'info');
        } else if (tokenInfo && !tokenInfo.isValid) {
          // 令牌已过期，清除过期令牌
          this.log('Token expired, clearing expired token...', 'info');
          await this.authManager.logout();
          this.log('Token expired and cannot be refreshed automatically, continuing with anonymous access', 'info');
        } else {
          this.log('No valid authentication token available, continuing with anonymous access', 'info');
        }
      } else {
        this.log('Authentication already established', 'debug');
        
        // 检查令牌是否即将过期
        const isExpiringSoon = await this.authManager.isTokenExpiringSoon();
        if (isExpiringSoon) {
          this.log('Token expiring soon, but automatic refresh is not supported. Manual re-login may be required.', 'info');
        }
      }
    } catch (error) {
      this.log(`Authentication check failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      // 不抛出错误，允许匿名访问
    }
  }

  /**
   * 获取 AuthManager 实例
   */
  public getAuthManager(): AuthManager {
    return this.authManager;
  }

  // 私有方法：日志记录
  private log(message: string, type: 'info' | 'error' | 'debug'): void {
    if (this.config.logLevel === 'debug' || type !== 'debug') {
      if (this.logCallback) {
        this.logCallback(message, type === 'debug' ? 'info' : type);
      } else {
        console.log(`[AcfunDanmuModule] ${message}`);
      }
    }
  }
}

// 创建模块工厂函数
export function createAcfunDanmuModule(config: Partial<AcfunDanmuConfig> = {}, authManager?: AuthManager): AppModule {
  return new AcfunDanmuModule(config, authManager);
}

// 创建并导出单例
let instance: AcfunDanmuModule | null = null;

export function getAcfunDanmuModule(authManager?: AuthManager): AcfunDanmuModule {
  if (!instance) {
    instance = new AcfunDanmuModule({}, authManager);
  }
  return instance;
}

export const acfunDanmuModule = getAcfunDanmuModule();