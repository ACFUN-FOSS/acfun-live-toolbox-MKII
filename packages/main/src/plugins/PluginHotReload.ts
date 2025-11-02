import { EventEmitter } from 'events';
// import { watch, FSWatcher } from 'chokidar';
import { join, dirname } from 'path';
import { existsSync, statSync } from 'fs';
import { pluginLogger } from './PluginLogger';

// 临时类型定义，直到chokidar依赖安装完成
interface FSWatcher {
  close(): void;
  on(event: string, listener: (...args: any[]) => void): this;
}

function watch(path: string, options?: any): FSWatcher {
  // 临时实现，返回一个空的watcher
  return {
    close: () => {},
    on: (event: string, listener: (...args: any[]) => void) => {
      // 临时空实现
      return {} as FSWatcher;
    }
  };
}

export interface HotReloadConfig {
  enabled: boolean;
  watchPatterns: string[];
  ignorePatterns: string[];
  debounceMs: number;
  maxRetries: number;
}

export interface ReloadEvent {
  pluginId: string;
  filePath: string;
  changeType: 'add' | 'change' | 'unlink';
  timestamp: number;
}

export interface ReloadResult {
  success: boolean;
  pluginId: string;
  error?: string;
  reloadTime: number;
}

/**
 * 插件热重载管理器
 * 监控插件文件变化并自动重载插件
 */
export class PluginHotReloadManager extends EventEmitter {
  private watchers = new Map<string, FSWatcher>();
  private reloadTimers = new Map<string, NodeJS.Timeout>();
  private reloadCounts = new Map<string, number>();
  private config: HotReloadConfig;

  constructor(config: Partial<HotReloadConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      watchPatterns: ['**/*.js', '**/*.ts', '**/*.json', '**/*.html', '**/*.css'],
      ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/logs/**'],
      debounceMs: 1000,
      maxRetries: 3,
      ...config
    };

    pluginLogger.info('Plugin hot reload manager initialized');
  }

  /**
   * 开始监控插件目录
   */
  startWatching(pluginId: string, pluginPath: string): boolean {
    if (!this.config.enabled) {
      pluginLogger.debug('Hot reload disabled, skipping watch setup', pluginId);
      return false;
    }

    if (this.watchers.has(pluginId)) {
      pluginLogger.warn('Plugin already being watched', pluginId);
      return false;
    }

    if (!existsSync(pluginPath)) {
      pluginLogger.error('Plugin path does not exist', pluginId);
      return false;
    }

    try {
      const watcher = watch(pluginPath, {
        ignored: this.config.ignorePatterns,
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        depth: 10
      });

      // 监听文件变化事件
      watcher.on('add', (filePath) => this.handleFileChange(pluginId, filePath, 'add'));
      watcher.on('change', (filePath) => this.handleFileChange(pluginId, filePath, 'change'));
      watcher.on('unlink', (filePath) => this.handleFileChange(pluginId, filePath, 'unlink'));

      // 监听错误事件
      watcher.on('error', (error) => {
        pluginLogger.error('File watcher error', pluginId);
        this.emit('watch-error', { pluginId, error: error.message });
      });

      this.watchers.set(pluginId, watcher);
      this.reloadCounts.set(pluginId, 0);

      pluginLogger.info('Started watching plugin files', pluginId, { path: pluginPath });
      this.emit('watch-started', { pluginId, path: pluginPath });

      return true;
    } catch (error) {
      pluginLogger.error('Failed to start watching plugin files', pluginId);
      return false;
    }
  }

  /**
   * 停止监控插件目录
   */
  stopWatching(pluginId: string): boolean {
    const watcher = this.watchers.get(pluginId);
    if (!watcher) {
      return false;
    }

    try {
      watcher.close();
      this.watchers.delete(pluginId);
      
      // 清理定时器
      const timer = this.reloadTimers.get(pluginId);
      if (timer) {
        clearTimeout(timer);
        this.reloadTimers.delete(pluginId);
      }

      this.reloadCounts.delete(pluginId);

      pluginLogger.info('Stopped watching plugin files', pluginId);
      this.emit('watch-stopped', { pluginId });

      return true;
    } catch (error) {
      pluginLogger.error('Failed to stop watching plugin files', pluginId);
      return false;
    }
  }

  /**
   * 处理文件变化事件
   */
  private handleFileChange(pluginId: string, filePath: string, changeType: 'add' | 'change' | 'unlink'): void {
    // 检查文件是否匹配监控模式
    if (!this.shouldWatchFile(filePath)) {
      return;
    }

    const reloadEvent: ReloadEvent = {
      pluginId,
      filePath,
      changeType,
      timestamp: Date.now()
    };

    pluginLogger.debug('File change detected', pluginId);

    this.emit('file-changed', reloadEvent);

    // 防抖处理：清除之前的定时器，设置新的定时器
    const existingTimer = this.reloadTimers.get(pluginId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.triggerReload(pluginId, reloadEvent);
      this.reloadTimers.delete(pluginId);
    }, this.config.debounceMs);

    this.reloadTimers.set(pluginId, timer);
  }

