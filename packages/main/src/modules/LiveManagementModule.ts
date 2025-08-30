import { EventEmitter } from 'events';
import { getLogManager } from '../utils/LogManager.js';
import { AppModule } from '../core/AppModule';
import { ModuleContext } from '../core/ModuleContext';
import OBSWebSocket from 'obs-websocket-js';
import fetch from 'node-fetch';

// 直播管理模块配置接口
export interface LiveManagementConfig {
  roomId?: string;
  defaultCoverUrl?: string;
  rtmpServer?: string;
  streamKey?: string;
  obsIp?: string;
  obsPort?: number;
  obsPassword?: string;
}

// 房间信息接口
export interface RoomInfo {
  title: string;
  coverUrl: string;
  allowClip: boolean;
  category: string;
  subCategory: string;
  customDanmuUrl: string;
  officialDanmuUrl: string;
}

// OBS状态
export type OBSStatus = 'online' | 'offline' | 'connecting';

// 推流状态
export type StreamStatus = 'live' | 'waiting' | 'offline';

export class LiveManagementModule extends EventEmitter implements AppModule {
  private config: LiveManagementConfig;
  private logger = getLogManager().getLogger('LiveManagementModule');
  private obsWebSocket = new OBSWebSocket();
  private obsStatus: OBSStatus = 'offline';
  private streamStatus: StreamStatus = 'offline';
  private roomInfo: RoomInfo = {
    title: '未设置标题',
    coverUrl: '',
    allowClip: false,
    category: '',
    subCategory: '',
    customDanmuUrl: '',
    officialDanmuUrl: ''
  };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private maxReconnectDelay = 30000; // 最大重连延迟30秒
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private app: Electron.App | undefined;

  constructor(config: LiveManagementConfig = {}) {
    super();
    this.config = { ...config };
    this.logger.info('LiveManagementModule initialized');

    // 初始化默认配置
    if (!this.config.rtmpServer) {
      this.config.rtmpServer = 'rtmp://push.acfun.cn/live';
    }

    // 模拟初始数据
    this.roomInfo = {
      title: '我的直播间',
      coverUrl: this.config.defaultCoverUrl || '',
      allowClip: false,
      category: 'game',
      subCategory: 'lol',
      customDanmuUrl: 'ws://localhost:8080/danmu',
      officialDanmuUrl: 'wss://danmu.acfun.cn:7000'
    };

    // 模拟推流状态检查
    setInterval(() => {
      this.checkStreamStatus();
    }, 3000);
  }

  /**
   * 更新配置
   * @param config 配置对象
   */
  updateConfig(config: Partial<LiveManagementConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Live management config updated');
  }

  /**
   * 获取配置
   * @returns 配置对象
   */
  getConfig(): LiveManagementConfig {
    return { ...this.config };
  }

  /**
   * 获取房间信息
   * @returns 房间信息
   */
  async getRoomInfo(): Promise<RoomInfo> {
    try {
      // 实际应用中，这里应该调用API获取真实房间信息
      // 更新弹幕流链接
      this.updateDanmuUrls();
      return { ...this.roomInfo };
    } catch (error) {
      this.logger.error('Failed to get room info:', error);
      throw error;
    }
  }

  /**
   * 更新弹幕流链接
   * 实际应用中，这里应该根据房间ID从API获取真实链接
   */
  private updateDanmuUrls(): void {
    // 如果有房间ID，使用房间ID生成链接
    if (this.config.roomId) {
      this.roomInfo.customDanmuUrl = `ws://localhost:8080/danmu?roomId=${this.config.roomId}`;
      this.roomInfo.officialDanmuUrl = `wss://danmu.acfun.cn:7000/stream?id=${this.config.roomId}`;
    } else {
      // 否则使用默认链接
      this.roomInfo.customDanmuUrl = 'ws://localhost:8080/danmu';
      this.roomInfo.officialDanmuUrl = 'wss://danmu.acfun.cn:7000';
    }
    this.logger.info('Danmu URLs updated');
  }

