import type { AppModule } from '../AppModule.js';
import { ModuleContext } from '../ModuleContext.js';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { getPackageJson } from '../utils/Devars.js';
import { getLogManager } from '../utils/LogManager.js';
import WebSocket from 'ws';

// 定义配置接口
interface AcfunDanmuConfig {
  port: number;
  debug: boolean;
  connectionMode: 'tcp' | 'ws';
  logLevel: 'info' | 'debug' | 'error';
}

// 默认配置
const DEFAULT_CONFIG: AcfunDanmuConfig = {
  port: 15368,
  debug: false,
  connectionMode: 'ws',
  logLevel: 'info'
};

export class AcfunDanmuModule implements AppModule {
  private process: ChildProcess | null = null;
  private obsWebSocket: WebSocket | null = null;
  private obsConnectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private config: AcfunDanmuConfig;
  private logCallback: ((message: string, type: 'info' | 'error') => void) | null = null;
  private logManager: ReturnType<typeof getLogManager>;

  constructor(config: Partial<AcfunDanmuConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logManager = getLogManager();
  }

  // 设置日志回调函数
  setLogCallback(callback: (message: string, type: 'info' | 'error') => void): void {
    this.logCallback = callback;
  }

  // 获取当前状态
  getStatus(): { running: boolean, port: number } {    
    return { running: !!this.process, port: this.config.port };
  }

  // 获取当前配置
  getConfig(): AcfunDanmuConfig {
    return { ...this.config };
  }

  // 更新配置
  updateConfig(config: Partial<AcfunDanmuConfig>): void {
    this.config = { ...this.config, ...config };
    // 重启服务以应用新配置
    this.restart();
  }

  // 启动服务
  async start(): Promise<void> {
    try {
      // 确保之前的进程已关闭
      if (this.process) {
        this.stop();
      }

      // 获取acfundanmu模块的路径
      const packageJson = await getPackageJson();
      const rootPath = packageJson?.appPath || path.dirname(app.getPath('exe'));
      const acfunDanmuPath = path.join(rootPath, 'packages', 'acfundanmu', 'main.js');

      // 构建命令参数
      const args = ['--port=' + this.config.port];
      if (this.config.debug) {
        args.push('--debug');
      }
      if (this.config.connectionMode === 'tcp') {
        args.push('--tcp');
      }

      // 设置环境变量
      const env = { ...process.env };
      env.LOG_LEVEL = this.config.logLevel;

      // 启动子进程
      const options: SpawnOptions = {
        windowsHide: true,
        env,
        stdio: ['ignore', 'pipe', 'pipe'] // 捕获stdout和stderr
      };

      this.process = spawn(process.execPath, [acfunDanmuPath, ...args], options);

      // 捕获标准输出
      this.process.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        if (this.logCallback) {
          this.logCallback(message, 'info');
        } else {
          console.log('[AcfunDanmu]', message);
        }
      });

