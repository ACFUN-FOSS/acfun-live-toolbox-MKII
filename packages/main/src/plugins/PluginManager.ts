import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { ApiServer } from '../server/ApiServer';
import { RoomManager } from '../rooms/RoomManager';
import { DatabaseManager } from '../persistence/DatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import { ApiBridge, PluginAPI } from './ApiBridge';
import { PopupManager } from './PopupManager';
import { pluginLogger } from './PluginLogger';
import { pluginErrorHandler, ErrorType, RecoveryAction } from './PluginErrorHandler';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  minAppVersion?: string;
  maxAppVersion?: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  status: 'installed' | 'enabled' | 'disabled' | 'error' | 'loading';
  installPath: string;
  manifest: PluginManifest;
  installedAt: number;
  lastError?: string;
}

export interface PluginInstallOptions {
  filePath: string;
  overwrite?: boolean;
  enable?: boolean;
}

export interface PluginManagerEvents {
  'plugin.suspended': { id: string; reason: string };
  'plugin.installed': { plugin: PluginInfo };
  'plugin.uninstalled': { id: string };
  'plugin.enabled': { id: string };
  'plugin.disabled': { id: string };
  'plugin.error': { id: string; error: string };
  'plugin.install.progress': { id: string; progress: number; message: string };
}

/**
 * PluginManager 负责插件生命周期与受控 API 提供。
 * 目前阶段实现：为插件创建 ApiBridge、代理路由注册、后续扩展安装/启用/暂停。
 */
export class PluginManager extends TypedEventEmitter<PluginManagerEvents> {
  private apiServer: ApiServer;
  private roomManager: RoomManager;
  private databaseManager: DatabaseManager;
  private configManager: ConfigManager;
  private popupManager: PopupManager;
  private plugins: Map<string, PluginInfo> = new Map();
  private pluginsDir: string;

  constructor(opts: {
    apiServer: ApiServer;
    roomManager: RoomManager;
    databaseManager: DatabaseManager;
    configManager: ConfigManager;
  }) {
    super();
    this.apiServer = opts.apiServer;
    this.roomManager = opts.roomManager;
    this.databaseManager = opts.databaseManager;
    this.configManager = opts.configManager;
    this.popupManager = new PopupManager();
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.ensurePluginsDirectory();
    this.setupErrorHandling();
    this.loadInstalledPlugins();
  }

  private setupErrorHandling(): void {
    // 监听错误处理器的恢复事件
    pluginErrorHandler.on('recovery-execute', async (event) => {
      const { pluginId, action } = event;
      
      try {
        switch (action) {
          case RecoveryAction.DISABLE:
            await this.disablePlugin(pluginId);
            break;
          case RecoveryAction.UNINSTALL:
            await this.uninstallPlugin(pluginId);
            break;
          case RecoveryAction.RETRY:
            // 重试逻辑将在具体的操作方法中处理
            break;
          case RecoveryAction.REINSTALL:
            // 重新安装需要原始安装文件，这里先记录日志
            pluginLogger.warn(`Reinstall requested for plugin but no source file available`, pluginId);
            break;
        }
      } catch (error) {
        pluginLogger.error(`Failed to execute recovery action: ${action}`, pluginId, error as Error);
      }
    });
  }

