//管理小程序

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

  constructor() {
    super();
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

