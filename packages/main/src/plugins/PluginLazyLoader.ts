/**
 * 插件懒加载管理器 - 实现插件的按需加载和延迟初始化
 */

import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { pluginLogger } from './PluginLogger';
import { pluginPerformanceMonitor } from './PluginPerformanceMonitor';
import * as path from 'path';
import * as fs from 'fs';

export interface LazyLoadConfig {
  /** 预加载优先级插件 */
  preloadPriority: string[];
  /** 延迟加载时间 (毫秒) */
  lazyLoadDelay: number;
  /** 最大并发加载数 */
  maxConcurrentLoads: number;
  /** 启用智能预测加载 */
  enablePredictiveLoading: boolean;
  /** 内存压力阈值 */
  memoryPressureThreshold: number;
  /** 启用渐进式加载 */
  enableProgressiveLoading: boolean;
}

export interface PluginLoadState {
  pluginId: string;
  state: 'unloaded' | 'loading' | 'loaded' | 'error' | 'suspended';
  priority: number;
  loadTime?: number;
  errorMessage?: string;
  dependencies: string[];
  dependents: string[];
  lastAccessed: number;
  accessCount: number;
  memoryUsage: number;
}

export interface LoadRequest {
  pluginId: string;
  priority: number;
  requester?: string;
  callback?: (error?: Error) => void;
  timestamp: number;
}

export interface LazyLoadEvents {
  'plugin-load-started': { pluginId: string; priority: number };
  'plugin-load-completed': { pluginId: string; loadTime: number };
  'plugin-load-failed': { pluginId: string; error: Error };
  'plugin-suspended': { pluginId: string; reason: string };
  'plugin-resumed': { pluginId: string };
  'memory-pressure': { currentUsage: number; threshold: number };
}

export class PluginLazyLoader extends TypedEventEmitter<LazyLoadEvents> {
  private config: LazyLoadConfig;
  private pluginStates: Map<string, PluginLoadState> = new Map();
  private loadQueue: LoadRequest[] = [];
  private activeLoads: Set<string> = new Set();
  private loadPromises: Map<string, Promise<void>> = new Map();
  private accessPatterns: Map<string, number[]> = new Map();
  private suspendedPlugins: Set<string> = new Set();

  constructor(config: Partial<LazyLoadConfig> = {}) {
    super();
    
    this.config = {
      preloadPriority: config.preloadPriority || [],
      lazyLoadDelay: config.lazyLoadDelay || 100,
      maxConcurrentLoads: config.maxConcurrentLoads || 3,
      enablePredictiveLoading: config.enablePredictiveLoading !== false,
      memoryPressureThreshold: config.memoryPressureThreshold || 512 * 1024 * 1024, // 512MB
      enableProgressiveLoading: config.enableProgressiveLoading !== false,
    };

    this.startMemoryMonitoring();
    pluginLogger.info('PluginLazyLoader initialized', undefined, { config: this.config });
  }

  /**
   * 注册插件用于懒加载
   */
  public registerPlugin(
    pluginId: string, 
    dependencies: string[] = [], 
    priority: number = 0
  ): void {
    const state: PluginLoadState = {
      pluginId,
      state: 'unloaded',
      priority,
      dependencies,
      dependents: [],
      lastAccessed: 0,
      accessCount: 0,
      memoryUsage: 0,
    };
    
    this.pluginStates.set(pluginId, state);
    
    // 更新依赖关系
    this.updateDependencyGraph(pluginId, dependencies);
    
    // 如果是优先级插件，添加到预加载队列
    if (this.config.preloadPriority.includes(pluginId)) {
      this.queueLoad(pluginId, 100, 'preload');
    }
    
    pluginLogger.debug('Plugin registered for lazy loading', pluginId, {
      dependencies,
      priority,
    });
  }

  /**
   * 请求加载插件
   */
  public async loadPlugin(
    pluginId: string, 
    priority: number = 0, 
    requester?: string
  ): Promise<void> {
    const state = this.pluginStates.get(pluginId);
    if (!state) {
      throw new Error(`Plugin ${pluginId} not registered for lazy loading`);
    }
    
    // 更新访问模式
    this.updateAccessPattern(pluginId);
    
    // 如果已经加载，直接返回
    if (state.state === 'loaded') {
      state.lastAccessed = Date.now();
      state.accessCount++;
      return;
    }
    
    // 如果正在加载，等待现有的加载完成
    if (state.state === 'loading') {
      const existingPromise = this.loadPromises.get(pluginId);
      if (existingPromise) {
        return existingPromise;
      }
    }
    
    // 检查内存压力
    if (this.isMemoryPressureHigh()) {
      await this.handleMemoryPressure();
    }
    
    // 创建加载Promise
    const loadPromise = this.performLoad(pluginId, priority, requester);
    this.loadPromises.set(pluginId, loadPromise);
    
    try {
      await loadPromise;
    } finally {
      this.loadPromises.delete(pluginId);
    }
  }

