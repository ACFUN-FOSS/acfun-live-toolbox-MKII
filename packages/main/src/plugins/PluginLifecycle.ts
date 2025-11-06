import { EventEmitter } from 'events';
import { PluginInfo, PluginManifest } from './PluginManager';
import { pluginLogger } from './PluginLogger';

/**
 * 插件生命周期钩子类型
 */
export type LifecycleHook = 
  | 'beforeInstall'
  | 'afterInstall'
  | 'beforeEnable'
  | 'afterEnable'
  | 'beforeDisable'
  | 'afterDisable'
  | 'beforeUninstall'
  | 'afterUninstall'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'onError'
  | 'onRecover'
  // 页面动作钩子（UI/Window/Overlay）
  | 'beforeUiOpen'
  | 'afterUiOpen'
  | 'uiClosed'
  | 'beforeWindowOpen'
  | 'afterWindowOpen'
  | 'windowClosed'
  | 'beforeOverlayOpen'
  | 'afterOverlayOpen'
  | 'overlayClosed';

/**
 * 生命周期事件数据
 */
export interface LifecycleEventData {
  pluginId: string;
  plugin?: PluginInfo;
  manifest?: PluginManifest;
  error?: Error;
  context?: Record<string, any>;
  timestamp: number;
}

/**
 * 生命周期钩子处理器
 */
export type LifecycleHandler = (data: LifecycleEventData) => Promise<void> | void;

/**
 * 生命周期钩子注册信息
 */
export interface LifecycleHookRegistration {
  id: string;
  hook: LifecycleHook;
  handler: LifecycleHandler;
  priority: number;
  pluginId?: string; // 如果是插件注册的钩子
}

/**
 * 插件生命周期管理器
 */
export class PluginLifecycleManager extends EventEmitter {
  private hooks: Map<LifecycleHook, LifecycleHookRegistration[]> = new Map();
  private executionHistory: Map<string, LifecycleEventData[]> = new Map();

  constructor() {
    super();
    this.initializeDefaultHooks();
  }

  /**
   * 初始化默认钩子
   */
  private initializeDefaultHooks(): void {
    // 为每个生命周期钩子初始化空数组
    const allHooks: LifecycleHook[] = [
      'beforeInstall', 'afterInstall',
      'beforeEnable', 'afterEnable',
      'beforeDisable', 'afterDisable',
      'beforeUninstall', 'afterUninstall',
      'beforeUpdate', 'afterUpdate',
      'onError', 'onRecover'
    ];

    allHooks.forEach(hook => {
      this.hooks.set(hook, []);
    });
  }

  /**
   * 注册生命周期钩子
   */
  public registerHook(
    hook: LifecycleHook,
    handler: LifecycleHandler,
    options: {
      id?: string;
      priority?: number;
      pluginId?: string;
    } = {}
  ): string {
    const registration: LifecycleHookRegistration = {
      id: options.id || `hook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      hook,
      handler,
      priority: options.priority || 0,
      pluginId: options.pluginId
    };

    const hookList = this.hooks.get(hook) || [];
    hookList.push(registration);
    
    // 按优先级排序（高优先级先执行）
    hookList.sort((a, b) => b.priority - a.priority);
    
    this.hooks.set(hook, hookList);

    pluginLogger.debug(`注册生命周期钩子: ${hook} (ID: ${registration.id})`);
    
    return registration.id;
  }

  /**
   * 取消注册生命周期钩子
   */
  public unregisterHook(hookId: string): boolean {
    let removed = false;
    for (const [hook, registrations] of this.hooks.entries()) {
      const index = registrations.findIndex(reg => reg.id === hookId);
      if (index !== -1) {
        registrations.splice(index, 1);
        this.hooks.set(hook, registrations);
        removed = true;
        pluginLogger.debug(`取消生命周期钩子: ${hook} (ID: ${hookId})`);
        break;
      }
    }
    return removed;
  }

  /**
   * 取消注册插件的所有钩子
   */
  public unregisterPluginHooks(pluginId: string): number {
    let count = 0;
    for (const [hook, registrations] of Array.from(this.hooks.entries())) {
      const originalLength = registrations.length;
      const filtered = registrations.filter(reg => reg.pluginId !== pluginId);
      this.hooks.set(hook, filtered);
      count += originalLength - filtered.length;
    }
    
    if (count > 0) {
      pluginLogger.debug(`取消注册插件 ${pluginId} 的 ${count} 个生命周期钩子`);
    }
    
    return count;
  }

  /**
   * 执行生命周期钩子
   */
  public async executeHook(
    hook: LifecycleHook,
    data: Omit<LifecycleEventData, 'timestamp'>
  ): Promise<void> {
    const eventData: LifecycleEventData = {
      ...data,
      timestamp: Date.now()
    };

    // 记录执行历史
    const history = this.executionHistory.get(data.pluginId) || [];
    history.push(eventData);
    this.executionHistory.set(data.pluginId, history);

    const registrations = this.hooks.get(hook) || [];
    
    pluginLogger.debug(`执行生命周期钩子: ${hook} (插件: ${data.pluginId}, 处理器数量: ${registrations.length})`);

    // 发出事件
    this.emit('hook.before', { hook, data: eventData });

    const results: Array<{ id: string; success: boolean; error?: Error }> = [];

    // 按优先级顺序执行钩子
    for (const registration of registrations) {
      try {
        await registration.handler(eventData);
        results.push({ id: registration.id, success: true });
        pluginLogger.debug(`生命周期钩子执行成功: ${hook} (ID: ${registration.id})`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        results.push({ id: registration.id, success: false, error: err });
        pluginLogger.error(`生命周期钩子执行失败: ${hook} (ID: ${registration.id}) - ${err.message}`);
        
        // 发出错误事件
        this.emit('hook.error', {
          hook,
          hookId: registration.id,
          data: eventData,
          error: err
        });
      }
    }

    // 发出完成事件
    this.emit('hook.after', { hook, data: eventData, results });
  }

  /**
   * 获取插件的执行历史
   */
  public getExecutionHistory(pluginId: string): LifecycleEventData[] {
    return this.executionHistory.get(pluginId) || [];
  }

  /**
   * 清理插件的执行历史
   */
  public clearExecutionHistory(pluginId: string): void {
    this.executionHistory.delete(pluginId);
  }

  /**
   * 获取已注册的钩子信息
   */
  public getRegisteredHooks(hook?: LifecycleHook): LifecycleHookRegistration[] {
    if (hook) {
      return [...(this.hooks.get(hook) || [])];
    }
    
    const allHooks: LifecycleHookRegistration[] = [];
    for (const registrations of Array.from(this.hooks.values())) {
      allHooks.push(...registrations);
    }
    return allHooks;
  }

  /**
   * 获取钩子统计信息
   */
  public getHookStats(): Record<LifecycleHook, number> {
    const stats: Record<string, number> = {};
    for (const [hook, registrations] of Array.from(this.hooks.entries())) {
      stats[hook] = registrations.length;
    }
    return stats as Record<LifecycleHook, number>;
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.hooks.clear();
    this.executionHistory.clear();
    this.removeAllListeners();
    pluginLogger.debug('插件生命周期管理器已清理');
  }
}

/**
 * 全局插件生命周期管理器实例
 */
export const pluginLifecycleManager = new PluginLifecycleManager();
