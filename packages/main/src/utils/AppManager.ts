import fs from "fs";
import path from "path";
import { promisify } from "util";
import { ConfigManager } from "./ConfigManager.js";
import { HttpManager } from "./HttpManager.js";
import { WindowManager, WindowConfig } from "../modules/WindowManager.js";
import { getPackageJson } from "./Devars.js";
import { app } from "electron";
import { EventEmitter } from "events";
import { BrowserWindow, ipcMain } from 'electron';
import { DataManager } from './DataManager';
import { AppModule } from '../AppModule.js';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

interface AppConfig {
  id: string;
  name: string;
  version: string;
  info?: string;
  settings?: Record<string, any>;
  windows: WindowConfig;
  supportedDisplays?: ("main" | "obs" | "client")[];
}

export class AppManager extends EventEmitter {
  private apps: Map<string, AppConfig> = new Map();
  private appWindows: Map<string, Electron.BrowserWindow[]> = new Map();
  private httpManager: HttpManager = globalThis.httpManager;
  private windowManager: WindowManager = globalThis.windowManager;
  private appDir: string = "";
  private configManager: ConfigManager = globalThis.configManager;
  private modules: Map<string, AppModule> = new Map();

  constructor() {
    super();
  }

  /**
   * 注册模块
   * @param moduleId 模块ID
   * @param module 模块实例
   */
  registerModule(moduleId: string, module: AppModule): void {
    this.modules.set(moduleId, module);
    this.emit('module-registered', moduleId);
    console.log(`Module ${moduleId} registered successfully`);
  }

  /**
   * 获取模块实例
   * @param moduleId 模块ID
   * @returns 模块实例或undefined
   */
  getModule(moduleId: string): AppModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * 获取所有已注册的模块
   * @returns 模块ID和实例的映射
   */
  getAllModules(): Map<string, AppModule> {
    return this.modules;
  }
  // 修正：直接使用 HttpManager 初始化的应用目录
  private async getAppDirectory(): Promise<string> {
    return globalThis.httpManager.getAppDir(); // 使用 HttpManager 暴露的路径
  }

  async init(): Promise<void> {
    this.appDir = await this.getAppDirectory(); // 从 HttpManager 获取已初始化的路径
    const appFolders = await this.getAppFolders();
    for (const folder of appFolders) {
      const configPath = path.join(folder, "config.json");
      const configContent = await fs.promises.readFile(configPath, "utf-8");
      const config: AppConfig = JSON.parse(configContent);
      this.apps.set(config.id, config);

      // 托管静态文件
      this.httpManager.serveStatic(`/application/${config.name}`, folder);

      // 加载API接口
      const apiPath = path.join(folder, "api.cjs");
      if (fs.existsSync(apiPath)) {
        // Access default export for ES module compatibility
        const apiModule = require(apiPath);
        const apiRoutes = apiModule.default || apiModule;
        this.httpManager.addApiRoutes(
          `/api/application/${config.name}`,
          apiRoutes
        );
      }
    }
  }

  // 修正：重写 getAppFolders 方法，使用纯 Promise 风格
  private async getAppFolders(): Promise<string[]> {
    const appDir = this.appDir; // 已通过 init 初始化的有效路径
    if (!appDir) {
      throw new Error("Application directory path is undefined");
    }

    const items = await readdir(appDir); // 使用 promisify 后的 readdir
    const folders: string[] = [];

    for (const item of items) {
      const itemPath = path.join(appDir, item);
      const stats = await stat(itemPath); // 使用 promisify 后的 stat
      if (stats.isDirectory()) {
        folders.push(itemPath);
      }
    }

    return folders;
  }

  // 小程序管理相关方法
  getMiniPrograms(): MiniProgramInfo[] {
    return Array.from(this.apps.values())
      .filter(app => app.type === 'miniProgram')
      .map(app => ({ id: app.id, name: app.name, path: app.path, status: 'running' }));
  }

  async addMiniProgram(name: string, path: string, config?: Record<string, any>): Promise<string> {
    const appId = `mini_${Date.now()}`;
    const miniProgramConfig: AppConfig = {
      id: appId,
      name,
      type: 'miniProgram',
      path,
      version: '1.0.0',
      windows: { width: 400, height: 600, title: name }
    };
    this.apps.set(appId, { ...miniProgramConfig, ...config });
    await this.saveAppConfig(appId, miniProgramConfig);
    return appId;
  }