  /**
   * 执行插件加载
   */
  private async performLoad(
    pluginId: string, 
    priority: number, 
    requester?: string
  ): Promise<void> {
    const state = this.pluginStates.get(pluginId)!;
    
    // 检查依赖
    await this.loadDependencies(pluginId);
    
    // 等待加载槽位
    await this.waitForLoadSlot();
    
    this.activeLoads.add(pluginId);
    state.state = 'loading';
    
    this.emit('plugin-load-started', { pluginId, priority });
    
    const startTime = Date.now();
    pluginPerformanceMonitor.startOperation(pluginId, 'plugin-load');
    
    try {
      // 实际加载插件
      await this.doPluginLoad(pluginId);
      
      const loadTime = Date.now() - startTime;
      state.state = 'loaded';
      state.loadTime = loadTime;
      state.lastAccessed = Date.now();
      state.accessCount++;
      
      pluginPerformanceMonitor.endOperation(pluginId, 'plugin-load');
      
      this.emit('plugin-load-completed', { pluginId, loadTime });
      
      // 启动预测性加载
      if (this.config.enablePredictiveLoading) {
        this.triggerPredictiveLoading(pluginId);
      }
      
      pluginLogger.info('Plugin loaded successfully', pluginId, {
        loadTime,
        requester,
        priority,
      });
      
    } catch (error) {
      state.state = 'error';
      state.errorMessage = (error as Error).message;
      
      this.emit('plugin-load-failed', { pluginId, error: error as Error });
      
      pluginLogger.error('Plugin load failed', pluginId, error as Error);
      throw error;
      
    } finally {
      this.activeLoads.delete(pluginId);
      this.processLoadQueue();
    }
  }

  /**
   * 实际执行插件加载逻辑
   */
  private async doPluginLoad(pluginId: string): Promise<void> {
    // 这里应该调用实际的插件加载逻辑
    // 为了演示，使用延迟模拟加载过程
    
    await new Promise(resolve => setTimeout(resolve, this.config.lazyLoadDelay));
    
    // 模拟内存使用
    const state = this.pluginStates.get(pluginId)!;
    state.memoryUsage = Math.random() * 50 * 1024 * 1024; // 0-50MB
    
    // 这里应该包含实际的插件初始化代码
    // 例如：require(pluginPath), 初始化插件实例等
  }

  /**
   * 加载插件依赖
   */
  private async loadDependencies(pluginId: string): Promise<void> {
    const state = this.pluginStates.get(pluginId);
    if (!state || state.dependencies.length === 0) {
      return;
    }
    
    const dependencyPromises = state.dependencies.map(depId => {
      const depState = this.pluginStates.get(depId);
      if (!depState) {
        throw new Error(`Dependency ${depId} not found for plugin ${pluginId}`);
      }
      
      if (depState.state !== 'loaded') {
        return this.loadPlugin(depId, state.priority + 1, pluginId);
      }
      
      return Promise.resolve();
    });
    
    await Promise.all(dependencyPromises);
  }

