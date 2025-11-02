import { EventEmitter } from 'events';
import { PluginInfo, PluginManifest } from './PluginManager';
import { pluginLogger } from './PluginLogger';
import { pluginLifecycleManager } from './PluginLifecycle';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * 更新检查结果
 */
export interface UpdateCheckResult {
  pluginId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  updateUrl?: string;
  changelog?: string;
  critical?: boolean;
  size?: number;
}

/**
 * 更新进度信息
 */
export interface UpdateProgress {
  pluginId: string;
  stage: 'downloading' | 'extracting' | 'installing' | 'completing';
  progress: number; // 0-100
  message: string;
}

/**
 * 更新配置
 */
export interface UpdateConfig {
  autoCheck: boolean;
  autoDownload: boolean;
  autoInstall: boolean;
  checkInterval: number; // 毫秒
  backupBeforeUpdate: boolean;
  rollbackOnFailure: boolean;
}

/**
 * 备份信息
 */
export interface BackupInfo {
  pluginId: string;
  version: string;
  backupPath: string;
  timestamp: number;
  size: number;
}

/**
 * 插件更新管理器
 */
export class PluginUpdater extends EventEmitter {
  private config: UpdateConfig;
  private updateChecks: Map<string, UpdateCheckResult> = new Map();
  private backups: Map<string, BackupInfo[]> = new Map();
  private updateQueue: Set<string> = new Set();
  private checkTimer?: NodeJS.Timeout;
  private backupDir: string;

  constructor(
    private pluginsDir: string,
    config: Partial<UpdateConfig> = {}
  ) {
    super();
    
    this.config = {
      autoCheck: false,
      autoDownload: false,
      autoInstall: false,
      checkInterval: 24 * 60 * 60 * 1000, // 24小时
      backupBeforeUpdate: true,
      rollbackOnFailure: true,
      ...config
    };

    this.backupDir = path.join(this.pluginsDir, '.backups');
    this.ensureBackupDirectory();
    
    if (this.config.autoCheck) {
      this.startAutoCheck();
    }
  }

  /**
   * 确保备份目录存在
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 开始自动检查更新
   */
  public startAutoCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(() => {
      this.checkAllUpdates().catch(error => {
        pluginLogger.error('自动检查更新失败');
      });
    }, this.config.checkInterval);