  /**
   * 更新房间信息
   * @param info 房间信息
   * @returns 是否成功
   */
  async updateRoomInfo(info: Partial<RoomInfo>): Promise<boolean> {
    try {
      // 实际应用中，这里应该调用API更新真实房间信息
      // 这里仅更新本地数据
      this.roomInfo = { ...this.roomInfo, ...info };
      this.logger.info('Room info updated');
      return true;
    } catch (error) {
      this.logger.error('Failed to update room info:', error);
      throw error;
    }
  }

  /**
   * 获取推流码
   * @returns 推流码信息
   */
  async getStreamKey(): Promise<{ server: string; key: string }> {
    try {
      // 实际应用中，这里应该调用API获取真实推流码
      // 如果没有推流码，则生成一个模拟的
      if (!this.config.streamKey) {
      this.config.streamKey = await this.fetchStreamKeyFromAPI();
    }
      return {
        server: this.config.rtmpServer || 'rtmp://push.acfun.cn/live',
        key: this.config.streamKey
      };
    } catch (error) {
      this.logger.error('Failed to get stream key:', error);
      throw error;
    }
  }

  /**
   * 刷新推流码
   * @returns 新的推流码信息
   */
  async refreshStreamKey(): Promise<{ server: string; streamKey: string }> {
    try {
      // 实际应用中，这里应该调用API刷新推流码
      this.config.streamKey = await this.fetchStreamKeyFromAPI();
      this.logger.info('Stream key refreshed');
      return {
        server: this.config.rtmpServer || 'rtmp://push.acfun.cn/live',
        key: this.config.streamKey
      };
    } catch (error) {
      this.logger.error('Failed to refresh stream key:', error);
      throw error;
    }
  }