  async updateMiniProgramConfig(appId: string, config: Record<string, any>): Promise<void> {
    const app = this.getAppConfig(appId);
    if (!app || app.type !== 'miniProgram') throw new Error('小程序不存在');
    const updatedConfig = { ...app, ...config };
    this.apps.set(appId, updatedConfig);
    await this.saveAppConfig(appId, updatedConfig);
  }

  async removeMiniProgram(appId: string): Promise<void> {
    if (!this.apps.has(appId)) throw new Error('小程序不存在');
    await this.closeApp(appId);
    this.apps.delete(appId);
    await this.configManager.deleteConfig(appId);
  }

  getAppConfig(appId: string): AppConfig | undefined {
    return this.apps.get(appId);
  }

  async readAppConfig(appId: string): Promise<AppConfig> {
    const config = this.apps.get(appId);
    if (!config) {
      throw new Error(`App ${appId} not found`);
    }
    // 读取已保存的配置
    let savedConfig: any = await this.configManager.readConfig(config.name);
    // 如果没有保存的配置，使用默认配置并保存
    if (!savedConfig) {
      savedConfig = { ...config };
      await this.configManager.saveConfig(config.name, savedConfig);
    }
    return savedConfig;
  }

  async saveAppConfig(appId: string, configData: AppConfig): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App ${appId} not found`);
    }
    await this.configManager.saveConfig(app.name, configData);
  }

  // 数据分析相关方法
  async getLiveStatistics() {
    // 实现直播统计数据获取逻辑
    try {
      const response = await this.callAcfunApi('/live/statistics');
      return {
        viewerCount: response.viewerCount || 0,
        likeCount: response.likeCount || 0,
        giftCount: response.giftCount || 0,
        danmakuCount: response.danmakuCount || 0,
        liveDuration: response.liveDuration || 0
      };
    } catch (error) {
      this.logManager.addLog('analytics', `获取直播统计失败: ${error.message}`, 'error');
      // 返回缓存数据或默认值
      return this.liveStatsCache || {
        viewerCount: 0,
        likeCount: 0,
        giftCount: 0,
        danmakuCount: 0,
        liveDuration: 0
      };
    }
  }

  async getAudienceAnalysis() {
    // 实现观众行为分析逻辑
    return {
      sources: { direct: 0, share: 0, search: 0 },
      watchTime: { avg: 0, distribution: [] },
      interactionRate: 0
    };
  }

  async checkNetworkStatus() {
    // 实现完整网络检测逻辑
    const results = {
      acfunApi: false,
      danmuServer: false,
      pushServer: false,
      cdn: false
    };

    // 检测ACFUN API连接性
    try {
      const response = await fetch('https://api.acfun.cn/rest/app/version', { timeout: 5000 });
      results.acfunApi = response.ok;
    } catch (error) {
      this.logManager.addLog('network', `ACFUN API检测失败: ${error.message}`, 'error');
    }

    // 检测弹幕服务器连接性
    try {
      const response = await fetch('https://danmu.acfun.cn/api/v2/status', { timeout:5000 });
      results.danmuServer = response.ok;
    } catch (error) {
      this.logManager.addLog('network', `弹幕服务器检测失败: ${error.message}`, 'error');
    }

    // 检测推流服务器连接性
    try {
      const response = await fetch('https://push.acfun.cn/api/v1/status', { timeout:5000 });
      results.pushServer = response.ok;
    } catch (error) {
      this.logManager.addLog('network', `推流服务器检测失败: ${error.message}`, 'error');
    }

    // 检测CDN连接性
    try {
      const response = await fetch('https://cdn.acfun.cn/health-check', { timeout:5000 });
      results.cdn = response.ok;
    } catch (error) {
      this.logManager.addLog('network', `CDN检测失败: ${error.message}`, 'error');
    }

    // 记录整体网络状态
    const allOk = Object.values(results).every(status => status);
    this.logManager.addLog('network', `网络状态检测完成: ${allOk ? '正常' : '部分服务异常'}`, allOk ? 'info' : 'warn');

    return results;
  }

  async getMarketplaceApps() {
    // 获取小程序市场应用列表
    // 实际实现应从服务器获取，此处为模拟数据
    return [
      {
        name: '弹幕增强工具',
        description: '高级弹幕过滤与管理功能',
        version: '1.0.0',
        author: 'ACFUN官方',
        rating: 4.8,
        downloads: 1200
      },
      {
        name: '观众数据分析',
        description: '详细的观众行为分析报表',
        version: '2.1.0',
        author: '第三方开发者',
        rating: 4.5,
        downloads: 850
      }
    ];
  }

  async installMiniProgram(name: string, source: string) {
    // 实现小程序安装逻辑
    // 1. 验证来源合法性
    // 2. 下载小程序资源
    // 3. 安装到本地目录
    // 4. 更新installedApps列表
    const newApp = {
      name,
      type: 'miniProgram',
      path: path.join(this.appsDir, name),
      isRunning: false,
      config: {},
      lastUpdated: new Date().toISOString()
    };

    this.installedApps.push(newApp);
    await this.saveInstalledApps();
  }

  async getShortcuts() {
    // 获取当前快捷键配置
    return this.config.shortcuts || this.getDefaultShortcuts();
  }

  async setShortcuts(shortcuts: Record<string, string>) {
    // 保存快捷键配置
    this.config.shortcuts = shortcuts;
    await this.saveConfig();
  }

  async resetShortcuts() {
    // 重置快捷键为默认值
    this.config.shortcuts = this.getDefaultShortcuts();
    await this.saveConfig();
  }

  private getDefaultShortcuts() {
    // 默认快捷键配置
    return {
      'startLive': 'Ctrl+Shift+L',
      'stopLive': 'Ctrl+Shift+S',
      'toggleDanmaku': 'Ctrl+D',
      'muteMic': 'Ctrl+M',
      'openSettings': 'Ctrl+,',
    };
  }

  async updateMiniProgram(name: string) {
    // 实现小程序更新逻辑
    const appIndex = this.installedApps.findIndex(app => app.name === name && app.type === 'miniProgram');
    if (appIndex === -1) {
      throw new Error(`小程序 ${name} 未安装`);
    }

    // 模拟更新检查
    this.installedApps[appIndex].lastUpdated = new Date().toISOString();
    await this.saveInstalledApps();
  }

  async getMiniProgramStatuses() {
    // 实现小程序状态监控逻辑
    return this.installedApps
      .filter(app => app.type === 'miniProgram')
      .map(app => ({
        name: app.name,
        status: app.isRunning ? 'running' : 'stopped',
        cpuUsage: 0,
        memoryUsage: 0,
        lastActive: new Date().toISOString()
      }));
  }

  async getGiftStatistics() {
    // 实现礼物数据统计逻辑
    return {
      totalValue: 0,
      topUsers: [],
      typeDistribution: {}
    };
  }

  getAppUrl(appName: string): string {
    const port = this.httpManager.getPort();
    return `http://localhost:${port}/application/${appName}/index.html`;
  }

  async startApp(appId: string): Promise<Electron.BrowserWindow> {
    const config = this.getAppConfig(appId);
    if (!config) {
      throw new Error(`App ${appId} not found`);
    }
    const window = await this.windowManager.createWindow(config.windows);
    window.loadURL(this.getAppUrl(config.name));

    if (!this.appWindows.has(appId)) {
      this.appWindows.set(appId, []);
    }
    this.appWindows.get(appId)!.push(window);

    return window;
  }

  async closeApp(appId: string): Promise<void> {
    const windows = this.appWindows.get(appId) || [];
    windows.forEach((window) => window.close());
    this.appWindows.delete(appId);
    this.emit("app-closed", appId);
  }

  async restartApp(appId: string): Promise<void> {
    await this.closeApp(appId);
    await this.startApp(appId);
  }

  async reloadApps(): Promise<void> {
    // 关闭所有窗口
    Array.from(this.appWindows.keys()).forEach(
      async (id) => await this.closeApp(id)
    );

    // 清理HTTP托管
    this.apps.forEach((app) => {
      this.httpManager.removeStatic(`/application/${app.name}`);
      this.httpManager.removeApiRoutes(`/api/application/${app.id}`);
    });

    // 重新初始化
    this.apps.clear();
    await this.init();
  }
  private createClientWindow(appId: string): BrowserWindow {
    const window = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    // 加载渲染器页面
    const indexPath = path.join(__dirname, '../../../renderer/index.html');
    window.loadFile(indexPath).catch(err => {
      console.error('Failed to load window content:', err);
    });

    // 监听窗口关闭事件
    window.on("closed", () => {
      DataManager.getInstance().handleClientClosed(appId);
      this.emit("app-closed", appId);
    });

    return window;
  }
}

