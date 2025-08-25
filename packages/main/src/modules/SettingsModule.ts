import { ConfigManager } from '../utils/ConfigManager.js';
import { existsSync, unlinkSync, readdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { app } from 'electron';

// 定义应用设置接口
interface AppSettings {
  syncStreamTool: boolean;
  streamToolPath: string;
  serverPort: number;
  signalingPort: number;
  cacheSize: string;
  // 可以根据需要添加更多设置项
}

// 默认设置
const DEFAULT_SETTINGS: AppSettings = {
  syncStreamTool: false,
  streamToolPath: '',
  serverPort: 1299,
  signalingPort: 4396,
  cacheSize: '0 MB'
};

class SettingsModule {
  private configManager: ConfigManager;
  private static instance: SettingsModule;

  private constructor() {
    this.configManager = new ConfigManager();
  }

  // 获取单例实例
  public static getInstance(): SettingsModule {
    if (!SettingsModule.instance) {
      SettingsModule.instance = new SettingsModule();
    }
    return SettingsModule.instance;
  }

  // 获取应用设置
  public async getSettings(): Promise<AppSettings> {
    try {
      const settings = await this.configManager.get('appSettings');
      return settings || DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  // 更新应用设置
  public async updateSettings(settings: Partial<AppSettings>): Promise<boolean> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await this.configManager.set('appSettings', updatedSettings);
      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      return false;
    }
  }

  // 打开设置文件夹
  public openSettingsFolder(folderType: string): void {
    try {
      let folderPath: string;
      switch (folderType) {
        case '文档':
          folderPath = join(app.getPath('documents'), app.getName());
          break;
        case '控制台':
          folderPath = this.configManager.getLogPath();
          break;
        case '配置':
        default:
          folderPath = this.configManager.getConfigPath();
          break;
      }
      // 使用electron的shell模块打开文件夹
      require('electron').shell.openPath(folderPath);
    } catch (error) {
      console.error('Error opening settings folder:', error);
    }
  }

  // 备份配置
  public async backupConfig(): Promise<string | null> {
    try {
      return await this.configManager.backupConfig();
    } catch (error) {
      console.error('Error backing up config:', error);
      return null;
    }
  }

  // 还原配置
  public async restoreConfig(backupPath: string): Promise<boolean> {
    try {
      return await this.configManager.importConfig(backupPath);
    } catch (error) {
      console.error('Error restoring config:', error);
      return false;
    }
  }

  // 选择推流工具路径
  public async selectStreamToolPath(): Promise<string | null> {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: '应用程序', extensions: ['exe'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        defaultPath: this.configManager.getConfigPath()
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    } catch (error) {
      console.error('Error selecting stream tool path:', error);
      return null;
    }
  }

  // 清理缓存
  public async clearCache(cacheType: string): Promise<boolean> {
    try {
      let cachePath: string;
      switch (cacheType) {
        case 'account':
          cachePath = join(this.configManager.getConfigPath(), 'account');
          break;
        case 'config':
          cachePath = join(this.configManager.getConfigPath(), 'cache');
          break;
        default:
          cachePath = join(homedir(), '.cache', app.getName());
          break;
      }

      if (existsSync(cachePath)) {
        // 删除缓存目录下的所有文件和子目录
        const { rmSync } = require('fs');
        rmSync(cachePath, { recursive: true, force: true });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }
}

export default SettingsModule.getInstance();