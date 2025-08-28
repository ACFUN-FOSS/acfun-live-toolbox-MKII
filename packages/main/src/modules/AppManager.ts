import { AppModule } from '../AppModule.js';
import { ModuleContext } from '../ModuleContext.js';
import { ConfigManager } from '../utils/ConfigManager.js';
import { LogManager } from '../utils/LogManager.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class AppManager implements AppModule {
  private configManager: ConfigManager;
  private logManager: LogManager;
  private miniPrograms: Map<string, any> = new Map();

  constructor() {
    this.configManager = globalThis.configManager;
    this.logManager = globalThis.logManager;
  }

  // 小程序安装方法
  async installMiniProgram(packageUrl: string, version: string): Promise<boolean> {
    try {
      this.logManager.addLog('AppManager', `Installing mini-program from ${packageUrl}`, 'info');
      const response = await fetch(packageUrl);
      const manifest = await response.json();
      
      const installPath = path.join(app.getPath('userData'), 'mini-programs', manifest.appId);
      fs.mkdirSync(installPath, { recursive: true });
      
      // 下载小程序包
      const packageResponse = await fetch(manifest.downloadUrl);
      const buffer = await packageResponse.arrayBuffer();
      fs.writeFileSync(path.join(installPath, 'package.zip'), Buffer.from(buffer));
      
      // 记录已安装小程序
      const installedPrograms = this.configManager.readConfig().miniPrograms || [];
      installedPrograms.push({
        appId: manifest.appId,
        name: manifest.name,
        version,
        path: installPath,
        lastUpdated: new Date().toISOString()
      });
      
      this.configManager.writeConfig({ miniPrograms: installedPrograms });
      this.logManager.addLog('AppManager', `Successfully installed mini-program: ${manifest.name}`, 'info');
      return true;
    } catch (error) {
      this.logManager.addLog('AppManager', `Failed to install mini-program: ${error.message}`, 'error');
      return false;
    }
  }

  // 小程序更新方法
  async updateMiniProgram(appId: string): Promise<boolean> {
    try {
      const installedPrograms = this.configManager.readConfig().miniPrograms || [];
      const program = installedPrograms.find(p => p.appId === appId);
      if (!program) throw new Error('小程序未安装');
      
      // 获取最新版本信息
      const manifestUrl = `${program.path}/manifest.json`;
      const response = await fetch(manifestUrl);
      const manifest = await response.json();
      
      // 比较版本号
      if (manifest.version === program.version) return true;
      
      // 执行更新
      return this.installMiniProgram(manifestUrl, manifest.version);
    } catch (error) {
      this.logManager.addLog('AppManager', `Failed to update mini-program: ${error.message}`, 'error');
      return false;
    }
  }

  // 获取小程序市场应用列表
    async getMarketplaceApps(): Promise<any[]> {
      try {
        this.logManager.addLog('AppManager', 'Fetching marketplace apps', 'info');
        const response = await fetch('https://api.example.com/mini-programs/marketplace');
        if (!response.ok) {
          throw new Error(`Marketplace API request failed: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        this.logManager.addLog('AppManager', `Failed to fetch marketplace apps: ${error.message}`, 'error');
        return [];
      }
    }

    // 小程序状态管理
    async getMiniProgramStatus(appId: string): Promise<MiniProgramStatus> {
    return this.miniPrograms.has(appId) ? 'running' : 'not_installed';
  }

  async enable({ app }: ModuleContext): Promise<void> {
    this.logManager.addLog('AppManager', 'Enabling AppManager module', 'info');
    // 加载已安装的小程序
    const installedPrograms = this.configManager.readConfig().miniPrograms || [];
    installedPrograms.forEach(program => {
      this.miniPrograms.set(program.appId, program);
    });
  }

  async disable(): Promise<void> {
    this.logManager.addLog('AppManager', 'Disabling AppManager module', 'info');
    this.miniPrograms.clear();
  }
}