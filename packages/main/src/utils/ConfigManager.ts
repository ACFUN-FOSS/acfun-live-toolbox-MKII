import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, rmdirSync, createWriteStream } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import Conf from 'conf';
import archiver from 'archiver';
// 新增解压相关模块
import { createReadStream } from 'fs';
import { Extract } from 'unzipper';
import config from './config.js';

// 默认配置路径
const DEFAULT_CONFIG_PATH = join(homedir(), globalThis.appName);
// 使用 conf 实例来保存配置路径
const configStore = new Conf({
  projectName: globalThis.appName, // 替换为你的应用名称
  schema: {
    configPath: {
      type: "string",
      default: DEFAULT_CONFIG_PATH, // 替换为你的应用名称
    },
  },
});

// 配置管理器类
class ConfigManager {
  private configPath: string;

  constructor(customPath?: string) {
    // 优先使用自定义路径，其次使用 conf 存储的路径，最后使用默认路径
    this.configPath =
      customPath ||
      (configStore.get("configPath") as string) ||
      DEFAULT_CONFIG_PATH;
    this.ensureConfigDirectoryExists();
    configStore.set("configPath", this.configPath);

    // 调用 readConfig 方法
    this.readConfig(undefined);
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
  readConfig(appName: string|undefined): any {
    const filePath = this.getConfigFilePath(appName);
    const targetDir = this.getConfigPath(appName);

    // 判断 appName 为空，且目标目录不存在或目录为空
    if (!appName && (!existsSync(targetDir) || readdirSync(targetDir).length === 0)) {
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
  saveConfig(appName: string|undefined, configData: any): void {
    const filePath = this.getConfigFilePath(appName);
    const jsonData = JSON.stringify(configData, null, 2);
    writeFileSync(filePath, jsonData, "utf8");
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
    const archive = archiver('zip', {
      zlib: { level: 9 } // 压缩级别
    });

    // 监听完成事件
    await new Promise((resolve, reject) => {
      output.on('close', () => {
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
        console.warn('备份当前配置失败，可能无配置文件需要备份');
      }

      // 确保配置目录存在
      this.ensureConfigDirectoryExists();

      const readStream = createReadStream(zipFilePath);
      const extract = Extract({ path: this.configPath });

      await new Promise((resolve, reject) => {
        readStream
          .pipe(extract)
          .on('close', resolve)
          .on('error', reject);
      });

      return true;
    } catch (error) {
      console.error('导入配置失败:', error);
      return false;
    }
  }
}

export { ConfigManager };