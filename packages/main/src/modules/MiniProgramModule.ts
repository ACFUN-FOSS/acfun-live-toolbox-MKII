import { EventEmitter } from 'events';
import { existsSync, readdirSync, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * 小程序元数据接口
 */
interface MiniProgramMetadata {
  appId: string;
  name: string;
  description: string;
  version: string;
  author: string;
  entry: string;
  icon: string;
  permissions: string[];
}

/**
 * 小程序实例接口
 */
interface MiniProgramInstance {
  appId: string;
  metadata: MiniProgramMetadata;
  isRunning: boolean;
  pid?: number;
  windowId?: number;
}

/**
 * 小程序系统模块
 * 负责小程序的管理、运行和市场功能
 */
export class MiniProgramModule extends EventEmitter {
  private miniProgramsPath: string;
  private installedPrograms: Map<string, MiniProgramMetadata>;
  private runningPrograms: Map<string, MiniProgramInstance>;

  constructor() {
    super();
    this.miniProgramsPath = join(__dirname, '../../mini-programs');
    this.installedPrograms = new Map();
    this.runningPrograms = new Map();
    this.initialize();
  }

  /**
   * 初始化小程序系统
   */
  private async initialize(): Promise<void> {
    // 创建小程序目录
    await this.ensureDirectoryExists(this.miniProgramsPath);
    // 加载已安装的小程序
    await this.loadInstalledPrograms();
    this.emit('initialized');
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(path: string): Promise<void> {
    if (!await existsSync(path)) {
      await fs.mkdir(path, { recursive: true });
    }
  }

  /**
   * 加载已安装的小程序
   */
  private async loadInstalledPrograms(): Promise<void> {
    const entries = await readdirSync(this.miniProgramsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const appId = entry.name;
        const manifestPath = join(this.miniProgramsPath, appId, 'manifest.json');
        if (await existsSync(manifestPath)) {
          try {
            const manifestContent = await readFile(manifestPath, 'utf-8');
            const metadata: MiniProgramMetadata = JSON.parse(manifestContent);
            this.installedPrograms.set(appId, metadata);
          } catch (error) {
            console.error(`Failed to load manifest for ${appId}:`, error);
          }
        }
      }
    }
  }

  /**
   * 获取已安装的小程序列表
   */
  public getInstalledPrograms(): MiniProgramMetadata[] {
    return Array.from(this.installedPrograms.values());
  }

  /**
   * 启动小程序
   */
  public async startProgram(appId: string): Promise<MiniProgramInstance | null> {
    if (this.runningPrograms.has(appId)) {
      return this.runningPrograms.get(appId) || null;
    }

    const metadata = this.installedPrograms.get(appId);
    if (!metadata) {
      throw new Error(`Program ${appId} not installed`);
    }

    // 这里实现小程序启动逻辑
    const instance: MiniProgramInstance = {
      appId,
      metadata,
      isRunning: true
    };

    this.runningPrograms.set(appId, instance);
    this.emit('programStarted', instance);
    return instance;
  }

  /**
   * 停止小程序
   */
  public async stopProgram(appId: string): Promise<boolean> {
    const instance = this.runningPrograms.get(appId);
    if (!instance) return false;

    // 这里实现小程序停止逻辑
    instance.isRunning = false;
    this.runningPrograms.delete(appId);
    this.emit('programStopped', appId);
    return true;
  }

  /**
   * 获取运行中的小程序
   */
  public getRunningPrograms(): MiniProgramInstance[] {
    return Array.from(this.runningPrograms.values());
  }
}

export default new MiniProgramModule();