  /**
   * 触发插件重载
   */
  private async triggerReload(pluginId: string, reloadEvent: ReloadEvent): Promise<void> {
    const startTime = Date.now();
    const currentRetries = this.reloadCounts.get(pluginId) || 0;

    if (currentRetries >= this.config.maxRetries) {
      pluginLogger.warn('Max reload retries exceeded', pluginId);
      
      this.emit('reload-failed', {
        success: false,
        pluginId,
        error: 'Max retries exceeded',
        reloadTime: Date.now() - startTime
      } as ReloadResult);
      
      return;
    }

    try {
      pluginLogger.info('Triggering plugin reload', pluginId);

      // 发出重载请求事件
      this.emit('reload-requested', { pluginId, reloadEvent });

      // 增加重试计数
      this.reloadCounts.set(pluginId, currentRetries + 1);

      // 重载成功后重置计数
      setTimeout(() => {
        this.reloadCounts.set(pluginId, 0);
      }, 5000); // 5秒后重置计数

      const reloadResult: ReloadResult = {
        success: true,
        pluginId,
        reloadTime: Date.now() - startTime
      };

      this.emit('reload-completed', reloadResult);
      pluginLogger.info('Plugin reload completed', pluginId);

    } catch (error) {
      const reloadResult: ReloadResult = {
        success: false,
        pluginId,
        error: (error as Error).message,
        reloadTime: Date.now() - startTime
      };

      this.emit('reload-failed', reloadResult);
      pluginLogger.error('Plugin reload failed', pluginId);
    }
  }

  /**
   * 检查文件是否应该被监控
   */
  private shouldWatchFile(filePath: string): boolean {
    const fileName = filePath.toLowerCase();
    
    // 检查是否匹配监控模式
    const matchesPattern = this.config.watchPatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(fileName);
    });

    if (!matchesPattern) {
      return false;
    }

    // 检查是否被忽略
    const isIgnored = this.config.ignorePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(fileName);
    });

    return !isIgnored;
  }

  /**
   * 获取相对路径（用于日志显示）
   */
  private getRelativePath(filePath: string): string {
    try {
      const cwd = process.cwd();
      return filePath.startsWith(cwd) ? filePath.substring(cwd.length + 1) : filePath;
    } catch {
      return filePath;
    }
  }

  /**
   * 获取插件的监控状态
   */
  getWatchStatus(pluginId: string): {
    isWatching: boolean;
    reloadCount: number;
    lastReload?: number;
  } {
    return {
      isWatching: this.watchers.has(pluginId),
      reloadCount: this.reloadCounts.get(pluginId) || 0,
      lastReload: undefined // TODO: 实现最后重载时间跟踪
    };
  }

  /**
   * 获取所有监控的插件
   */
  getWatchedPlugins(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * 更新热重载配置
   */
  updateConfig(newConfig: Partial<HotReloadConfig>): void {
    this.config = { ...this.config, ...newConfig };
    pluginLogger.info('Hot reload config updated', undefined, { config: this.config });
    this.emit('config-updated', this.config);
  }

  /**
   * 手动触发插件重载
   */
  async manualReload(pluginId: string): Promise<ReloadResult> {
    const startTime = Date.now();

    try {
      pluginLogger.info('Manual plugin reload triggered', pluginId);

      const reloadEvent: ReloadEvent = {
        pluginId,
        filePath: 'manual',
        changeType: 'change',
        timestamp: Date.now()
      };

      this.emit('reload-requested', { pluginId, reloadEvent });

      const result: ReloadResult = {
        success: true,
        pluginId,
        reloadTime: Date.now() - startTime
      };

      this.emit('reload-completed', result);
      return result;

    } catch (error) {
      const result: ReloadResult = {
        success: false,
        pluginId,
        error: (error as Error).message,
        reloadTime: Date.now() - startTime
      };

      this.emit('reload-failed', result);
      return result;
    }
  }

  /**
   * 清理所有监控器
   */
  cleanup(): void {
    pluginLogger.info('Cleaning up hot reload manager');

    // 停止所有监控器
    for (const pluginId of Array.from(this.watchers.keys())) {
      this.stopWatching(pluginId);
    }

    // 清理所有定时器
    for (const timer of Array.from(this.reloadTimers.values())) {
      clearTimeout(timer);
    }
    this.reloadTimers.clear();

    // 清理计数器
    this.reloadCounts.clear();

    pluginLogger.info('Hot reload manager cleanup completed');
  }
}

// 创建全局实例
export const pluginHotReloadManager = new PluginHotReloadManager();