import fs from "fs";
import path from "path";
import { promisify } from "util";
import { ConfigManager } from "../utils/ConfigManager.js";
import { HttpManager } from "../utils/HttpManager.js";
import { WindowManager, WindowConfig } from "../modules/WindowManager.js";
import { getPackageJson } from "./Devars.js";
import { app } from "electron";
import { EventEmitter } from "events";
import { BrowserWindow, ipcMain } from 'electron';
import { DataManager } from './DataManager';
import { AppModule } from '../AppModule.js';
import { securityScanner } from '../modules/SecurityScanner.js';


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
  type?: string;
  path?: string;
}

interface MiniProgramInfo {
  id: string;
  name: string;
  path: string;
  status: 'running' | 'stopped' | 'error';
}

export class AppManager extends EventEmitter {
  private apps: Map<string, AppConfig> = new Map();
  private appWindows: Map<string, Electron.BrowserWindow[]> = new Map();
  private httpManager: HttpManager = globalThis.httpManager;
  private windowManager: WindowManager = globalThis.windowManager;
  private appDir: string = "";
  private configManager: ConfigManager = globalThis.configManager;
  private modules: Map<string, AppModule> = new Map();
  private installedApps: any[] = [];
  private config: any = {};
  private appsDir: string = '';
  private logManager: any = { addLog: (type: string, message: string, level: string) => console.log(`[${level}] ${type}: ${message}`) };

  constructor() {
    super();
    this.initSecurityListeners();
    this.loadConfig();
    this.loadInstalledApps();
    
    // 初始化应用目录
    this.appsDir = path.join(app.getPath('appData'), 'acfun-live-toolbox', 'applications');
    if (!fs.existsSync(this.appsDir)) {
      fs.mkdirSync(this.appsDir, { recursive: true });
    }
  }

  private initSecurityListeners(): void {
    // 监听安全扫描完成事件
    securityScanner.on('scan-completed', (result) => {
      console.log('安全扫描完成:', result);
    });

    // 监听安全扫描错误事件
    securityScanner.on('scan-error', (result) => {
      console.error('安全扫描错误:', result);
    });

    // 监听异常行为事件
    securityScanner.on('abnormal-behavior', (appId, message) => {
      console.warn(`小程序${appId}出现异常行为:`, message);
      this.logManager.addLog('security', `小程序${appId}出现异常行为: ${message}`, 'warn');
    });
  }