    pluginLogger.info(`已启动自动更新检查，间隔: ${this.config.checkInterval}ms`);
  }

  /**
   * 停止自动检查更新
   */
  public stopAutoCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      pluginLogger.info('已停止自动更新检查');
    }
  }

  /**
   * 检查单个插件的更新
   */
  public async checkUpdate(plugin: PluginInfo): Promise<UpdateCheckResult> {
    try {
      pluginLogger.debug(`检查插件更新: ${plugin.id}`);

      // 执行 beforeUpdate 钩子
      await pluginLifecycleManager.executeHook('beforeUpdate', {
        pluginId: plugin.id,
        plugin,
        manifest: plugin.manifest,
        context: { action: 'check' }
      });

      // 这里应该实现实际的更新检查逻辑
      // 例如：从插件仓库或更新服务器获取最新版本信息
      const result = await this.performUpdateCheck(plugin);
      
      this.updateChecks.set(plugin.id, result);
      
      if (result.hasUpdate) {
        this.emit('update.available', result);
        pluginLogger.info(`发现插件更新: ${plugin.id} ${result.currentVersion} -> ${result.latestVersion}`);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      pluginLogger.error(`检查插件更新失败: ${plugin.id}`);
      
      const result: UpdateCheckResult = {
        pluginId: plugin.id,
        currentVersion: plugin.version,
        latestVersion: plugin.version,
        hasUpdate: false
      };
      
      this.emit('update.check.error', { pluginId: plugin.id, error: err });
      return result;
    }
  }

  /**
   * 检查所有插件的更新
   */
  public async checkAllUpdates(plugins?: PluginInfo[]): Promise<UpdateCheckResult[]> {
    if (!plugins) {
      // 这里需要从 PluginManager 获取所有插件
      // 暂时返回空数组，实际使用时需要注入 PluginManager
      plugins = [];
    }

    const results: UpdateCheckResult[] = [];
    
    for (const plugin of plugins) {
      try {
        const result = await this.checkUpdate(plugin);
        results.push(result);
      } catch (error) {
        pluginLogger.error(`检查插件更新失败: ${plugin.id}`);
      }
    }

    this.emit('update.check.complete', results);
    return results;
  }

  /**
   * 执行实际的更新检查
   */
  private async performUpdateCheck(plugin: PluginInfo): Promise<UpdateCheckResult> {
    // 模拟更新检查逻辑
    // 实际实现应该：
    // 1. 从插件的 manifest 中获取更新源
    // 2. 请求远程服务器获取最新版本信息
    // 3. 比较版本号
    
    const result: UpdateCheckResult = {
      pluginId: plugin.id,
      currentVersion: plugin.version,
      latestVersion: plugin.version, // 暂时设为相同版本
      hasUpdate: false
    };

    // 这里应该实现真实的版本检查逻辑
    // 例如：HTTP 请求到插件仓库或更新服务器
    
    return result;
  }

  /**
   * 创建插件备份
   */
  public async createBackup(plugin: PluginInfo): Promise<BackupInfo> {
    const timestamp = Date.now();
    const backupName = `${plugin.id}_${plugin.version}_${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);

    try {
      // 复制插件目录到备份位置
      await this.copyDirectory(plugin.installPath, backupPath);
      
      // 计算备份大小
      const size = await this.getDirectorySize(backupPath);
      
      const backupInfo: BackupInfo = {
        pluginId: plugin.id,
        version: plugin.version,
        backupPath,
        timestamp,
        size
      };

      // 记录备份信息
      const pluginBackups = this.backups.get(plugin.id) || [];
      pluginBackups.push(backupInfo);
      this.backups.set(plugin.id, pluginBackups);

      // 清理旧备份（保留最近5个）
      await this.cleanupOldBackups(plugin.id, 5);

      pluginLogger.info(`创建插件备份: ${plugin.id} -> ${backupPath}`);
      this.emit('backup.created', backupInfo);

      return backupInfo;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      pluginLogger.error(`创建插件备份失败: ${plugin.id}`);
      throw err;
    }
  }

  /**
   * 恢复插件备份
   */
  public async restoreBackup(pluginId: string, backupInfo?: BackupInfo): Promise<void> {
    const pluginBackups = this.backups.get(pluginId) || [];
    
    if (!backupInfo) {
      // 使用最新的备份
      backupInfo = pluginBackups[pluginBackups.length - 1];
    }

    if (!backupInfo) {
      throw new Error(`没有找到插件 ${pluginId} 的备份`);
    }

    if (!fs.existsSync(backupInfo.backupPath)) {
      throw new Error(`备份文件不存在: ${backupInfo.backupPath}`);
    }

    try {
      const targetPath = path.join(this.pluginsDir, pluginId);
      
      // 删除当前插件目录
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }

      // 恢复备份
      await this.copyDirectory(backupInfo.backupPath, targetPath);

      pluginLogger.info(`恢复插件备份: ${pluginId} <- ${backupInfo.backupPath}`);
      this.emit('backup.restored', { pluginId, backupInfo });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      pluginLogger.error(`恢复插件备份失败: ${pluginId}`);
      throw err;
    }
  }

  /**
   * 更新插件
   */
  public async updatePlugin(
    pluginId: string,
    updateSource?: string
  ): Promise<void> {
    if (this.updateQueue.has(pluginId)) {
      throw new Error(`插件 ${pluginId} 正在更新中`);
    }

    this.updateQueue.add(pluginId);

    try {
      const updateResult = this.updateChecks.get(pluginId);
      if (!updateResult || !updateResult.hasUpdate) {
        throw new Error(`插件 ${pluginId} 没有可用更新`);
      }

      this.emit('update.start', { pluginId });

      // 下载更新
      this.emitProgress(pluginId, 'downloading', 0, '开始下载更新');
      const updateFile = await this.downloadUpdate(updateResult, updateSource);
      
      this.emitProgress(pluginId, 'downloading', 100, '下载完成');

      // 创建备份（如果启用）
      if (this.config.backupBeforeUpdate) {
        this.emitProgress(pluginId, 'installing', 10, '创建备份');
        // 这里需要获取当前插件信息来创建备份
        // 暂时跳过，实际使用时需要注入 PluginManager
      }

      // 安装更新
      this.emitProgress(pluginId, 'installing', 50, '安装更新');
      await this.installUpdate(pluginId, updateFile);

      this.emitProgress(pluginId, 'completing', 100, '更新完成');

      // 执行 afterUpdate 钩子
      await pluginLifecycleManager.executeHook('afterUpdate', {
        pluginId,
        context: { 
          action: 'update',
          fromVersion: updateResult.currentVersion,
          toVersion: updateResult.latestVersion
        }
      });

      this.emit('update.complete', { pluginId, result: updateResult });
      pluginLogger.info(`插件更新完成: ${pluginId} ${updateResult.currentVersion} -> ${updateResult.latestVersion}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      pluginLogger.error(`插件更新失败: ${pluginId}`);

      // 如果启用了失败回滚
      if (this.config.rollbackOnFailure) {
        try {
          await this.restoreBackup(pluginId);
          pluginLogger.info(`已回滚插件: ${pluginId}`);
        } catch (rollbackError) {
          pluginLogger.error(`回滚插件失败: ${pluginId}`);
        }
      }

      this.emit('update.error', { pluginId, error: err });
      throw err;
    } finally {
      this.updateQueue.delete(pluginId);
    }
  }

  /**
   * 下载更新文件
   */
  private async downloadUpdate(
    updateResult: UpdateCheckResult,
    updateSource?: string
  ): Promise<string> {
    // 模拟下载逻辑
    // 实际实现应该从 updateResult.updateUrl 或 updateSource 下载文件
    const tempFile = path.join(this.pluginsDir, '.temp', `${updateResult.pluginId}_update.zip`);
    
    // 确保临时目录存在
    const tempDir = path.dirname(tempFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 这里应该实现实际的下载逻辑
    // 暂时创建一个空文件
    fs.writeFileSync(tempFile, '');
    
    return tempFile;
  }

  /**
   * 安装更新
   */
  private async installUpdate(pluginId: string, updateFile: string): Promise<void> {
    // 这里应该实现实际的安装逻辑
    // 1. 解压更新文件
    // 2. 验证插件
    // 3. 替换旧文件
    // 4. 更新配置
    
    pluginLogger.debug(`安装插件更新: ${pluginId} from ${updateFile}`);
  }

  /**
   * 发出进度事件
   */
  private emitProgress(
    pluginId: string,
    stage: UpdateProgress['stage'],
    progress: number,
    message: string
  ): void {
    const progressData: UpdateProgress = {
      pluginId,
      stage,
      progress,
      message
    };
    
    this.emit('update.progress', progressData);
  }

  /**
   * 复制目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true });
    
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 获取目录大小
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        size += await this.getDirectorySize(fullPath);
      } else {
        const stats = await fs.promises.stat(fullPath);
        size += stats.size;
      }
    }
    
    return size;
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(pluginId: string, keepCount: number): Promise<void> {
    const pluginBackups = this.backups.get(pluginId) || [];
    
    if (pluginBackups.length <= keepCount) {
      return;
    }

    // 按时间戳排序，保留最新的
    pluginBackups.sort((a, b) => b.timestamp - a.timestamp);
    const toDelete = pluginBackups.slice(keepCount);

    for (const backup of toDelete) {
      try {
        if (fs.existsSync(backup.backupPath)) {
          fs.rmSync(backup.backupPath, { recursive: true, force: true });
        }
        
        const index = pluginBackups.indexOf(backup);
        if (index !== -1) {
          pluginBackups.splice(index, 1);
        }
        
        pluginLogger.debug(`删除旧备份: ${backup.backupPath}`);
      } catch (error) {
        pluginLogger.error(`删除备份失败: ${backup.backupPath}`);
      }
    }

    this.backups.set(pluginId, pluginBackups);
  }

  /**
   * 获取插件的备份列表
   */
  public getBackups(pluginId: string): BackupInfo[] {
    return [...(this.backups.get(pluginId) || [])];
  }

  /**
   * 获取更新检查结果
   */
  public getUpdateCheck(pluginId: string): UpdateCheckResult | undefined {
    return this.updateChecks.get(pluginId);
  }

  /**
   * 获取所有更新检查结果
   */
  public getAllUpdateChecks(): UpdateCheckResult[] {
    return Array.from(this.updateChecks.values());
  }

  /**
   * 获取配置
   */
  public getConfig(): UpdateConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<UpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.autoCheck !== undefined) {
      if (newConfig.autoCheck) {
        this.startAutoCheck();
      } else {
        this.stopAutoCheck();
      }
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.stopAutoCheck();
    this.updateChecks.clear();
    this.backups.clear();
    this.updateQueue.clear();
    this.removeAllListeners();
    pluginLogger.debug('插件更新管理器已清理');
  }
}