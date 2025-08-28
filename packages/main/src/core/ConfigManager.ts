import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
  createWriteStream,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import * as electron_data from 'electron-data';
import archiver from "archiver";
// 新增解压相关模块
import { createReadStream } from "fs";
import { Extract } from "unzipper";
import config from "./config.js";

// 新增：定义配置模式接口（扩展Record允许任意属性）


class ConfigManager {
  private configPath: string;
  private DEFAULT_CONFIG_PATH: string;
  constructor(customPath?: string) {
    this.DEFAULT_CONFIG_PATH = join(homedir(), globalThis.appName);
   
    // 初始化electron-data配置
    electron_data.config({
      filename: globalThis.appName,
      path: customPath || this.DEFAULT_CONFIG_PATH,
      autosave: true,
      prettysave: true
    });


    // 优先使用自定义路径，其次使用 conf 存储的路径，最后使用默认路径
    this.configPath = customPath || this.DEFAULT_CONFIG_PATH;
    this.ensureConfigDirectoryExists();
    // 异步初始化配置
    this.initializeConfig().catch(err => console.error('配置初始化失败:', err));
  }

  // 新增异步初始化方法
  private async initializeConfig(): Promise<void> {
    // 如果没有自定义路径，尝试从electron-data获取保存的路径
    if (!this.configPath) {
      const savedPath = await electron_data.get("configPath");
      this.configPath = savedPath || this.DEFAULT_CONFIG_PATH;
    }
    await electron_data.set("configPath", this.configPath);
    await this.readConfig(undefined);
  }

  // 实现配置读写方法
  async get(key: string): Promise<any> {
    return await electron_data.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    await electron_data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await electron_data.unset(key);
  }

  // 获取当前配置路径
  getConfigPath(appName?: string): string {
    return join(this.configPath, appName || "");
  }

  // 设置新的配置路径并迁移配置
  setConfigPath(
    newPath: string,
    migrateCallback?: (oldPath: string, newPath: string, file: string) => void
  ): void {
    const oldPath = this.configPath;
    this.configPath = newPath;

    this.ensureConfigDirectoryExists();
    this.migrateConfigs(oldPath, newPath, migrateCallback);
  }

  // 迁移配置文件
  private migrateConfigs(
    oldPath: string,
    newPath: string,
    migrateCallback?: (oldPath: string, newPath: string, file: string) => void
  ): void {
    if (existsSync(oldPath)) {
      const files = readdirSync(oldPath);
      files.forEach((file) => {
        if (file.endsWith(".json")) {
          const oldFilePath = join(oldPath, file);
          const newFilePath = join(newPath, file);

          if (migrateCallback) {
            migrateCallback(oldPath, newPath, file);
          } else {
            copyFileSync(oldFilePath, newFilePath);
            unlinkSync(oldFilePath);
          }
        }
      });
      // 删除空的旧目录
      rmdirSync(oldPath);
    }
  }

  // 确保配置目录存在
  private ensureConfigDirectoryExists(): void {
    if (!existsSync(this.configPath)) {
      mkdirSync(this.configPath, { recursive: true });
    }
  }

  // 获取配置文件路径
  private getConfigFilePath(appName?: string): string {
    return join(this.getConfigPath(appName), `config.json`);
  }

  // 读取配置
  async readConfig(appName: string | undefined): Promise<any> {
    const filePath = this.getConfigFilePath(appName);
    const targetDir = this.getConfigPath(appName);

    // 判断 appName 为空，且目标目录不存在或目录为空
    if (
      !appName &&
      (!existsSync(targetDir) || readdirSync(targetDir).length === 0)
    ) {
      // 保存默认配置
      this.saveConfig(appName, config);
      return config;
    }

    if (existsSync(filePath)) {
      const data = readFileSync(filePath, "utf8");
      return JSON.parse(data);
    }
    return {};
  }

  // 保存配置
  saveConfig(appName: string | undefined, configData: any): any {
    const filePath = this.getConfigFilePath(appName);
    const jsonData = JSON.stringify(configData, null, 2);
    writeFileSync(filePath, jsonData, "utf8");
    return configData;
  }

  // 备份配置
  async backupConfig(): Promise<string | null> {
    const originalPath = this.getConfigPath("");
    if (!existsSync(originalPath)) {
      return null;
    }
    const backupFileName = `${globalThis.appName}_backup_${Date.now()}.zip`;
    const backupPath = join(this.configPath, backupFileName);

    const output = createWriteStream(backupPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // 压缩级别
    });

    // 监听完成事件
    await new Promise((resolve, reject) => {
      output.on("close", () => {
        resolve(backupPath);
      });

      archive.on("error", (err: Error) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(originalPath, false);
      archive.finalize();
    });

    return backupPath;
  }

  // 导入配置
  async importConfig(zipFilePath: string): Promise<boolean> {
    try {
      if (!existsSync(zipFilePath)) {
        return false;
      }

      // 备份当前配置
      const backupPath = await this.backupConfig();
      if (!backupPath) {
        console.warn("备份当前配置失败，可能无配置文件需要备份");
      }

      // 确保配置目录存在
      this.ensureConfigDirectoryExists();

      const readStream = createReadStream(zipFilePath);
      const extract = Extract({ path: this.configPath });

      await new Promise((resolve, reject) => {
        readStream.pipe(extract).on("close", resolve).on("error", reject);
      });

      return true;
    } catch (error) {
      console.error("导入配置失败:", error);
      return false;
    }
  }
}

export { ConfigManager };