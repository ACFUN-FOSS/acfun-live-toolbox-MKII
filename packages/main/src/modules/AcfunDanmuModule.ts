import type { AppModule } from '../AppModule.js';
import { ModuleContext } from '../ModuleContext.js';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { getPackageJson } from '../utils/Devars.js';
import { getLogManager } from '../utils/LogManager.js';

// 定义配置接口
interface AcfunDanmuConfig {
  port: number;
  debug: boolean;
  connectionMode: 'tcp' | 'ws';
  logLevel: 'info' | 'debug' | 'error';
}

// 默认配置
const DEFAULT_CONFIG: AcfunDanmuConfig = {
  port: 15368, // 确保与主进程HTTP服务端口(3000)不冲突
  debug: false,
  connectionMode: 'ws',
  logLevel: 'info'
};

export class AcfunDanmuModule implements AppModule {
  private process: ChildProcess | null = null;
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
  private async start(): Promise<void> {
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

export const acfunDanmuModule = getAcfunDanmuModule();