  private ensurePluginsDirectory(): void {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  private loadInstalledPlugins(): void {
    pluginLogger.info('Loading installed plugins');
    
    try {
      const pluginDirs = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      pluginLogger.info(`Found ${pluginDirs.length} plugin directories`);

      for (const pluginId of pluginDirs) {
        try {
          const pluginPath = path.join(this.pluginsDir, pluginId);
          const manifestPath = path.join(pluginPath, 'manifest.json');
          
          if (fs.existsSync(manifestPath)) {
             const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest;
             const configKey = `plugins.${pluginId}`;
             const pluginConfig = this.configManager.get(configKey, { enabled: false, installedAt: Date.now() });
             
             const pluginInfo: PluginInfo = {
               id: pluginId,
               name: manifest.name,
               version: manifest.version,
               description: manifest.description,
               author: manifest.author,
               enabled: pluginConfig.enabled,
               status: pluginConfig.enabled ? 'enabled' : 'disabled',
               installPath: pluginPath,
               manifest,
               installedAt: pluginConfig.installedAt || Date.now()
             };
            
            this.plugins.set(pluginId, pluginInfo);
            pluginLogger.info(`Loaded plugin: ${manifest.name} v${manifest.version}`, pluginId);
          } else {
            pluginLogger.warn(`Plugin directory missing manifest.json`, pluginId, { pluginPath });
          }
        } catch (error) {
          const errorMessage = `Failed to load plugin: ${error instanceof Error ? error.message : 'Unknown error'}`;
          pluginLogger.error(errorMessage, pluginId, error as Error);
          
          // 使用错误处理器处理加载失败
          pluginErrorHandler.handleError(
            pluginId,
            ErrorType.LOAD_FAILED,
            errorMessage,
            error as Error,
            { pluginPath: path.join(this.pluginsDir, pluginId) }
          );
          
          // 创建错误状态的插件信息
          const errorPluginInfo: PluginInfo = {
            id: pluginId,
            name: pluginId,
            version: '0.0.0',
            enabled: false,
            status: 'error',
            installPath: path.join(this.pluginsDir, pluginId),
            manifest: {
              id: pluginId,
              name: pluginId,
              version: '0.0.0',
              main: 'index.js'
            },
            installedAt: Date.now(),
            lastError: errorMessage
          };
          
          this.plugins.set(pluginId, errorPluginInfo);
        }
      }
      
      pluginLogger.info(`Successfully loaded ${this.plugins.size} plugins`);
    } catch (error) {
      const errorMessage = `Failed to load installed plugins: ${error instanceof Error ? error.message : 'Unknown error'}`;
      pluginLogger.error(errorMessage, undefined, error as Error);
      
      pluginErrorHandler.handleError(
        'system',
        ErrorType.LOAD_FAILED,
        errorMessage,
        error as Error,
        { pluginsDir: this.pluginsDir }
      );
    }
  }

  /**
   * 获取所有已安装的插件信息
   */
  public getInstalledPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取指定插件信息
   */
  public getPlugin(pluginId: string): PluginInfo | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 安装插件
   */
  public async installPlugin(options: PluginInstallOptions): Promise<PluginInfo> {
    const { filePath, overwrite = false, enable = false } = options;
    let tempDir: string | undefined;
    let pluginId = 'unknown';
    
    pluginLogger.info('Starting plugin installation', undefined, { filePath, overwrite, enable });
    this.emit('plugin.install.progress', { id: 'temp', progress: 0, message: '开始安装插件...' });
    
    try {
      // 验证文件存在
      if (!fs.existsSync(filePath)) {
        throw new Error('插件文件不存在');
      }

      // 解压插件文件到临时目录
      tempDir = path.join(this.pluginsDir, '.temp', crypto.randomUUID());
      await this.extractPlugin(filePath, tempDir);
      
      this.emit('plugin.install.progress', { id: 'temp', progress: 30, message: '解压插件文件...' });

      // 验证插件清单
      const manifest = await this.validatePluginManifest(tempDir);
      pluginId = manifest.id;
      
      pluginLogger.info(`Installing plugin: ${manifest.name} v${manifest.version}`, pluginId);
      this.emit('plugin.install.progress', { id: manifest.id, progress: 50, message: '验证插件清单...' });

      // 检查插件是否已存在
      if (this.plugins.has(manifest.id) && !overwrite) {
        throw new Error(`插件 ${manifest.id} 已存在，请选择覆盖安装`);
      }

      // 检查依赖和冲突
      await this.checkDependencies(manifest);
      
      this.emit('plugin.install.progress', { id: manifest.id, progress: 70, message: '检查依赖关系...' });

      // 移动插件到最终目录
      const finalPath = path.join(this.pluginsDir, manifest.id);
      if (fs.existsSync(finalPath)) {
        fs.rmSync(finalPath, { recursive: true, force: true });
      }
      fs.renameSync(tempDir, finalPath);
      tempDir = undefined; // 标记已移动，避免清理
      
      this.emit('plugin.install.progress', { id: manifest.id, progress: 90, message: '安装插件文件...' });

      // 创建插件信息
      const pluginInfo: PluginInfo = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        enabled: enable,
        status: enable ? 'enabled' : 'disabled',
        installPath: finalPath,
        manifest,
        installedAt: Date.now()
      };

      // 保存插件配置
      const configKey = `plugins.${manifest.id}`;
      this.configManager.set(configKey, {
        enabled: enable,
        installedAt: pluginInfo.installedAt
      });

      this.plugins.set(manifest.id, pluginInfo);
      
      // 重置该插件的错误计数
      pluginErrorHandler.resetRetryCount(manifest.id);
      
      pluginLogger.info(`Successfully installed plugin: ${manifest.name} v${manifest.version}`, pluginId);
      this.emit('plugin.install.progress', { id: manifest.id, progress: 100, message: '安装完成' });
      this.emit('plugin.installed', { plugin: pluginInfo });

      return pluginInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      pluginLogger.error(`Failed to install plugin: ${errorMessage}`, pluginId, error as Error, { filePath });
      
      // 使用错误处理器处理安装失败
      const recoveryAction = await pluginErrorHandler.handleError(
        pluginId,
        ErrorType.INSTALL_FAILED,
        errorMessage,
        error as Error,
        { filePath, overwrite, enable }
      );
      
      // 清理临时文件
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          pluginLogger.warn(`Failed to cleanup temp directory: ${tempDir}`, pluginId, cleanupError as Error);
        }
      }
      