  private loadConfig(): void {
    try {
      const configPath = path.join(app.getPath('appData'), 'acfun-live-toolbox', 'app-manager-config.json');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        this.config = JSON.parse(content);
      } else {
        this.config = {
          shortcuts: this.getDefaultShortcuts(),
          security: {
            autoScan: true,
            permissionAudit: true,
            runtimeMonitoring: true
          }
        };
        this.saveConfig();
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      this.config = {
        shortcuts: this.getDefaultShortcuts(),
        security: {
          autoScan: true,
          permissionAudit: true,
          runtimeMonitoring: true
        }
      };
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const configPath = path.join(app.getPath('appData'), 'acfun-live-toolbox', 'app-manager-config.json');
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  }

  private loadInstalledApps(): void {
    try {
      const appsPath = path.join(app.getPath('appData'), 'acfun-live-toolbox', 'installed-apps.json');
      if (fs.existsSync(appsPath)) {
        const content = fs.readFileSync(appsPath, 'utf-8');
        this.installedApps = JSON.parse(content);
      } else {
        this.installedApps = [];
        this.saveInstalledApps();
      }
    } catch (error) {
      console.error('加载已安装应用失败:', error);
      this.installedApps = [];
    }
  }

  private async saveInstalledApps(): Promise<void> {
    try {
      const appsPath = path.join(app.getPath('appData'), 'acfun-live-toolbox', 'installed-apps.json');
      fs.writeFileSync(appsPath, JSON.stringify(this.installedApps, null, 2));
    } catch (error) {
      console.error('保存已安装应用失败:', error);
    }
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
    console.log(`开始安装小程序: ${name} 从来源: ${source}`);

    // 1. 验证来源合法性
    if (!this.validateSource(source)) {
      throw new Error('不合法的小程序来源');
    }

    // 2. 创建临时目录
    const tempDir = path.join(app.getPath('temp'), `acfun-mini-program-${Date.now()}`);
    const installDir = path.join(this.appsDir, name);
    
    try {
      // 确保临时目录不存在
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // 3. 下载小程序资源
      console.log(`正在下载小程序资源到临时目录: ${tempDir}`);
      // 实际项目中应该实现真实的下载逻辑
      // 这里为了演示，创建一个简单的模拟小程序结构
      this.createMockMiniProgram(tempDir, name);

      // 4. 安全扫描 - 代码扫描
      if (this.config.security?.autoScan !== false) {
        console.log('开始进行安全扫描...');
        const scanResult = await securityScanner.scanMiniProgram(tempDir);
        
        if (!scanResult.passed) {
          console.error('小程序安全扫描失败:', scanResult.issues);
          throw new Error(`小程序安全扫描失败: ${scanResult.issues.map(issue => issue.description).join(', ')}`);
        }
        console.log('安全扫描通过');
      }

      // 5. 权限审计
      if (this.config.security?.permissionAudit !== false) {
        console.log('开始进行权限审计...');
        const permissionResult = await securityScanner.auditPermissions(tempDir);
        
        // 如果权限分数过低，拒绝安装
        if (permissionResult.analysis.permissionScore < 60) {
          console.error('小程序权限审计失败:', permissionResult);
          throw new Error(`小程序权限审计失败: 权限分数过低 (${permissionResult.analysis.permissionScore}/100)`);
        }
        console.log('权限审计通过，分数:', permissionResult.analysis.permissionScore);
      }

      // 6. 安装到本地目录
      if (fs.existsSync(installDir)) {
        fs.rmSync(installDir, { recursive: true, force: true });
      }
      fs.cpSync(tempDir, installDir, { recursive: true });
      console.log(`小程序安装到: ${installDir}`);

      // 7. 更新installedApps列表
      const newApp = {
        id: `mini_${Date.now()}`,
        name,
        type: 'miniProgram',
        path: installDir,
        source,
        isRunning: false,
        config: {},
        lastUpdated: new Date().toISOString(),
        installDate: new Date().toISOString()
      };

      this.installedApps.push(newApp);
      await this.saveInstalledApps();
      console.log('小程序安装完成:', newApp);
      
      return newApp.id;
    } catch (error) {
      console.error('小程序安装失败:', error);
      throw error;
    } finally {
      // 清理临时目录
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  private validateSource(source: string): boolean {
    // 验证来源的合法性
    // 实际项目中应该实现更严格的验证逻辑
    const validDomains = ['https://mini-programs.acfun.cn', 'https://acfun-mini-programs.oss-cn-beijing.aliyuncs.com'];
    
    try {
      const url = new URL(source);
      return validDomains.some(domain => url.origin === domain);
    } catch (error) {
      // 如果不是URL，可能是本地路径或其他格式，需要进一步验证
      return source.startsWith('./') || source.startsWith('../') || path.isAbsolute(source);
    }
  }

  private createMockMiniProgram(dir: string, name: string): void {
    // 创建模拟小程序结构，仅用于演示
    const indexHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${name}</h1>
    <p>这是一个模拟的小程序示例。</p>
  </div>
</body>
</html>
    `.trim();

    const manifestJson = JSON.stringify({
      name,
      version: '1.0.0',
      description: `${name}的描述`,
      author: '未知',
      entry: 'index.html'
    }, null, 2);

    const configJson = JSON.stringify({
      id: `mini_${Date.now()}`,
      name,
      version: '1.0.0',
      type: 'miniProgram',
      windows: {
        width: 800,
        height: 600,
        title: name
      }
    }, null, 2);

    const permissionsJson = JSON.stringify({
      network: {
        required: true,
        reason: '需要网络连接获取数据'
      }
    }, null, 2);

    // 创建文件
    fs.writeFileSync(path.join(dir, 'index.html'), indexHtml);
    fs.writeFileSync(path.join(dir, 'manifest.json'), manifestJson);
    fs.writeFileSync(path.join(dir, 'config.json'), configJson);
    fs.writeFileSync(path.join(dir, 'permissions.json'), permissionsJson);
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

  async updateMiniProgram(id: string) {
    // 实现小程序更新逻辑
    const appIndex = this.installedApps.findIndex(app => app.id === id && app.type === 'miniProgram');
    if (appIndex === -1) {
      throw new Error(`小程序 ${id} 未安装`);
    }

    const miniProgram = this.installedApps[appIndex];
    console.log(`开始更新小程序: ${miniProgram.name} (${id})`);

    // 如果小程序正在运行，先停止
    if (miniProgram.isRunning) {
      console.log('小程序正在运行，先停止...');
      await this.closeApp(id);
    }

    // 创建临时目录
    const tempDir = path.join(app.getPath('temp'), `acfun-mini-program-update-${Date.now()}`);
    
    try {
      // 确保临时目录不存在
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // 下载更新包
      console.log(`正在下载更新包到临时目录: ${tempDir}`);
      // 实际项目中应该从服务器下载更新包
      // 这里为了演示，更新模拟小程序的内容
      this.createMockMiniProgram(tempDir, miniProgram.name);

      // 安全扫描
      if (this.config.security?.autoScan !== false) {
        console.log('开始进行安全扫描...');
        const scanResult = await securityScanner.scanMiniProgram(tempDir);
        
        if (!scanResult.passed) {
          console.error('更新包安全扫描失败:', scanResult.issues);
          throw new Error(`更新包安全扫描失败: ${scanResult.issues.map(issue => issue.description).join(', ')}`);
        }
        console.log('安全扫描通过');
      }

      // 备份当前版本
      const backupDir = `${miniProgram.path}.bak.${Date.now()}`;
      if (fs.existsSync(miniProgram.path)) {
        fs.renameSync(miniProgram.path, backupDir);
      }

      try {
        // 安装更新包
        fs.cpSync(tempDir, miniProgram.path, { recursive: true });
        console.log(`小程序更新完成，安装到: ${miniProgram.path}`);

        // 更新信息
        miniProgram.lastUpdated = new Date().toISOString();
        await this.saveInstalledApps();

        // 清理备份
        if (fs.existsSync(backupDir)) {
          fs.rmSync(backupDir, { recursive: true, force: true });
        }
      } catch (installError) {
        console.error('安装更新包失败，回滚到备份版本:', installError);
        // 回滚到备份版本
        if (fs.existsSync(backupDir)) {
          if (fs.existsSync(miniProgram.path)) {
            fs.rmSync(miniProgram.path, { recursive: true, force: true });
          }
          fs.renameSync(backupDir, miniProgram.path);
        }
        throw installError;
      }
    } catch (error) {
      console.error('小程序更新失败:', error);
      throw error;
    } finally {
      // 清理临时目录
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }

    console.log('小程序更新成功');
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

    // 获取小程序信息
    const miniProgram = this.installedApps.find(app => app.id === appId && app.type === 'miniProgram');

    // 如果是小程序，进行安全检查
    if (miniProgram) {
      // 启动前再次进行快速安全扫描
      if (this.config.security?.autoScan !== false) {
        console.log(`启动前对小程序${appId}进行快速安全扫描...`);
        const scanResult = await securityScanner.scanMiniProgram(miniProgram.path);
        
        if (!scanResult.passed) {
          console.error('小程序安全扫描失败，拒绝启动:', scanResult.issues);
          throw new Error(`小程序安全扫描失败，拒绝启动: ${scanResult.issues.map(issue => issue.description).join(', ')}`);
        }
      }

      // 启动运行时监控
      if (this.config.security?.runtimeMonitoring !== false) {
        console.log(`启动小程序${appId}的运行时监控...`);
        securityScanner.startRuntimeMonitoring(appId);
      }

      // 更新小程序状态为运行中
      miniProgram.isRunning = true;
      await this.saveInstalledApps();
    }

    const window = await this.windowManager.createWindow(config.windows);
    window.loadURL(this.getAppUrl(config.name));

    // 设置窗口事件监听以支持运行时监控
    if (miniProgram && this.config.security?.runtimeMonitoring !== false) {
      this.setupRuntimeMonitoring(appId, window);
    }

    if (!this.appWindows.has(appId)) {
      this.appWindows.set(appId, []);
    }
    this.appWindows.get(appId)!.push(window);

    return window;
  }

  private setupRuntimeMonitoring(appId: string, window: Electron.BrowserWindow): void {
    // 设置窗口的事件监听以支持运行时监控
    let lastMemoryUsage = 0;
    let lastCpuUsage = 0;
    let networkRequests: any[] = [];
    let fileAccesses: any[] = [];
    let errors: any[] = [];
    let warnings: any[] = [];
    let eventCount = 0;

    // 定期收集性能数据
    const monitorInterval = setInterval(() => {
      // 获取窗口的性能数据
      window.webContents.getProcessId().then(pid => {
        // 模拟获取内存和CPU使用率
        // 实际项目中应该使用真实的系统API获取
        const memoryUsage = Math.random() * 100 + 50; // 50-150MB
        const cpuUsage = Math.random() * 20; // 0-20%

        // 记录运行时数据
        securityScanner.recordRuntimeData(appId, {
          memoryUsage,
          cpuUsage,
          networkRequests,
          fileAccesses,
          errors,
          warnings,
          eventCount
        });

        // 重置计数器
        networkRequests = [];
        fileAccesses = [];
        errors = [];
        warnings = [];
        eventCount = 0;
      });
    }, 5000); // 每5秒收集一次数据

    // 监听窗口关闭事件，清理监控
    window.on('closed', () => {
      clearInterval(monitorInterval);
      securityScanner.stopRuntimeMonitoring(appId);
      
      // 更新小程序状态
      const miniProgram = this.installedApps.find(app => app.id === appId && app.type === 'miniProgram');
      if (miniProgram) {
        miniProgram.isRunning = false;
        this.saveInstalledApps().catch(console.error);
      }
    });

    // 监听IPC消息，收集网络请求、文件访问等数据
    ipcMain.on(`mini-program-${appId}-network-request`, (_, request) => {
      networkRequests.push(request);
      eventCount++;
    });

    ipcMain.on(`mini-program-${appId}-file-access`, (_, access) => {
      fileAccesses.push(access);
      eventCount++;
    });

    ipcMain.on(`mini-program-${appId}-error`, (_, error) => {
      errors.push(error);
      eventCount++;
    });

    ipcMain.on(`mini-program-${appId}-warning`, (_, warning) => {
      warnings.push(warning);
      eventCount++;
    });
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

