import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ConfigManager } from './ConfigManager.js';
import { HttpManager } from './HttpManager.js';
import { WindowManager, WindowConfig } from '../modules/WindowManager.js';
import { getPackageJson } from './Devars.js';
import {app} from 'electron';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

interface AppConfig {
  id: string;
  name: string;
  version: string;
  info?: string;
  settings?: Record<string, any>;
  windows: WindowConfig;
}

export class AppManager {
  private apps: Map<string, AppConfig> = new Map();
  private appWindows: Map<string, Electron.BrowserWindow[]> = new Map();
  private httpManager: HttpManager = globalThis.httpManager;
  private windowManager: WindowManager = globalThis.windowManager;
  private appDir: string = "";
  private configManager: ConfigManager = globalThis.configManager;

  constructor() {
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
      const apiPath = path.join(folder, "api.js");
      if (fs.existsSync(apiPath)) {
        const apiRoutes = require(apiPath);
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

  getAppConfig(appId: string): AppConfig | undefined {
    return this.apps.get(appId);
  }

  async readAppConfig(appId: string): Promise<AppConfig> {
    const config = this.apps.get(appId);
    if (!config) {
      throw new Error(`App ${appId} not found`);
    }
    return this.configManager.readConfig(config.name) || config;
  }

  async saveAppConfig(appId: string, configData: AppConfig): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App ${appId} not found`);
    }
    await this.configManager.saveConfig(app.name, configData);
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
      this.httpManager.removeApiRoutes(`/api/application/${app.name}`);
    });

    // 重新初始化
    this.apps.clear();
    await this.init();
  }
}