  /**
   * 等待加载槽位
   */
  private async waitForLoadSlot(): Promise<void> {
    while (this.activeLoads.size >= this.config.maxConcurrentLoads) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * 队列加载请求
   */
  private queueLoad(
    pluginId: string, 
    priority: number, 
    requester?: string, 
    callback?: (error?: Error) => void
  ): void {
    const request: LoadRequest = {
      pluginId,
      priority,
      requester,
      callback,
      timestamp: Date.now(),
    };
    
    // 按优先级插入队列
    const insertIndex = this.loadQueue.findIndex(req => req.priority < priority);
    if (insertIndex === -1) {
      this.loadQueue.push(request);
    } else {
      this.loadQueue.splice(insertIndex, 0, request);
    }
    
    this.processLoadQueue();
  }

  /**
   * 处理加载队列
   */
  private processLoadQueue(): void {
    while (
      this.loadQueue.length > 0 && 
      this.activeLoads.size < this.config.maxConcurrentLoads
    ) {
      const request = this.loadQueue.shift()!;
      
      this.loadPlugin(request.pluginId, request.priority, request.requester)
        .then(() => {
          if (request.callback) {
            request.callback();
          }
        })
        .catch(error => {
          if (request.callback) {
            request.callback(error);
          }
        });
    }
  }

  /**
   * 更新依赖关系图
   */
  private updateDependencyGraph(pluginId: string, dependencies: string[]): void {
    // 更新依赖项的dependents列表
    for (const depId of dependencies) {
      const depState = this.pluginStates.get(depId);
      if (depState && !depState.dependents.includes(pluginId)) {
        depState.dependents.push(pluginId);
      }
    }
  }

  /**
   * 更新访问模式
   */
  private updateAccessPattern(pluginId: string): void {
    const now = Date.now();
    let pattern = this.accessPatterns.get(pluginId);
    
    if (!pattern) {
      pattern = [];
      this.accessPatterns.set(pluginId, pattern);
    }
    
    pattern.push(now);
    
    // 只保留最近的访问记录
    const cutoff = now - 3600000; // 1小时
    this.accessPatterns.set(
      pluginId, 
      pattern.filter(time => time > cutoff)
    );
  }

  /**
   * 触发预测性加载
   */
  private triggerPredictiveLoading(pluginId: string): void {
    const state = this.pluginStates.get(pluginId);
    if (!state) return;
    
    // 基于依赖关系预测
    for (const dependentId of state.dependents) {
      const dependentState = this.pluginStates.get(dependentId);
      if (dependentState && dependentState.state === 'unloaded') {
        // 延迟加载依赖项
        setTimeout(() => {
          this.queueLoad(dependentId, -1, 'predictive');
        }, this.config.lazyLoadDelay * 2);
      }
    }
    
    // 基于访问模式预测
    this.predictBasedOnAccessPattern(pluginId);
  }

  /**
   * 基于访问模式预测
   */
  private predictBasedOnAccessPattern(pluginId: string): void {
    const pattern = this.accessPatterns.get(pluginId);
    if (!pattern || pattern.length < 2) return;
    
    // 简单的预测逻辑：如果访问频率高，预加载相关插件
    const recentAccesses = pattern.filter(time => time > Date.now() - 300000); // 5分钟内
    
    if (recentAccesses.length >= 3) {
      // 高频访问，预加载相关插件
      for (const [otherPluginId, otherState] of this.pluginStates) {
        if (
          otherPluginId !== pluginId && 
          otherState.state === 'unloaded' &&
          this.arePluginsRelated(pluginId, otherPluginId)
        ) {
          setTimeout(() => {
            this.queueLoad(otherPluginId, -2, 'pattern-prediction');
          }, this.config.lazyLoadDelay * 3);
        }
      }
    }
  }

  /**
   * 检查插件是否相关
   */
  private arePluginsRelated(pluginId1: string, pluginId2: string): boolean {
    const state1 = this.pluginStates.get(pluginId1);
    const state2 = this.pluginStates.get(pluginId2);
    
    if (!state1 || !state2) return false;
    
    // 检查是否有共同依赖或依赖关系
    return (
      state1.dependencies.includes(pluginId2) ||
      state2.dependencies.includes(pluginId1) ||
      state1.dependencies.some(dep => state2.dependencies.includes(dep))
    );
  }

  /**
   * 检查内存压力
   */
  private isMemoryPressureHigh(): boolean {
    const memUsage = process.memoryUsage();
    const totalUsage = memUsage.heapUsed + memUsage.external;
    
    return totalUsage > this.config.memoryPressureThreshold;
  }

  /**
   * 处理内存压力
   */
  private async handleMemoryPressure(): Promise<void> {
    const memUsage = process.memoryUsage();
    const totalUsage = memUsage.heapUsed + memUsage.external;
    
    this.emit('memory-pressure', {
      currentUsage: totalUsage,
      threshold: this.config.memoryPressureThreshold,
    });
    
    // 暂停低优先级插件
    const candidates = Array.from(this.pluginStates.values())
      .filter(state => 
        state.state === 'loaded' && 
        state.priority < 0 && 
        Date.now() - state.lastAccessed > 300000 // 5分钟未访问
      )
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    for (const state of candidates.slice(0, 3)) {
      await this.suspendPlugin(state.pluginId, 'memory-pressure');
    }
    
    pluginLogger.warn('Memory pressure detected, suspended plugins', undefined, {
      currentUsage: totalUsage,
      threshold: this.config.memoryPressureThreshold,
      suspendedCount: candidates.length,
    });
  }

  /**
   * 暂停插件
   */
  public async suspendPlugin(pluginId: string, reason: string): Promise<void> {
    const state = this.pluginStates.get(pluginId);
    if (!state || state.state !== 'loaded') {
      return;
    }
    
    // 检查是否有依赖项正在使用
    const hasActiveDependents = state.dependents.some(depId => {
      const depState = this.pluginStates.get(depId);
      return depState && depState.state === 'loaded' && 
             Date.now() - depState.lastAccessed < 60000; // 1分钟内访问过
    });
    
    if (hasActiveDependents) {
      pluginLogger.debug('Cannot suspend plugin with active dependents', pluginId);
      return;
    }
    
    state.state = 'suspended';
    this.suspendedPlugins.add(pluginId);
    
    // 这里应该包含实际的插件暂停逻辑
    // 例如：清理内存、保存状态等
    
    this.emit('plugin-suspended', { pluginId, reason });
    
    pluginLogger.info('Plugin suspended', pluginId, { reason });
  }

  /**
   * 恢复插件
   */
  public async resumePlugin(pluginId: string): Promise<void> {
    const state = this.pluginStates.get(pluginId);
    if (!state || state.state !== 'suspended') {
      return;
    }
    
    this.suspendedPlugins.delete(pluginId);
    
    // 重新加载插件
    await this.loadPlugin(pluginId, state.priority, 'resume');
    
    this.emit('plugin-resumed', { pluginId });
    
    pluginLogger.info('Plugin resumed', pluginId);
  }

  /**
   * 卸载插件
   */
  public async unloadPlugin(pluginId: string): Promise<void> {
    const state = this.pluginStates.get(pluginId);
    if (!state) {
      return;
    }
    
    // 检查依赖项
    const activeDependents = state.dependents.filter(depId => {
      const depState = this.pluginStates.get(depId);
      return depState && (depState.state === 'loaded' || depState.state === 'loading');
    });
    
    if (activeDependents.length > 0) {
      throw new Error(`Cannot unload plugin ${pluginId}: has active dependents ${activeDependents.join(', ')}`);
    }
    
    state.state = 'unloaded';
    state.loadTime = undefined;
    state.errorMessage = undefined;
    state.memoryUsage = 0;
    
    this.suspendedPlugins.delete(pluginId);
    
    // 这里应该包含实际的插件卸载逻辑
    
    pluginLogger.info('Plugin unloaded', pluginId);
  }

  /**
   * 获取插件状态
   */
  public getPluginState(pluginId: string): PluginLoadState | null {
    return this.pluginStates.get(pluginId) || null;
  }

  /**
   * 获取所有插件状态
   */
  public getAllPluginStates(): PluginLoadState[] {
    return Array.from(this.pluginStates.values());
  }

  /**
   * 获取加载统计
   */
  public getLoadStats(): {
    totalPlugins: number;
    loadedPlugins: number;
    suspendedPlugins: number;
    failedPlugins: number;
    queueLength: number;
    activeLoads: number;
  } {
    const states = Array.from(this.pluginStates.values());
    
    return {
      totalPlugins: states.length,
      loadedPlugins: states.filter(s => s.state === 'loaded').length,
      suspendedPlugins: states.filter(s => s.state === 'suspended').length,
      failedPlugins: states.filter(s => s.state === 'error').length,
      queueLength: this.loadQueue.length,
      activeLoads: this.activeLoads.size,
    };
  }

  /**
   * 开始内存监控
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      if (this.isMemoryPressureHigh()) {
        this.handleMemoryPressure();
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 销毁懒加载管理器
   */
  public destroy(): void {
    // 卸载所有插件
    for (const pluginId of this.pluginStates.keys()) {
      try {
        this.unloadPlugin(pluginId);
      } catch (error) {
        pluginLogger.error('Error unloading plugin during destroy', pluginId, error as Error);
      }
    }
    
    this.pluginStates.clear();
    this.loadQueue = [];
    this.activeLoads.clear();
    this.loadPromises.clear();
    this.accessPatterns.clear();
    this.suspendedPlugins.clear();
    
    pluginLogger.info('PluginLazyLoader destroyed');
  }
}

// 全局懒加载管理器实例
export const pluginLazyLoader = new PluginLazyLoader();