      // 捕获错误输出
      this.process.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (this.logCallback) {
          this.logCallback(message, 'error');
        } else {
          console.error('[AcfunDanmu]', message);
        }
      });

      // 处理进程关闭事件
      this.process.on('close', (code) => {
        if (this.logCallback) {
          this.logCallback(`进程已关闭，退出码: ${code}`, 'info');
        } else {
          console.log(`[AcfunDanmu] 进程已关闭，退出码: ${code}`);
        }
        this.process = null;
      });

      // 处理进程错误事件
      this.process.on('error', (error) => {
        if (this.logCallback) {
          this.logCallback(`进程错误: ${error.message}`, 'error');
        } else {
          console.error(`[AcfunDanmu] 进程错误: ${error.message}`);
        }
        this.process = null;
      });

      if (this.logCallback) {
        this.logCallback(`AcfunDanmu服务已启动，端口: ${this.config.port}`, 'info');
      } else {
        console.log(`[AcfunDanmu] 服务已启动，端口: ${this.config.port}`);
      }
    } catch (error) {
      if (this.logCallback) {
        this.logCallback(`启动AcfunDanmu服务失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      } else {
        console.error(`[AcfunDanmu] 启动服务失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // 停止服务
  stop(): void {
    if (this.process) {
      try {
        this.process.kill();
        this.process = null;
        if (this.logCallback) {
          this.logCallback('AcfunDanmu服务已停止', 'info');
        } else {
          console.log('[AcfunDanmu] 服务已停止');
        }
      } catch (error) {
        if (this.logCallback) {
          this.logCallback(`停止AcfunDanmu服务失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
        } else {
          console.error(`[AcfunDanmu] 停止服务失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // 重启服务
  restart(): void {
    if (this.logCallback) {
      this.logCallback('正在重启AcfunDanmu服务...', 'info');
    } else {
      console.log('[AcfunDanmu] 正在重启服务...');
    }
    this.start();
  }

  // 实现AppModule接口
  async enable({ app }: ModuleContext): Promise<void> {
    // 设置日志回调
    this.setLogCallback((message, type) => {
      this.logManager.addLog('acfunDanmu', message, type as any);
    });

    // 延迟启动，确保应用已就绪
    app.on('ready', () => {
      setTimeout(() => {
        this.start();
      }, 1000);
    });

    // 主进程退出时停止服务
    app.on('will-quit', () => {
      this.stop();
    });
  }
}

  // 弹幕相关方法
  async sendDanmu(roomId: number, userId: number, nickname: string, content: string): Promise<any> {
    return this.callAcfunDanmuApi(
      `/danmu/send`,
      'POST',
      { roomId, userId, nickname, content }
    );
  }

  async getDanmuHistory(roomId: number, page: number = 1, pageSize: number = 20): Promise<any> {
    return this.callAcfunDanmuApi(
      `/danmu/history`,
      'GET',
      { roomId, page, pageSize }
    );
  }

  async blockUser(roomId: number, userId: number, duration: number = 3600): Promise<any> {
    return this.callAcfunDanmuApi(
      `/danmu/block`,
      'POST',
      { roomId, userId, duration }
    );
  }

  // 房管相关方法
  async getManagerList(uid: number, page: number = 1, pageSize: number = 20): Promise<any> {
    return this.callAcfunDanmuApi(
      `/manager/list`,
      'GET',
      { uid, page, pageSize }
    );
  }

  async addManager(uid: number, targetId: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/manager/add`,
      'POST',
      { uid, targetId }
    );
  }

  async removeManager(uid: number, targetId: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/manager/remove`,
      'POST',
      { uid, targetId }
    );
  }

  async getKickRecord(uid: number, page: number = 1, pageSize: number = 20): Promise<any> {
    return this.callAcfunDanmuApi(
      `/manager/kickRecord`,
      'GET',
      { uid, page, pageSize }
    );
  }

  async managerKickUser(uid: number, targetId: number, reason: string = '', duration: number = 3600): Promise<any> {
    return this.callAcfunDanmuApi(
      `/manager/kickUser`,
      'POST',
      { uid, targetId, reason, duration }
    );
  }

  async authorKickUser(uid: number, targetId: number, reason: string = '', duration: number = 3600): Promise<any> {
    return this.callAcfunDanmuApi(
      `/author/kickUser`,
      'POST',
      { uid, targetId, reason, duration }
    );
  }

  // 守护徽章相关方法
  async getMedalDetail(uid: number, medalId: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/medal/detail`,
      'GET',
      { uid, medalId }
    );
  }

  async getMedalList(uid: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/medal/list`,
      'GET',
      { uid }
    );
  }

  async getMedalRank(uid: number, medalId: number, rankType: number = 1): Promise<any> {
    return this.callAcfunDanmuApi(
      `/medal/rank`,
      'GET',
      { uid, medalId, rankType }
    );
  }

  async getUserWearingMedal(uid: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/medal/wearing`,
      'GET',
      { uid }
    );
  }

  async wearMedal(uid: number, medalId: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/medal/wear`,
      'POST',
      { uid, medalId }
    );
  }

  async unwearMedal(uid: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/medal/unwear`,
      'POST',
      { uid }
    );
  }

  // RTMP地址管理
  async saveRtmpConfig(roomId: number, rtmpUrl: string, streamKey: string): Promise<any> {
    return this.callAcfunDanmuApi(
      `/stream/saveRtmpConfig`,
      'POST',
      { roomId, rtmpUrl, streamKey }
    );
  }

  async getRtmpConfig(roomId: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/stream/getRtmpConfig`,
      'GET',
      { roomId }
    );
  }

  // OBS连接状态监控
  async getObsConnectionStatus(roomId: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/stream/obsStatus`,
      'GET',
      { roomId }
    );
  }

  // RTMP配置管理
  async saveRtmpConfig(roomId: number, rtmpUrl: string, streamKey: string): Promise<boolean> {
    try {
      const rtmpConfigs = this.configManager.readConfig().rtmpConfigs || {};
      rtmpConfigs[roomId] = { rtmpUrl, streamKey, updatedAt: new Date().toISOString() };
      this.configManager.writeConfig({ rtmpConfigs });
      return true;
    } catch (error) {
      this.logManager.addLog('AcfunDanmuModule', `Failed to save RTMP config: ${error.message}`, 'error');
      return false;
    }
  }

  async getRtmpConfig(roomId: number): Promise<{rtmpUrl: string, streamKey: string} | null> {
    try {
      const rtmpConfigs = this.configManager.readConfig().rtmpConfigs || {};
      return rtmpConfigs[roomId] || null;
    } catch (error) {
      this.logManager.addLog('AcfunDanmuModule', `Failed to get RTMP config: ${error.message}`, 'error');
      return null;
    }
  }

  // OBS连接管理
  private setupOBSWebSocket(obsHost: string, obsPort: number, password: string): void {
    const wsUrl = `ws://${obsHost}:${obsPort}/ws`;
    this.obsWebSocket = new WebSocket(wsUrl);
    this.obsConnectionStatus = 'connecting';

    this.obsWebSocket.on('open', () => {
      this.logManager.addLog('AcfunDanmuModule', 'OBS WebSocket connected', 'info');
      this.obsConnectionStatus = 'connected';
      // 发送认证请求
      this.obsWebSocket?.send(JSON.stringify({
        "op": 1,
        "d": {
          "rpcVersion": 1,
          "authentication": password
        }
      }));
    });

    this.obsWebSocket.on('close', () => {
      this.logManager.addLog('AcfunDanmuModule', 'OBS WebSocket disconnected', 'info');
      this.obsConnectionStatus = 'disconnected';
      // 自动重连逻辑
      setTimeout(() => this.setupOBSWebSocket(obsHost, obsPort, password), 5000);
    });

    this.obsWebSocket.on('error', (error) => {
      this.logManager.addLog('AcfunDanmuModule', `OBS WebSocket error: ${error.message}`, 'error');
      this.obsConnectionStatus = 'disconnected';
    });

    this.obsWebSocket.on('message', (data) => {
      const message = JSON.parse(data.toString());
      // 处理OBS事件通知
      if (message.op === 5) {
        this.logManager.addLog('AcfunDanmuModule', `OBS event: ${message.d.eventType}`, 'info');
        // 可扩展处理具体事件（如流状态变化）
      }
    });
  }

  connectToOBS(obsHost: string = 'localhost', obsPort: number = 4455, password: string = ''): void {
    this.setupOBSWebSocket(obsHost, obsPort, password);
  }

  disconnectFromOBS(): void {
    if (this.obsWebSocket) {
      this.obsWebSocket.close();
      this.obsWebSocket = null;
      this.obsConnectionStatus = 'disconnected';
    }
  }

  getOBSConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.obsConnectionStatus;
  }

  // 推流管理相关方法
  async startStream(roomId: number, streamKey: string, quality: string): Promise<any> {
    return this.callAcfunDanmuApi(
      `/stream/start`,
      'POST',
      { roomId, streamKey, quality }
    );
  }

  async stopStream(roomId: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/stream/stop`,
      'POST',
      { roomId }
    );
  }

  async getStreamStatus(roomId: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/stream/status`,
      'GET',
      { roomId }
    );
  }

  // 登录相关方法
  async login(account: string, password: string): Promise<any> {
    return this.callAcfunDanmuApi(
      `/login`,
      'POST',
      { account, password }
    );
  }

  async loginWithQRCode(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/login/qrcode`,
      'POST'
    );
  }

  // 观看列表相关方法
  async getWatchingList(liveID: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/watchingList`,
      'GET',
      { liveId }
    );
  }

  // 排行榜相关方法
  async getBillboard(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/billboard`,
      'GET'
    );
  }

  // 摘要信息相关方法
  async getSummary(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/summary`,
      'GET'
    );
  }

  // 幸运列表相关方法
  async getLuckList(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/luckList`,
      'GET'
    );
  }

  // 回放信息相关方法
  async getPlayback(liveID: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/playback`,
      'GET',
      { liveId: liveID }
    );
  }

  // 礼物列表相关方法
  async getAllGiftList(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/gift/allList`,
      'GET'
    );
  }

  async getGiftList(liveID: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/gift/list`,
      'GET',
      { liveId: liveID }
    );
  }

  // 账户钱包相关方法
  async getWalletBalance(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/wallet/balance`,
      'GET'
    );
  }

  // 用户直播信息相关方法
  async getUserLiveInfo(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/user/liveInfo`,
      'GET'
    );
  }

  // 直播列表相关方法
  async getAllLiveList(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/allList`,
      'GET'
    );
  }

  // 直播数据相关方法
  async getLiveData(days: number = 7): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/data`,
      'GET',
      { days }
    );
  }

  // 用户信息相关方法
  async getUserInfo(userID?: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/user/info`,
      'GET',
      userID ? { userId: userID } : {}
    );
  }

  // 上传图片相关方法
  async uploadImage(imagePath: string): Promise<any> {
    return this.callAcfunDanmuApi(
      `/upload/image`,
      'POST',
      { imageFile: imagePath }
    );
  }

  // 直播预告相关方法
  async getScheduleList(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/scheduleList`,
      'GET'
    );
  }

  // 弹幕相关方法
  async sendDanmu(liveId: number, content: string): Promise<DanmuSendResponse> {
    if (!liveId || liveId <=0) throw new Error('Invalid liveId');
    if (!content || content.trim().length === 0 || content.length > 200) throw new Error('Invalid danmu content');
    try {
      return await this.callAcfunDanmuApi<DanmuSendResponse>(
        `/danmu/send`,
        'POST',
        { liveId, content }
      );
    } catch (error) {
      this.logger.error(`Failed to send danmu: ${error.message}`, { liveId, content });
      throw error;
    }
  }

  // 直播状态相关方法
  async getLiveStatus(liveId: number): Promise<LiveStatusResponse> {
    return this.callAcfunDanmuApi(
      `/live/status`,
      'GET',
      { liveId: liveID }
    );
  }

  // 转码信息相关方法
  async getTranscodeInfo(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/transcodeInfo`,
      'GET'
    );
  }

  // 直播控制相关方法
  async startLive(categoryID: number, title: string, coverUrl: string): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/start`,
      'POST',
      { categoryId: categoryID, title, coverUrl }
    );
  }

  async stopLive(): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/stop`,
      'POST'
    );
  }

  async updateLiveInfo(title: string, coverUrl: string): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/updateInfo`,
      'POST',
      { title, coverUrl }
    );
  }

  // 直播剪辑相关方法
  async checkCanCut(liveID: number): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/checkCanCut`,
      'GET',
      { liveId: liveID }
    );
  }

  async setCanCut(liveID: number, canCut: boolean): Promise<any> {
    return this.callAcfunDanmuApi(
      `/live/setCanCut`,
      'POST',
      { liveId: liveID, canCut }
    );
  }

  // HTTP客户端工具方法
  private async callAcfunDanmuApi(path: string, method: 'GET' | 'POST' = 'GET', data: any = null): Promise<any> {
    try {
      let url = `http://localhost:${this.config.port}/api${path}`;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': 'acfun-live-toolbox'
        }
      };

      if (method === 'POST' && data) {
        options.body = JSON.stringify(data);
      } else if (method === 'GET' && data) {
        const queryParams = new URLSearchParams(data);
        url += `?${queryParams}`;
      }

      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[AcfunDanmu] API调用失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

// 创建模块工厂函数
export function createAcfunDanmuModule(config: Partial<AcfunDanmuConfig> = {}): AppModule {
  return new AcfunDanmuModule(config);
}

// 创建并导出单例
let instance: AcfunDanmuModule | null = null;

export function getAcfunDanmuModule(): AcfunDanmuModule {
  if (!instance) {
    instance = new AcfunDanmuModule();
  }
  return instance;
}

// 兼容旧的导入方式
import { app } from 'electron';

// 延迟初始化模块
app.on('ready', () => {
  // 初始化模块
  getAcfunDanmuModule();
});

export const acfunDanmuModule = getAcfunDanmuModule();