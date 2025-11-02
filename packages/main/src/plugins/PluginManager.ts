import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { ApiServer } from '../server/ApiServer';
import { RoomManager } from '../rooms/RoomManager';
import { DatabaseManager } from '../persistence/DatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import { ApiBridge, PluginAPI } from './ApiBridge';
import { PopupManager } from './PopupManager';
import { ProcessManager, ProcessManagerConfig } from './ProcessManager';
import { pluginLifecycleManager } from './PluginLifecycle';
import { PluginUpdater } from './PluginUpdater';
import { pluginLogger } from './PluginLogger';
import { pluginErrorHandler, ErrorType, RecoveryAction } from './PluginErrorHandler';
import { pluginHotReloadManager, HotReloadConfig } from './PluginHotReload';
import { pluginVersionManager } from './PluginVersionManager';
import { MemoryPoolManager } from './MemoryPoolManager';
import { ConnectionPoolManager } from './ConnectionPoolManager';
import { pluginCacheManager } from './PluginCacheManager';
import { pluginPerformanceMonitor } from './PluginPerformanceMonitor';
import { pluginLazyLoader } from './PluginLazyLoader';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { watch, FSWatcher } from 'chokidar';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
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
  hotReloadEnabled?: boolean;
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
  private processManager: ProcessManager;
  private pluginUpdater: PluginUpdater;
  private memoryPoolManager: MemoryPoolManager;
  private connectionPoolManager: ConnectionPoolManager;
  private plugins: Map<string, PluginInfo> = new Map();
  private pluginsDir: string;
  private hotReloadWatchers: Map<string, FSWatcher> = new Map();

  constructor(opts: {
    apiServer: ApiServer;
    roomManager: RoomManager;
    databaseManager: DatabaseManager;
    configManager: ConfigManager;
    processManagerConfig?: Partial<ProcessManagerConfig>;
  }) {
    super();
    this.apiServer = opts.apiServer;
    this.roomManager = opts.roomManager;
    this.databaseManager = opts.databaseManager;
    this.configManager = opts.configManager;
    this.popupManager = new PopupManager();
    this.processManager = new ProcessManager(opts.processManagerConfig);
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.pluginUpdater = new PluginUpdater(this.pluginsDir, {
      autoCheck: false,
      autoDownload: false,
      autoInstall: false,
      checkInterval: 24 * 60 * 60 * 1000, // 24小时
      backupBeforeUpdate: true,
      rollbackOnFailure: true
    });
    
    // 初始化性能优化组件
    this.memoryPoolManager = new MemoryPoolManager();
    this.connectionPoolManager = new ConnectionPoolManager();
    
    this.ensurePluginsDirectory();
    this.setupErrorHandling();
    this.setupProcessManagerEvents();
    this.setupLifecycleEvents();
    this.setupHotReloadEvents();
    this.setupPerformanceOptimizations();
    this.loadInstalledPlugins();
  }

  private setupProcessManagerEvents(): void {
    // 监听进程管理器事件
    this.processManager.on('process.started', ({ pluginId, processInfo }) => {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.status = 'enabled';
        pluginLogger.info('Plugin process started successfully', pluginId);
      }
    });

    this.processManager.on('process.stopped', ({ pluginId, reason }) => {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.status = reason === 'manual' ? 'disabled' : 'error';
        pluginLogger.info('Plugin process stopped', pluginId);
      }
    });

    this.processManager.on('process.error', async ({ pluginId, error }) => {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.status = 'error';
        plugin.lastError = error.message;
        this.emit('plugin.error', { id: pluginId, error: error.message });
        
        // 报告错误到错误处理器
        await pluginErrorHandler.handleError(
          pluginId,
          ErrorType.RUNTIME_ERROR,
          error.message,
          error,
          { context: 'process_manager' }
        );
      }
    });

    this.processManager.on('process.recovered', ({ pluginId, attempt }) => {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.status = 'enabled';
        plugin.lastError = undefined;
        pluginLogger.info('Plugin process recovered successfully', pluginId);
      }
    });
  }

  private setupLifecycleEvents(): void {
    // 设置生命周期钩子
    pluginLifecycleManager.registerHook('beforeInstall', async (data) => {
      pluginLogger.info('Plugin installation starting', data.pluginId);
      // 插件是自包含的，无需检查依赖关系
    });

    pluginLifecycleManager.registerHook('afterInstall', async (data) => {
      pluginLogger.info('Plugin installation completed', data.pluginId);
      // 插件是自包含的，无需更新依赖图
    });

    pluginLifecycleManager.registerHook('beforeEnable', async (data) => {
      pluginLogger.info('Plugin enabling starting', data.pluginId);
      // 插件是自包含的，无需检查依赖
    });

    pluginLifecycleManager.registerHook('afterEnable', async (data) => {
      pluginLogger.info('Plugin enabled successfully', data.pluginId);
    });

    pluginLifecycleManager.registerHook('beforeDisable', async (data) => {
      pluginLogger.info('Plugin disabling starting', data.pluginId);
      // 插件是自包含的，无需检查依赖
    });

    pluginLifecycleManager.registerHook('afterDisable', async (data) => {
      pluginLogger.info('Plugin disabled successfully', data.pluginId);
    });

    pluginLifecycleManager.registerHook('beforeUninstall', async (data) => {
      pluginLogger.info('Plugin uninstallation starting', data.pluginId);
      // 确保插件已禁用
      const plugin = this.plugins.get(data.pluginId);
      if (plugin && plugin.enabled) {
        await this.disablePlugin(data.pluginId);
      }
    });

    pluginLifecycleManager.registerHook('afterUninstall', async (data) => {
      pluginLogger.info('Plugin uninstallation completed', data.pluginId);
      // 插件是自包含的，无需更新依赖图
    });

    pluginLifecycleManager.registerHook('onError', async (data) => {
      pluginLogger.error('Plugin error occurred', data.pluginId);
      // 使用handleError方法而不是reportError
      if (data.error) {
        await pluginErrorHandler.handleError(
          data.pluginId, 
          ErrorType.RUNTIME_ERROR, 
          data.error.message, 
          data.error, 
          data.context
        );
      }
    });

    // 监听更新器事件
    this.pluginUpdater.on('update.available', ({ pluginId }) => {
      pluginLogger.info('Plugin update available', pluginId);
    });

    this.pluginUpdater.on('update.progress', ({ pluginId, progress, message }) => {
      this.emit('plugin.install.progress', { id: pluginId, progress, message });
    });

    this.pluginUpdater.on('update.completed', ({ pluginId }) => {
      pluginLogger.info('Plugin update completed', pluginId);
      // 重新加载插件信息
      this.loadInstalledPlugins();
    });

    this.pluginUpdater.on('update.failed', async ({ pluginId, error }) => {
      pluginLogger.error('Plugin update failed', pluginId, error);
      await pluginErrorHandler.handleError(pluginId, ErrorType.RUNTIME_ERROR, error.message, error);
    });
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
      } catch (error: any) {
        pluginLogger.error(`Failed to execute recovery action: ${action}`, pluginId, error as Error);
      }
    });
  }

  private setupHotReloadEvents(): void {
    // 监听热重载事件
    pluginHotReloadManager.on('reload-requested', async ({ pluginId }) => {
      pluginLogger.info('Hot reload requested', pluginId);

      try {
        // 如果插件当前已启用，先禁用再重新启用
        const plugin = this.plugins.get(pluginId);
        if (plugin && plugin.enabled) {
          pluginLogger.debug('Disabling plugin for hot reload', pluginId);
          await this.disablePlugin(pluginId);
          
          // 等待一小段时间确保资源释放
          await new Promise(resolve => setTimeout(resolve, 100));
          
          pluginLogger.debug('Re-enabling plugin after hot reload', pluginId);
          await this.enablePlugin(pluginId);
        } else if (plugin) {
          // 如果插件未启用，重新加载插件信息
          await this.reloadPluginInfo(pluginId);
        }
      } catch (error: any) {
        pluginLogger.error('Hot reload failed', pluginId, error as Error);
        await pluginErrorHandler.handleError(pluginId, ErrorType.RUNTIME_ERROR, (error as Error).message, error as Error, {
          context: 'hot_reload'
        });
      }
    });

    pluginHotReloadManager.on('reload-completed', ({ pluginId }) => {
      pluginLogger.info('Hot reload completed successfully', pluginId);
    });

    pluginHotReloadManager.on('reload-failed', ({ pluginId, error }) => {
      pluginLogger.error('Hot reload failed', pluginId, new Error(error || 'Unknown error'));
    });

    pluginHotReloadManager.on('watch-error', ({ pluginId, error }) => {
      pluginLogger.error('File watch error', pluginId);
    });
  }

  private setupPerformanceOptimizations(): void {
    // 设置性能监控事件
    pluginPerformanceMonitor.on('performance-alert', (alert) => {
      pluginLogger.warn(`Performance alert for plugin ${alert.pluginId}`, alert.pluginId, {
        alertType: alert.type,
        severity: alert.severity,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold
      });
      
      // 如果是严重的性能问题，考虑暂停插件
      if (alert.severity === 'critical') {
        this.suspendPlugin(alert.pluginId, `Performance issue: ${alert.message}`);
      }
    });

    // 设置缓存管理事件
    pluginCacheManager.on('cache-evicted', ({ key, reason, pluginId }) => {
      pluginLogger.debug('Cache item evicted', pluginId, { key, reason });
    });

    // 设置懒加载事件
    pluginLazyLoader.on('plugin-load-failed', ({ pluginId, error }) => {
      pluginLogger.error('Lazy load failed', pluginId, error);
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugin.status = 'error';
        plugin.lastError = error.message;
      }
    });

    pluginLazyLoader.on('memory-pressure', ({ currentUsage, threshold }) => {
      pluginLogger.warn('Memory pressure detected', undefined, {
        currentUsage: Math.round(currentUsage / 1024 / 1024) + 'MB',
        threshold: Math.round(threshold / 1024 / 1024) + 'MB'
      });
    });

    pluginLogger.info('Performance optimizations initialized');
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
        } catch (error: any) {
          const errorMessage = `Failed to load plugin: ${error instanceof Error ? error.message : 'Unknown error'}`;
          pluginLogger.error(errorMessage, pluginId);
          
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
    } catch (error: any) {
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
   * 验证插件文件
   */
  public async validatePluginFile(filePath: string): Promise<PluginManifest> {
    let tempDir: string | undefined;
    
    try {
      // 验证文件存在
      if (!fs.existsSync(filePath)) {
        throw new Error('插件文件不存在');
      }

      // 解压插件文件到临时目录
      tempDir = path.join(this.pluginsDir, '.temp', crypto.randomUUID());
      await this.extractPlugin(filePath, tempDir);

      // 验证插件清单
      const manifest = await this.validatePluginManifest(tempDir);
      
      return manifest;
    } finally {
      // 清理临时目录
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  /**
   * 安装插件
   */
  public async installPlugin(options: PluginInstallOptions): Promise<PluginInfo> {
    const { filePath, overwrite = false, enable = false } = options;
    let tempDir: string | undefined;
    let pluginId = 'unknown';
    let manifest: PluginManifest | undefined;
    
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
      manifest = await this.validatePluginManifest(tempDir);
      pluginId = manifest.id;
      
      pluginLogger.info(`Installing plugin: ${manifest.name} v${manifest.version}`, pluginId);
      this.emit('plugin.install.progress', { id: manifest.id, progress: 50, message: '验证插件清单...' });

      // 执行 beforeInstall 生命周期钩子
      await pluginLifecycleManager.executeHook('beforeInstall', {
        pluginId: manifest.id,
        manifest,
        context: { filePath, overwrite, enable }
      });

      // 检查插件是否已存在
      if (this.plugins.has(manifest.id) && !overwrite) {
        throw new Error(`插件 ${manifest.id} 已存在，请选择覆盖安装`);
      }

      this.emit('plugin.install.progress', { id: manifest.id, progress: 70, message: '准备安装插件...' });

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
      
      // 注册插件版本
      pluginVersionManager.registerPluginVersion(manifest.id, manifest);
      
      // 重置该插件的错误计数
      pluginErrorHandler.resetRetryCount(manifest.id);
      
      // 执行 afterInstall 生命周期钩子
      await pluginLifecycleManager.executeHook('afterInstall', {
        pluginId: manifest.id,
        manifest,
        context: { filePath, overwrite, enable }
      });
      
      pluginLogger.info(`Successfully installed plugin: ${manifest.name} v${manifest.version}`, pluginId);
      this.emit('plugin.install.progress', { id: manifest.id, progress: 100, message: '安装完成' });
      this.emit('plugin.installed', { plugin: pluginInfo });

      return pluginInfo;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      // 执行 onError 生命周期钩子
      if (manifest) {
        await pluginLifecycleManager.executeHook('onError', {
          pluginId: manifest.id,
          error: error as Error,
          context: { phase: 'install', filePath, overwrite, enable }
        });
      }
      
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
      // 执行 beforeUninstall 生命周期钩子
      await pluginLifecycleManager.executeHook('beforeUninstall', {
        pluginId,
        manifest: plugin.manifest,
        context: { action: 'uninstall' }
      });

      // 插件是自包含的，无需检查依赖关系

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

      // 执行 afterUninstall 生命周期钩子
      await pluginLifecycleManager.executeHook('afterUninstall', {
        pluginId,
        manifest: plugin.manifest,
        context: { action: 'uninstall' }
      });

      this.emit('plugin.uninstalled', { id: pluginId });
    } catch (error: any) {
      // 执行 onError 生命周期钩子
      await pluginLifecycleManager.executeHook('onError', {
        pluginId,
        error: error as Error,
        context: { phase: 'uninstall', action: 'uninstall' }
      });

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
      
      // 开始性能监控
      pluginPerformanceMonitor.startMonitoringPlugin(pluginId);
      
      // 注册懒加载
      pluginLazyLoader.registerPlugin(
        pluginId, 
        plugin.manifest.permissions || [], 
        0 // normal priority
      );
      
      // 执行 beforeEnable 生命周期钩子
      await pluginLifecycleManager.executeHook('beforeEnable', {
        pluginId,
        manifest: plugin.manifest,
        context: { action: 'enable' }
      });
      
      // 检查依赖
      // await this.checkDependencies(plugin.manifest);

      // 启动插件进程
      const pluginMainPath = path.join(plugin.installPath, plugin.manifest.main);
      await this.processManager.startPluginProcess(pluginId, pluginMainPath);

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

      // 执行 afterEnable 生命周期钩子
      await pluginLifecycleManager.executeHook('afterEnable', {
        pluginId,
        manifest: plugin.manifest,
        context: { action: 'enable' }
      });

      // 自动启用热重载（开发模式下）
      if (process.env.NODE_ENV === 'development') {
        try {
          this.enableHotReload(pluginId);
          pluginLogger.info('Hot reload enabled for plugin', pluginId, { pluginId });
        } catch (hotReloadError) {
          pluginLogger.warn('Failed to enable hot reload for plugin', pluginId, { 
            pluginId, 
            error: hotReloadError 
          });
        }
      }

      this.emit('plugin.enabled', { id: pluginId });
      pluginLogger.info('Plugin enabled successfully', pluginId, { pluginId });
    } catch (error: any) {
      plugin.status = 'error';
      plugin.lastError = error instanceof Error ? error.message : '未知错误';
      
      // 停止性能监控
      pluginPerformanceMonitor.stopMonitoringPlugin(pluginId);
      
      // 执行 onError 生命周期钩子
      await pluginLifecycleManager.executeHook('onError', {
        pluginId,
        error: error as Error,
        context: { phase: 'enable', action: 'enable' }
      });
      
      this.emit('plugin.error', { id: pluginId, error: plugin.lastError });
      
      await pluginErrorHandler.handleError(
          pluginId,
          ErrorType.ENABLE_FAILED,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : new Error(String(error)),
          { context: 'enable_plugin' }
        );
      
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
      // 执行 beforeDisable 生命周期钩子
      await pluginLifecycleManager.executeHook('beforeDisable', {
        pluginId,
        manifest: plugin.manifest,
        context: { action: 'disable' }
      });

      // 停止插件进程
      try {
        await this.processManager.stopPluginProcess(pluginId);
        pluginLogger.info(`插件进程已停止: ${pluginId}`);
      } catch (processError) {
        const processErrorMessage = processError instanceof Error ? processError.message : '未知进程错误';
        pluginLogger.warn(`停止插件进程时出错: ${pluginId} - ${processErrorMessage}`);
        await pluginErrorHandler.handleError(pluginId, ErrorType.RUNTIME_ERROR, processErrorMessage, new Error(processErrorMessage));
      }

      // 停止性能监控
      pluginPerformanceMonitor.stopMonitoringPlugin(pluginId);
      
      // 卸载懒加载
      await pluginLazyLoader.unloadPlugin(pluginId);
      
      // 清理缓存
      this.clearPluginCache(pluginId);

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

      // 执行 afterDisable 生命周期钩子
      await pluginLifecycleManager.executeHook('afterDisable', {
        pluginId,
        manifest: plugin.manifest,
        plugin: plugin,
        context: { action: 'disable' }
      });

      // 禁用热重载
      try {
        this.disableHotReload(pluginId);
        pluginLogger.info('Hot reload disabled for plugin', pluginId, { pluginId });
      } catch (hotReloadError) {
        pluginLogger.warn('Failed to disable hot reload for plugin', pluginId, { 
          pluginId, 
          error: hotReloadError 
        });
      }

      this.emit('plugin.disabled', { id: pluginId });
    } catch (error: any) {
      // 执行 onError 生命周期钩子
      await pluginLifecycleManager.executeHook('onError', {
        pluginId,
        error: error as Error,
        context: { phase: 'disable', action: 'disable' }
      });

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
    // 清理进程管理器
    this.processManager.cleanup();
    
    // 清理热重载观察者
    for (const [pluginId, watcher] of this.hotReloadWatchers) {
      try {
        watcher.close();
      } catch (error: any) {
        pluginLogger.error(`Failed to close watcher for plugin ${pluginId}:`, error.message);
      }
    }
    this.hotReloadWatchers.clear();
    
    // 清理热重载管理器
    pluginHotReloadManager.cleanup();
    
    // 清理性能优化组件
    try {
      if (typeof pluginPerformanceMonitor.destroy === 'function') {
        pluginPerformanceMonitor.destroy();
      }
      // pluginCacheManager 和 pluginLazyLoader 没有 cleanup 方法，跳过
      if (typeof this.memoryPoolManager.cleanup === 'function') {
        this.memoryPoolManager.cleanup();
      }
      if (typeof this.connectionPoolManager.destroy === 'function') {
        this.connectionPoolManager.destroy();
      }
    } catch (error: any) {
      pluginLogger.error('Failed to cleanup performance optimization components:', undefined, error);
    }
    
    const tempDir = path.join(this.pluginsDir, '.temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // 清理插件日志和错误处理器
    pluginLogger.cleanup?.();
    pluginErrorHandler.cleanup?.();
  }

  /**
   * 检查插件更新
   */
  public async checkPluginUpdate(pluginId: string): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 不存在`);
    }

    return await this.pluginUpdater.checkUpdate(plugin);
  }

  /**
   * 更新插件
   */
  public async updatePlugin(pluginId: string, updateUrl?: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 不存在`);
    }

    // 如果插件已启用，先禁用
    const wasEnabled = plugin.enabled;
    if (wasEnabled) {
      await this.disablePlugin(pluginId);
    }

    try {
      await this.pluginUpdater.updatePlugin(pluginId, updateUrl);
      
      // 重新加载插件信息
      await this.loadInstalledPlugins();
      
      // 如果之前是启用状态，重新启用
      if (wasEnabled) {
        await this.enablePlugin(pluginId);
      }
    } catch (error: any) {
      // 如果更新失败，尝试回滚
      try {
        await this.rollbackPluginUpdate(pluginId);
        if (wasEnabled) {
          await this.enablePlugin(pluginId);
        }
      } catch (rollbackError: any) {
        pluginLogger.error('插件更新回滚失败', pluginId, rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)), { pluginId, error: rollbackError });
      }
      throw error;
    }
  }

  /**
   * 回滚插件更新
   */
  public async rollbackPluginUpdate(pluginId: string): Promise<boolean> {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
          throw new Error(`Plugin ${pluginId} not found`);
      }
  
      // 记录插件是否之前是启用状态
      const wasEnabled = plugin.enabled;
      
      try {
      
          // 检查是否有备份可回滚
          const backupPath = path.join(this.pluginsDir, `${pluginId}_backup`);
          if (!fs.existsSync(backupPath)) {
              throw new Error(`No backup found for plugin ${pluginId}`);
          }
      
          // 停用插件
          await this.disablePlugin(pluginId);
      
          // 删除当前版本
          const pluginPath = path.join(this.pluginsDir, pluginId);
          fs.rmSync(pluginPath, { recursive: true, force: true });
      
          // 恢复备份
          fs.cpSync(backupPath, pluginPath, { recursive: true });
      
          // 重新加载插件
          // await this.loadPlugin(pluginId);
      
          // 重新启用插件（如果之前是启用状态）
          if (plugin.enabled) {
              await this.enablePlugin(pluginId);
          }
      
          pluginLogger.info(`Plugin ${pluginId} rolled back successfully`);
          return true;
      } catch (error: any) {
          pluginLogger.error(`Failed to rollback plugin version: ${error.message}`);
          
          // 如果回滚失败且插件之前是启用的，尝试重新启用
          if (wasEnabled) {
            try {
              await this.enablePlugin(pluginId);
            } catch (enableError: any) {
              pluginLogger.error(`Failed to re-enable plugin after rollback failure: ${enableError.message}`);
            }
          }
      
          return false;
      }
  }



  /**
   * 启用插件热重载
   */
  public enableHotReload(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 不存在`);
    }

    return pluginHotReloadManager.startWatching(pluginId, plugin.installPath);
  }

  /**
   * 禁用插件热重载
   */
  public disableHotReload(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    try {
      // 禁用热重载
      plugin.hotReloadEnabled = false;
      
      // 停止文件监听
      const watcher = this.hotReloadWatchers.get(pluginId);
      if (watcher) {
        watcher.close();
        this.hotReloadWatchers.delete(pluginId);
      }
      
      pluginLogger.info(`Hot reload disabled for plugin ${pluginId}`);
      return true;
    } catch (error: any) {
      pluginLogger.error(`Failed to disable hot reload for plugin ${pluginId}:`, error.message);
      return false;
    }
  }

  /**
   * 手动触发插件热重载
   */
  public async manualHotReload(pluginId: string): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 不存在`);
    }

    try {
      // 启用热重载
      plugin.hotReloadEnabled = true;
      
      // 监听插件文件变化
      const pluginPath = path.join(this.pluginsDir, pluginId);
      const watcher = watch(pluginPath, {
          ignored: /(^|[\/\\])\../, // 忽略隐藏文件
          persistent: true,
          ignoreInitial: true
      });
    
      watcher.on('change', async (filePath: string) => {
          if (plugin.hotReloadEnabled) {
              pluginLogger.info(`Plugin ${pluginId} file changed: ${filePath}`);
              try {
                  // Trigger hot reload through the hot reload manager instead of recursively calling manualHotReload
                  // 触发插件热重载（通过公开接口）
                  await pluginHotReloadManager.manualReload(pluginId);
              } catch (error: any) {
                  pluginLogger.error(`Hot reload failed for plugin ${pluginId}:`, error.message);
              }
          }
      });

      // 存储观察者引用
      this.hotReloadWatchers.set(pluginId, watcher);
      
      pluginLogger.info(`Hot reload enabled for plugin ${pluginId}`);
    } catch (error: any) {
      pluginLogger.error(`Failed to enable hot reload for plugin ${pluginId}:`, error.message);
      throw error;
    }
  }

  /**
   * 获取插件热重载状态
   */
  public getHotReloadStatus(pluginId: string): any {
    return pluginHotReloadManager.getWatchStatus(pluginId);
  }

  /**
   * 获取所有启用热重载的插件
   */
  public getHotReloadPlugins(): string[] {
    return pluginHotReloadManager.getWatchedPlugins();
  }

  /**
   * 更新热重载配置
   */
  public updateHotReloadConfig(config: Partial<HotReloadConfig>): void {
    pluginHotReloadManager.updateConfig(config);
  }

  /**
   * 获取插件版本历史
   */
  public getPluginVersionHistory(pluginId: string): any {
    return pluginVersionManager.getVersionHistory(pluginId);
  }

  /**
   * 检查插件更新
   */
  public async checkPluginUpdates(pluginId: string, registryUrl?: string): Promise<any> {
    return await pluginVersionManager.checkForUpdates(pluginId, registryUrl);
  }

  /**
   * 获取版本变更日志
   */
  public getPluginChangelog(pluginId: string, fromVersion?: string, toVersion?: string): string[] {
    return pluginVersionManager.getChangelog(pluginId, fromVersion, toVersion);
  }

  /**
   * 回滚插件到指定版本
   */
  public async rollbackPluginVersion(pluginId: string, targetVersion: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件 ${pluginId} 不存在`);
    }

    const wasEnabled = plugin.enabled;
    
    try {
      // 如果插件正在运行，先禁用
      if (wasEnabled) {
        await this.disablePlugin(pluginId);
      }

      // 执行版本回滚
      const success = await pluginVersionManager.rollbackToVersion(pluginId, targetVersion);
      
      if (success) {
        // 更新插件信息中的版本
        plugin.version = targetVersion;
        
        // 如果之前是启用状态，重新启用
        if (wasEnabled) {
          await this.enablePlugin(pluginId);
        }

        pluginLogger.info(`Plugin ${pluginId} rolled back to version ${targetVersion}`);
      }

      return success;
    } catch (error: any) {
      pluginLogger.error(`Failed to rollback plugin version: ${error.message}`);
      
      return false;
    }
  }

  /**
   * 比较版本号
   */
  public compareVersions(version1: string, version2: string): number {
    return pluginVersionManager.compareVersions(version1, version2);
  }

  /**
   * 检查版本约束
   */
  public satisfiesVersionConstraint(version: string, constraint: string): boolean {
    return pluginVersionManager.satisfiesConstraint(version, constraint);
  }

  /**
   * 清理旧版本数据
   */
  public cleanupOldVersions(pluginId: string, keepCount: number = 10): void {
    pluginVersionManager.cleanupOldVersions(pluginId, keepCount);
  }

  /**
   * 重新加载插件信息（不重启插件）
   */
  private async reloadPluginInfo(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    try {
      const manifestPath = path.join(plugin.installPath, 'plugin.json');
      if (fs.existsSync(manifestPath)) {
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const manifest: PluginManifest = JSON.parse(manifestContent);
        
        // 更新插件信息
        plugin.name = manifest.name;
        plugin.version = manifest.version;
        plugin.description = manifest.description;
        plugin.author = manifest.author;
        plugin.manifest = manifest;

        pluginLogger.info('Plugin info reloaded', pluginId, { 
          name: manifest.name, 
          version: manifest.version 
        });
      }
    } catch (error: any) {
      pluginLogger.error('Failed to reload plugin info', pluginId, error as Error);
    }
  }

  // --- Development Tools ---

  /**
   * 保存开发工具配置
   */
  public async saveDevConfig(config: any): Promise<boolean> {
    try {
      const configPath = path.join(this.pluginsDir, '.devtools', 'config.json');
      const configDir = path.dirname(configPath);
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      let existingConfig = {};
      if (fs.existsSync(configPath)) {
        existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
      
      const updatedConfig = { ...existingConfig, [config.pluginId]: config };
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      
      pluginLogger.info(`Development config saved for plugin: ${config.pluginId}`, config.pluginId);
      return true;
    } catch (error) {
      pluginLogger.error(`Failed to save dev config: ${error}`, config.pluginId);
      return false;
    }
  }

  /**
   * 获取开发工具配置
   */
  public async getDevConfig(pluginId?: string): Promise<any> {
    try {
      const configPath = path.join(this.pluginsDir, '.devtools', 'config.json');
      
      if (!fs.existsSync(configPath)) {
        return pluginId ? null : {};
      }
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return pluginId ? config[pluginId] || null : config;
    } catch (error) {
      pluginLogger.error(`Failed to get dev config: ${error}`, pluginId);
      return pluginId ? null : {};
    }
  }

  /**
   * 启动外部项目调试
   */
  public async startExternalDebug(config: any): Promise<any> {
    try {
      const { pluginId, projectUrl, nodePath, autoConnect } = config;
      
      // 保存配置
      await this.saveDevConfig(config);
      
      // 测试连接
      const connectionResult = await this.testExternalConnection(config);
      if (!connectionResult.success) {
        throw new Error(`无法连接到外部项目: ${connectionResult.error}`);
      }
      
      // 启用热重载
      if (autoConnect) {
        this.enableHotReload(pluginId);
      }
      
      pluginLogger.info(`External debug started for plugin: ${pluginId}`, pluginId);
      return {
        success: true,
        status: 'connected',
        projectUrl,
        nodePath,
        hotReloadEnabled: autoConnect
      };
    } catch (error) {
      pluginLogger.error(`Failed to start external debug: ${error}`, config.pluginId);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 停止外部项目调试
   */
  public async stopExternalDebug(pluginId: string): Promise<any> {
    try {
      // 禁用热重载
      this.disableHotReload(pluginId);
      
      // 清理配置中的调试状态
      const config = await this.getDevConfig(pluginId);
      if (config) {
        config.debugActive = false;
        await this.saveDevConfig(config);
      }
      
      pluginLogger.info(`External debug stopped for plugin: ${pluginId}`, pluginId);
      return {
        success: true,
        status: 'disconnected'
      };
    } catch (error) {
      pluginLogger.error(`Failed to stop external debug: ${error}`, pluginId);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 测试外部项目连接
   */
  public async testExternalConnection(config: any): Promise<any> {
    try {
      const { projectUrl, nodePath } = config;
      
      // 测试项目URL连接
      if (projectUrl) {
        try {
          const response = await fetch(projectUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          return {
            success: false,
            error: `无法连接到项目URL: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
      
      // 测试Node.js路径
      if (nodePath) {
        if (!fs.existsSync(nodePath)) {
          return {
            success: false,
            error: `Node.js代码路径不存在: ${nodePath}`
          };
        }
        
        // 检查是否有package.json或主要文件
        const packageJsonPath = path.join(nodePath, 'package.json');
        const indexJsPath = path.join(nodePath, 'index.js');
        const indexTsPath = path.join(nodePath, 'index.ts');
        
        if (!fs.existsSync(packageJsonPath) && !fs.existsSync(indexJsPath) && !fs.existsSync(indexTsPath)) {
          return {
            success: false,
            error: `Node.js路径中未找到有效的项目文件 (package.json, index.js, index.ts)`
          };
        }
      }
      
      return {
        success: true,
        message: '连接测试成功',
        projectUrl: projectUrl || null,
        nodePath: nodePath || null
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取调试状态
   */
  public async getDebugStatus(pluginId: string): Promise<any> {
    try {
      const config = await this.getDevConfig(pluginId);
      const hotReloadStatus = this.getHotReloadStatus(pluginId);
      
      return {
        success: true,
        pluginId,
        config: config || null,
        hotReloadEnabled: hotReloadStatus?.enabled || false,
        debugActive: config?.debugActive || false,
        lastConnection: config?.lastConnection || null
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取插件性能指标
   */
  public getPluginPerformanceMetrics(pluginId: string): any {
    return pluginPerformanceMonitor.getMetrics(pluginId);
  }

  /**
   * 获取插件缓存统计
   */
  public getPluginCacheStats(pluginId?: string): any {
    return pluginCacheManager.getStats();
  }

  /**
   * 获取插件懒加载状态
   */
  public getPluginLazyLoadStatus(pluginId: string): any {
    return pluginLazyLoader.getPluginState(pluginId);
  }

  /**
   * 获取内存池统计
   */
  public getMemoryPoolStats(): any {
    return this.memoryPoolManager.getStats();
  }

  /**
   * 获取连接池统计
   */
  public getConnectionPoolStats(): any {
    return this.connectionPoolManager.getStats();
  }

  /**
   * 生成性能报告
   */
  public async generatePerformanceReport(pluginId?: string): Promise<any> {
    return pluginPerformanceMonitor.generateReport(pluginId || '');
  }

  /**
   * 清理插件缓存
   */
  public clearPluginCache(pluginId?: string): void {
    if (pluginId) {
      pluginCacheManager.clear(pluginId);
    } else {
      pluginCacheManager.clear();
    }
  }

  /**
   * 预加载插件
   */
  public async preloadPlugin(pluginId: string): Promise<void> {
    await pluginLazyLoader.loadPlugin(pluginId);
  }

  /**
   * 暂停插件懒加载
   */
  public suspendPluginLazyLoad(pluginId: string): void {
    pluginLazyLoader.suspendPlugin(pluginId, 'Manual suspension');
  }

  /**
   * 恢复插件懒加载
   */
  public resumePluginLazyLoad(pluginId: string): void {
    pluginLazyLoader.resumePlugin(pluginId);
  }
}