      this.emit('plugin.error', { id: pluginId, error: errorMessage });
      throw error;
    }
  }

  /**
   * 卸载插件
   */
  public async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 不存在`);
    }

    try {
      // 如果插件已启用，先禁用
      if (plugin.enabled) {
        await this.disablePlugin(pluginId);
      }

      // 删除插件文件
      if (fs.existsSync(plugin.installPath)) {
        fs.rmSync(plugin.installPath, { recursive: true, force: true });
      }

      // 删除插件配置
       const configKey = `plugins.${pluginId}`;
       this.configManager.delete(configKey);

      // 从内存中移除
      this.plugins.delete(pluginId);

      this.emit('plugin.uninstalled', { id: pluginId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.emit('plugin.error', { id: pluginId, error: errorMessage });
      throw error;
    }
  }

  /**
   * 启用插件
   */
  public async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 不存在`);
    }

    if (plugin.enabled) {
      return; // 已经启用
    }

    try {
      plugin.status = 'loading';
      
      // 检查依赖
      await this.checkDependencies(plugin.manifest);

      // 更新状态
      plugin.enabled = true;
      plugin.status = 'enabled';
      plugin.lastError = undefined;

      // 保存配置
      const configKey = `plugins.${pluginId}`;
      this.configManager.set(configKey, {
        enabled: true,
        installedAt: plugin.installedAt
      });

      this.emit('plugin.enabled', { id: pluginId });
    } catch (error) {
      plugin.status = 'error';
      plugin.lastError = error instanceof Error ? error.message : '未知错误';
      this.emit('plugin.error', { id: pluginId, error: plugin.lastError });
      throw error;
    }
  }

  /**
   * 禁用插件
   */
  public async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 不存在`);
    }

    if (!plugin.enabled) {
      return; // 已经禁用
    }

    try {
      // 更新状态
      plugin.enabled = false;
      plugin.status = 'disabled';
      plugin.lastError = undefined;

      // 保存配置
      const configKey = `plugins.${pluginId}`;
      this.configManager.set(configKey, {
        enabled: false,
        installedAt: plugin.installedAt
      });

      this.emit('plugin.disabled', { id: pluginId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.emit('plugin.error', { id: pluginId, error: errorMessage });
      throw error;
    }
  }

  private async extractPlugin(filePath: string, targetDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // 确保目标目录存在
    await fs.promises.mkdir(targetDir, { recursive: true });

    // 检查文件类型
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.zip') {
      // 使用 node.js 内置的 zlib 处理 zip 文件
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      zip.extractAllTo(targetDir, true);
    } else if (ext === '.tar' || ext === '.gz') {
      // 处理 tar 文件
      const tar = require('tar');
      await tar.extract({
        file: filePath,
        cwd: targetDir
      });
    } else {
      throw new Error(`不支持的插件文件格式: ${ext}`);
    }
  }

  private async validatePluginManifest(pluginDir: string): Promise<PluginManifest> {
    const manifestPath = path.join(pluginDir, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error('插件清单文件 manifest.json 不存在');
    }

    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent) as PluginManifest;

      // 验证必需字段
      if (!manifest.id || !manifest.name || !manifest.version || !manifest.main) {
        throw new Error('插件清单文件缺少必需字段 (id, name, version, main)');
      }

      // 验证版本格式
      const versionRegex = /^\d+\.\d+\.\d+$/;
      if (!versionRegex.test(manifest.version)) {
        throw new Error('插件版本格式错误，应为 x.y.z 格式');
      }

      // 验证插件 ID 格式
      const idRegex = /^[a-z0-9-_]+$/;
      if (!idRegex.test(manifest.id)) {
        throw new Error('插件 ID 格式错误，只能包含小写字母、数字、连字符和下划线');
      }

      // 验证主文件存在
      const mainFilePath = path.join(pluginDir, manifest.main);
      if (!fs.existsSync(mainFilePath)) {
        throw new Error(`插件主文件 ${manifest.main} 不存在`);
      }

      return manifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('插件清单文件格式错误');
      }
      throw error;
    }
  }

  private async checkDependencies(manifest: PluginManifest): Promise<void> {
    const missing: string[] = [];

    if (manifest.dependencies) {
      for (const [depId, requiredVersion] of Object.entries(manifest.dependencies)) {
        const installedPlugin = this.plugins.get(depId);
        
        if (!installedPlugin) {
          missing.push(`${depId}@${requiredVersion}`);
          continue;
        }

        // 简单的版本检查（可以后续改进为更复杂的语义版本检查）
        if (installedPlugin.manifest.version !== requiredVersion) {
          missing.push(`${depId}@${requiredVersion} (已安装: ${installedPlugin.manifest.version})`);
        }
      }
    }

    // 检查应用版本兼容性
    if (manifest.minAppVersion || manifest.maxAppVersion) {
      const currentAppVersion = app.getVersion();
      
      if (manifest.minAppVersion && this.compareVersions(currentAppVersion, manifest.minAppVersion) < 0) {
        missing.push(`应用版本 >= ${manifest.minAppVersion} (当前: ${currentAppVersion})`);
      }
      
      if (manifest.maxAppVersion && this.compareVersions(currentAppVersion, manifest.maxAppVersion) > 0) {
        missing.push(`应用版本 <= ${manifest.maxAppVersion} (当前: ${currentAppVersion})`);
      }
    }

    if (missing.length > 0) {
      throw new Error(`插件依赖不满足: ${missing.join(', ')}`);
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  /**
   * 为指定插件返回受控 API（带上下文）。
   */
  public getApi(pluginId: string): PluginAPI {
    return new ApiBridge({
      pluginId,
      apiServer: this.apiServer,
      roomManager: this.roomManager,
      databaseManager: this.databaseManager,
      configManager: this.configManager,
      popupManager: this.popupManager,
      onPluginFault: (reason: string) => this.emit('plugin.suspended', { id: pluginId, reason })
    });
  }

  /**
   * 供内部或测试用的路由注册代理（统一走 ApiServer）。
   */
  public registerHttpRoute(
    pluginId: string,
    def: { method: 'GET' | 'POST'; path: string },
    handler: Parameters<ApiServer['registerPluginRoute']>[2]
  ): void {
    this.apiServer.registerPluginRoute(pluginId, def, handler);
  }

  /**
   * 暂停插件（当插件出现错误或违规时）
   */
  public suspendPlugin(pluginId: string, reason: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    plugin.enabled = false;
    plugin.status = 'error';
    plugin.lastError = reason;

    // 保存配置
    const configKey = `plugins.${pluginId}`;
    this.configManager.set(configKey, {
      enabled: false,
      installedAt: plugin.installedAt
    });

    this.emit('plugin.suspended', { id: pluginId, reason });
  }

  /**
   * 获取插件状态统计
   */
  public getPluginStats(): {
    total: number;
    enabled: number;
    disabled: number;
    error: number;
  } {
    const plugins = Array.from(this.plugins.values());
    return {
      total: plugins.length,
      enabled: plugins.filter(p => p.status === 'enabled').length,
      disabled: plugins.filter(p => p.status === 'disabled').length,
      error: plugins.filter(p => p.status === 'error').length
    };
  }

  /**
   * 获取插件日志
   */
  public getPluginLogs(pluginId?: string, limit: number = 100) {
    return pluginLogger.getRecentLogs(pluginId, limit);
  }

  /**
   * 获取插件错误历史
   */
  public getPluginErrorHistory(pluginId: string) {
    return pluginErrorHandler.getErrorHistory(pluginId);
  }

  /**
   * 获取所有插件的错误统计
   */
  public getPluginErrorStats() {
    return pluginErrorHandler.getErrorStats();
  }

  /**
   * 手动执行插件恢复操作
   */
  public async executePluginRecovery(pluginId: string, action: RecoveryAction, context?: Record<string, any>): Promise<boolean> {
    return pluginErrorHandler.executeRecoveryAction(pluginId, action, context);
  }

  /**
   * 重置插件错误计数
   */
  public resetPluginErrorCount(pluginId: string, errorType?: ErrorType): void {
    pluginErrorHandler.resetRetryCount(pluginId, errorType);
  }

  /**
   * 清理插件缓存和临时文件
   */
  public cleanup(): void {
    const tempDir = path.join(this.pluginsDir, '.temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // 清理日志和错误记录
    pluginLogger.cleanup();
    pluginErrorHandler.cleanup();
  }
}