  /**
   * 连接OBS
   * @returns 是否成功
   */
  private async fetchStreamKeyFromAPI(attempt = 0): Promise<string> {
    try {
      if (!this.config.roomId) {
        throw new Error('Room ID is not configured');
      }
      
      // 调用真实API获取推流码
      const response = await fetch(`https://api.acfun.cn/v2/rooms/${this.config.roomId}/stream-key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${global.authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stream key: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.reconnectAttempts = 0; // 重置重试计数器
      return data.streamKey;
    } catch (error) {
      if (attempt < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempt), this.maxReconnectDelay);
        this.logger.warn(`Stream key fetch failed, retrying in ${delay}ms (attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchStreamKeyFromAPI(attempt + 1);
      }
      this.logger.error('Max retries reached for stream key fetch');
      throw error;
    }
  }

  async connectOBS(): Promise<boolean> {
  try {
    this.obsStatus = 'connecting';
    this.logger.info('Connecting to OBS...');

    // 构建OBS WebSocket连接地址
    const address = `ws://${this.config.obsIp || 'localhost'}:${this.config.obsPort || 4455}`;
    
    // 连接到OBS
    await this.obsWebSocket.connect(address, this.config.obsPassword);

    this.obsStatus = 'online';
    this.logger.info('Connected to OBS successfully');

    // 设置连接关闭监听器
    this.obsWebSocket.on('ConnectionClosed', () => {
      this.obsStatus = 'offline';
      this.logger.warn('OBS connection closed');
      this.emit('obsStatusChanged', { status: this.obsStatus });
    });

    return true;
  } catch (error) {
    this.obsStatus = 'offline';
    this.logger.error('Failed to connect to OBS:', error);
    throw error;
  }
}

  /**
   * 同步推流配置到OBS并开始直播
   */
  async syncStartBroadcast(): Promise<boolean> {
    try {
      if (this.obsStatus !== 'online') {
        await this.connectOBS();
      }

      // 获取推流码
      const { server, key } = await this.getStreamKey();
      if (!server || !key) {
        throw new Error('推流码获取失败');
      }

      // 设置OBS推流配置
      await this.obsWebSocket.call('SetStreamServiceSettings', {
        streamServiceType: 'rtmp_custom',
        streamServiceSettings: {
          server,
          key,
          useAuth: false
        }
      });

      // 自动配置OBS场景和源
      await this.configureOBSScene();

      // 开始推流
      await this.obsWebSocket.call('StartStream');
      this.streamStatus = 'live';
      this.logger.info('直播已同步开始');
      this.emit('streamStatusChanged', { status: this.streamStatus });
      return true;
    } catch (error) {
      this.logger.error('同步开播失败:', error);
      throw error;
    }
  }

  /**
   * 配置OBS场景和源
   */
  private async configureOBSScene(): Promise<void> {
    try {
      // 检查场景是否存在，不存在则创建
      const sceneName = 'ACFun直播场景';
      const scenes = await this.obsWebSocket.call('GetSceneList');
      const sceneExists = scenes.scenes.some(s => s.sceneName === sceneName);

      if (!sceneExists) {
        await this.obsWebSocket.call('CreateScene', { sceneName });
        this.logger.info(`创建OBS场景: ${sceneName}`);
      }

      // 设置当前场景
      await this.obsWebSocket.call('SetCurrentScene', { sceneName });

      // 添加或更新显示器捕获源
      const displaySourceName = '主显示器';
      const sources = await this.obsWebSocket.call('GetSourcesList');
      const displaySourceExists = sources.sources.some(s => s.sourceName === displaySourceName);

      if (!displaySourceExists) {
        await this.obsWebSocket.call('CreateSource', {
          sceneName,
          sourceName: displaySourceName,
          sourceKind: 'monitor_capture',
          sourceSettings: {
            monitor: 0 // 使用第一个显示器
          }
        });
        this.logger.info(`添加显示器捕获源: ${displaySourceName}`);
      }

      // 添加或更新文本源显示直播标题
      const titleSourceName = '直播标题';
      const titleSourceExists = sources.sources.some(s => s.sourceName === titleSourceName);
      const roomInfo = await this.getRoomInfo();

      if (!titleSourceExists) {
        await this.obsWebSocket.call('CreateSource', {
          sceneName,
          sourceName: titleSourceName,
          sourceKind: 'text_gdiplus',
          sourceSettings: {
            text: roomInfo.title || 'ACFun直播',
            font: { face: 'Microsoft YaHei', size: 36 },
            color: 0xFFFFFF,
            position: { x: 50, y: 50 }
          }
        });
        this.logger.info(`添加文本源: ${titleSourceName}`);
      } else {
        await this.obsWebSocket.call('SetSourceSettings', {
          sourceName: titleSourceName,
          sourceSettings: {
            text: roomInfo.title || 'ACFun直播'
          }
        });
      }

      this.logger.info('OBS场景配置完成');
    } catch (error) {
      this.logger.error('配置OBS场景失败:', error);
      throw error;
    }

  /**
   * 获取OBS状态
   * @returns OBS状态对象
   */
  getOBSStatus(): { status: OBSStatus } {
    return { status: this.obsStatus };
  }

  /**
   * 获取推流状态
   * @returns 推流状态对象
   */
  getStreamStatus(): { status: StreamStatus } {
    return { status: this.streamStatus };
  }

  /**
   * 保存OBS配置
   * @param config OBS配置
   * @returns 是否成功
   */
  async saveOBSConfig(config: { obsIp?: string; obsPort?: number; obsPassword?: string }): Promise<boolean> {
    try {
      this.updateConfig(config);
      this.logger.info('OBS config saved successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to save OBS config:', error);
      throw error;
    }
  }

  /**
   * 获取OBS配置
   * @returns OBS配置对象
   */
  async getOBSConfig(): Promise<{ obsIp?: string; obsPort?: number; obsPassword?: string }> {
    try {
      const config = this.getConfig();
      return {
        obsIp: config.obsIp,
        obsPort: config.obsPort,
        obsPassword: config.obsPassword
      };
    } catch (error) {
      this.logger.error('Failed to get OBS config:', error);
      throw error;
    }
  }

  /**
   * 停止推流
   * @returns 是否成功
   */


  // 实现AppModule接口的enable方法
  async enable(context: ModuleContext): Promise<boolean> {
    this.app = context.app;
    this.logger.info('LiveManagementModule enabled');
    return true;
  }

  async disable(): Promise<boolean> {
    if (this.obsStatus === 'online') {
      await this.obsWebSocket.disconnect();
    }
    this.streamStatus = 'offline';
    this.obsStatus = 'offline';
    this.logger.info('LiveManagementModule disabled');
    return true;
  }

  // 注册应用退出时的清理函数
  this.app.on('will-quit', () => {
    this.cleanup();
  });
}

  async stopStream(): Promise<boolean> {
    try {
      // 检查OBS是否连接且正在推流
      if (this.obsStatus === 'online' && this.streamStatus === 'live') {
        // 发送停止推流命令到OBS
        await this.obsWebSocket.call('StopStream');
        this.streamStatus = 'offline';
        this.logger.info('Stream stopped successfully via OBS');
        this.emit('streamStatusChanged', { status: this.streamStatus });
      }
      return true;
    } catch (error) {
      this.logger.error('Failed to stop stream via OBS:', error);
      throw error;
    }
  }

  /**
   * 启动推流
   * @returns 是否成功
   */
  async startStream(): Promise<boolean> {
      try {
        // 检查OBS是否连接
        if (this.obsStatus !== 'online') {
          this.logger.warn('Cannot start stream: OBS is not connected');
          return false;
        }

        // 发送开始推流命令到OBS
        await this.obsWebSocket.call('StartStream');
        this.streamStatus = 'live';
        this.logger.info('Stream started successfully via OBS');
        this.emit('streamStatusChanged', { status: this.streamStatus });
        return true;
      } catch (error) {
        this.logger.error('Failed to start stream via OBS:', error);
        throw error;
      }
    }

  /**
   * 检查OBS状态
   * 实际应用中，这里应该通过网络请求检查OBS的真实状态
   */
  private checkOBSStatus(): void {
    // 模拟OBS状态变化
    if (this.obsStatus === 'online') {
      // 随机断开连接，模拟网络问题
      if (Math.random() < 0.05) {
        this.obsStatus = 'offline';
        this.logger.warn('OBS connection lost');
      }
    }
  }

  /**
   * 检查推流状态
   * 实际应用中，这里应该通过网络请求检查推流的真实状态
   */
  private checkStreamStatus(): void {
    try {
      // 模拟推流状态变化
      const oldStatus = this.streamStatus;

      if (this.obsStatus === 'online') {
        // 如果OBS在线，有70%的概率正在推流
        if (Math.random() < 0.7) {
          this.streamStatus = 'live';
        } else {
          this.streamStatus = 'waiting';
        }
      } else {
        this.streamStatus = 'offline';
      }

      // 状态变化时发送通知
      if (oldStatus !== this.streamStatus) {
        this.logger.info(`Stream status changed from ${oldStatus} to ${this.streamStatus}`);
        this.emit('streamStatusChanged', { status: this.streamStatus });

        // 当推流断开时尝试自动重连
        if (this.streamStatus === 'offline' && oldStatus === 'live') {
          this.autoReconnectStream();
        }
      }
    } catch (error) {
      this.logger.error('Failed to check stream status:', error);
      const oldStatus = this.streamStatus;
      this.streamStatus = 'offline';

      if (oldStatus !== this.streamStatus) {
        this.emit('streamStatusChanged', { status: this.streamStatus });
        this.autoReconnectStream();
      }
    }
  }

  /**
   * 自动重连推流
   */
  private autoReconnectStream(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // 如果已经达到最大重连次数，停止尝试
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`Max reconnect attempts (${this.maxReconnectAttempts}) reached, stopping auto-reconnect`);
      return;
    }

    // 计算下次重连的延迟时间（指数退避策略）
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.logger.info(`Attempting to reconnect stream (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      try {
        // 尝试重新连接推流
        this.logger.info('Attempting to reconnect stream...');
        // 在实际应用中，这里应该有真实的重连逻辑
        // 模拟重连成功
        this.streamStatus = 'live';
        this.logger.info('Stream reconnected successfully');
        this.emit('streamStatusChanged', { status: this.streamStatus });
        this.reconnectAttempts = 0;
      } catch (error) {
        this.logger.error('Stream reconnection failed:', error);
        // 重连失败，继续尝试
        this.autoReconnectStream();
      }
    }, delay);
  }

  /**
   * 生成模拟推流码
   * @returns 模拟推流码
   */
  private generateMockStreamKey(): string {
    return 'acfun_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

// 工厂函数创建实例
export function createLiveManagementModule(config: LiveManagementConfig = {}): LiveManagementModule {
  return new LiveManagementModule(config);
}

// 为了兼容旧代码，保留默认导出
const liveManagementModule = new LiveManagementModule();
export default liveManagementModule;