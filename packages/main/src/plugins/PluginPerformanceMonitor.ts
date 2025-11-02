/**
 * 插件性能监控管理器 - 监控插件性能指标和资源使用情况
 */

import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { pluginLogger } from './PluginLogger';
import * as os from 'os';
import * as process from 'process';

export interface PerformanceConfig {
  /** 监控间隔 (毫秒) */
  monitorInterval: number;
  /** 性能数据保留时间 (毫秒) */
  dataRetentionTime: number;
  /** 内存使用警告阈值 (字节) */
  memoryWarningThreshold: number;
  /** CPU使用警告阈值 (百分比) */
  cpuWarningThreshold: number;
  /** 启用详细监控 */
  enableDetailedMonitoring: boolean;
  /** 启用性能分析 */
  enableProfiling: boolean;
}

export interface PerformanceMetrics {
  timestamp: number;
  pluginId: string;
  
  // 内存指标
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  
  // CPU指标
  cpuUsage: {
    user: number;
    system: number;
    percent: number;
  };
  
  // 执行时间指标
  executionTimes: {
    initialization: number;
    lastOperation: number;
    averageOperation: number;
    totalOperations: number;
  };
  
  // 网络指标
  networkStats: {
    requestCount: number;
    responseTime: number;
    errorCount: number;
    bytesTransferred: number;
  };
  
  // 事件循环指标
  eventLoop: {
    delay: number;
    utilization: number;
  };
}

export interface PerformanceAlert {
  type: 'memory' | 'cpu' | 'execution' | 'network' | 'eventloop';
  severity: 'warning' | 'error' | 'critical';
  pluginId: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface PerformanceReport {
  pluginId: string;
  timeRange: { start: number; end: number };
  summary: {
    averageMemory: number;
    peakMemory: number;
    averageCpu: number;
    peakCpu: number;
    totalOperations: number;
    averageResponseTime: number;
    errorRate: number;
  };
  trends: {
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
    performanceTrend: 'improving' | 'degrading' | 'stable';
  };
  recommendations: string[];
}

export interface PerformanceEvents {
  'metrics-collected': { pluginId: string; metrics: PerformanceMetrics };
  'performance-alert': PerformanceAlert;
  'performance-report': { pluginId: string; report: PerformanceReport };
}

export class PluginPerformanceMonitor extends TypedEventEmitter<PerformanceEvents> {
  private config: PerformanceConfig;
  private metricsHistory: Map<string, PerformanceMetrics[]> = new Map();
  private operationTimers: Map<string, Map<string, number>> = new Map();
  private monitorTimer?: NodeJS.Timeout;
  private lastCpuUsage: Map<string, NodeJS.CpuUsage> = new Map();
  private pluginStartTimes: Map<string, number> = new Map();

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    
    this.config = {
      monitorInterval: config.monitorInterval || 5000, // 5 seconds
      dataRetentionTime: config.dataRetentionTime || 3600000, // 1 hour
      memoryWarningThreshold: config.memoryWarningThreshold || 100 * 1024 * 1024, // 100MB
      cpuWarningThreshold: config.cpuWarningThreshold || 80, // 80%
      enableDetailedMonitoring: config.enableDetailedMonitoring !== false,
      enableProfiling: config.enableProfiling || false,
    };

    this.startMonitoring();
    pluginLogger.info('PluginPerformanceMonitor initialized', undefined, { config: this.config });
  }

  /**
   * 开始监控插件
   */
  public startMonitoringPlugin(pluginId: string): void {
    this.pluginStartTimes.set(pluginId, Date.now());
    this.lastCpuUsage.set(pluginId, process.cpuUsage());
    
    if (!this.metricsHistory.has(pluginId)) {
      this.metricsHistory.set(pluginId, []);
    }
    
    if (!this.operationTimers.has(pluginId)) {
      this.operationTimers.set(pluginId, new Map());
    }
    
    pluginLogger.debug('Started monitoring plugin', pluginId);
  }

  /**
   * 停止监控插件
   */
  public stopMonitoringPlugin(pluginId: string): void {
    this.pluginStartTimes.delete(pluginId);
    this.lastCpuUsage.delete(pluginId);
    this.operationTimers.delete(pluginId);
    
    // 保留历史数据，但停止收集新数据
    pluginLogger.debug('Stopped monitoring plugin', pluginId);
  }

  /**
   * 开始操作计时
   */
  public startOperation(pluginId: string, operationId: string): void {
    const timers = this.operationTimers.get(pluginId);
    if (timers) {
      timers.set(operationId, Date.now());
    }
  }

  /**
   * 结束操作计时
   */
  public endOperation(pluginId: string, operationId: string): number {
    const timers = this.operationTimers.get(pluginId);
    if (!timers) {
      return 0;
    }
    
    const startTime = timers.get(operationId);
    if (!startTime) {
      return 0;
    }
    
    const duration = Date.now() - startTime;
    timers.delete(operationId);
    
    // 更新操作统计
    this.updateOperationStats(pluginId, duration);
    
    return duration;
  }

  /**
   * 记录网络请求
   */
  public recordNetworkRequest(
    pluginId: string, 
    responseTime: number, 
    success: boolean, 
    bytesTransferred: number = 0
  ): void {
    const history = this.metricsHistory.get(pluginId);
    if (!history || history.length === 0) {
      return;
    }
    
    const latest = history[history.length - 1];
    latest.networkStats.requestCount++;
    latest.networkStats.responseTime = (latest.networkStats.responseTime + responseTime) / 2;
    latest.networkStats.bytesTransferred += bytesTransferred;
    
    if (!success) {
      latest.networkStats.errorCount++;
    }
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    for (const pluginId of this.pluginStartTimes.keys()) {
      try {
        const metrics = this.gatherPluginMetrics(pluginId);
        if (metrics) {
          this.storeMetrics(pluginId, metrics);
          this.checkPerformanceAlerts(metrics);
          this.emit('metrics-collected', { pluginId, metrics });
        }
      } catch (error) {
        pluginLogger.error('Failed to collect metrics for plugin', pluginId, error as Error);
      }
    }
    
    // 清理过期数据
    this.cleanupOldMetrics();
  }

  /**
   * 收集插件性能指标
   */
  private gatherPluginMetrics(pluginId: string): PerformanceMetrics | null {
    const startTime = this.pluginStartTimes.get(pluginId);
    if (!startTime) {
      return null;
    }
    
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage.get(pluginId));
    
    // 更新CPU使用记录
    this.lastCpuUsage.set(pluginId, process.cpuUsage());
    
    // 计算CPU百分比
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) / 
                      ((now - (this.getLastMetricsTime(pluginId) || now)) / 1000) * 100;
    
    // 获取事件循环延迟
    const eventLoopDelay = this.measureEventLoopDelay();
    
    // 获取操作统计
    const operationStats = this.getOperationStats(pluginId);
    
    // 获取网络统计
    const networkStats = this.getNetworkStats(pluginId);
    
    return {
      timestamp: now,
      pluginId,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        percent: Math.min(cpuPercent, 100), // 限制在100%以内
      },
      executionTimes: operationStats,
      networkStats,
      eventLoop: {
        delay: eventLoopDelay,
        utilization: this.calculateEventLoopUtilization(),
      },
    };
  }

  /**
   * 获取最后一次指标收集时间
   */
  private getLastMetricsTime(pluginId: string): number | null {
    const history = this.metricsHistory.get(pluginId);
    if (!history || history.length === 0) {
      return null;
    }
    return history[history.length - 1].timestamp;
  }

  /**
   * 测量事件循环延迟
   */
  private measureEventLoopDelay(): number {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // 转换为毫秒
      return delay;
    });
    return 0; // 简化实现，实际应该使用异步测量
  }

  /**
   * 计算事件循环利用率
   */
  private calculateEventLoopUtilization(): number {
    // 简化实现，实际应该使用 perf_hooks.performance.eventLoopUtilization()
    return Math.random() * 100; // 占位符
  }

  /**
   * 获取操作统计
   */
  private getOperationStats(pluginId: string): PerformanceMetrics['executionTimes'] {
    const history = this.metricsHistory.get(pluginId);
    if (!history || history.length === 0) {
      return {
        initialization: Date.now() - (this.pluginStartTimes.get(pluginId) || Date.now()),
        lastOperation: 0,
        averageOperation: 0,
        totalOperations: 0,
      };
    }
    
    const latest = history[history.length - 1];
    return latest.executionTimes;
  }

  /**
   * 获取网络统计
   */
  private getNetworkStats(pluginId: string): PerformanceMetrics['networkStats'] {
    const history = this.metricsHistory.get(pluginId);
    if (!history || history.length === 0) {
      return {
        requestCount: 0,
        responseTime: 0,
        errorCount: 0,
        bytesTransferred: 0,
      };
    }
    
    const latest = history[history.length - 1];
    return latest.networkStats;
  }

  /**
   * 更新操作统计
   */
  private updateOperationStats(pluginId: string, duration: number): void {
    const history = this.metricsHistory.get(pluginId);
    if (!history || history.length === 0) {
      return;
    }
    
    const latest = history[history.length - 1];
    latest.executionTimes.lastOperation = duration;
    latest.executionTimes.totalOperations++;
    
    // 计算平均操作时间
    const totalTime = latest.executionTimes.averageOperation * (latest.executionTimes.totalOperations - 1) + duration;
    latest.executionTimes.averageOperation = totalTime / latest.executionTimes.totalOperations;
  }

  /**
   * 存储性能指标
   */
  private storeMetrics(pluginId: string, metrics: PerformanceMetrics): void {
    let history = this.metricsHistory.get(pluginId);
    if (!history) {
      history = [];
      this.metricsHistory.set(pluginId, history);
    }
    
    history.push(metrics);
    
    // 限制历史数据大小
    const maxEntries = Math.ceil(this.config.dataRetentionTime / this.config.monitorInterval);
    if (history.length > maxEntries) {
      history.splice(0, history.length - maxEntries);
    }
  }

  /**
   * 检查性能警报
   */
  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    // 内存使用检查
    if (metrics.memoryUsage.heapUsed > this.config.memoryWarningThreshold) {
      this.emitAlert({
        type: 'memory',
        severity: metrics.memoryUsage.heapUsed > this.config.memoryWarningThreshold * 1.5 ? 'critical' : 'warning',
        pluginId: metrics.pluginId,
        message: `High memory usage: ${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`,
        value: metrics.memoryUsage.heapUsed,
        threshold: this.config.memoryWarningThreshold,
        timestamp: metrics.timestamp,
      });
    }
    
    // CPU使用检查
    if (metrics.cpuUsage.percent > this.config.cpuWarningThreshold) {
      this.emitAlert({
        type: 'cpu',
        severity: metrics.cpuUsage.percent > this.config.cpuWarningThreshold * 1.2 ? 'critical' : 'warning',
        pluginId: metrics.pluginId,
        message: `High CPU usage: ${Math.round(metrics.cpuUsage.percent)}%`,
        value: metrics.cpuUsage.percent,
        threshold: this.config.cpuWarningThreshold,
        timestamp: metrics.timestamp,
      });
    }
    
    // 事件循环延迟检查
    if (metrics.eventLoop.delay > 100) { // 100ms延迟阈值
      this.emitAlert({
        type: 'eventloop',
        severity: metrics.eventLoop.delay > 500 ? 'critical' : 'warning',
        pluginId: metrics.pluginId,
        message: `High event loop delay: ${Math.round(metrics.eventLoop.delay)}ms`,
        value: metrics.eventLoop.delay,
        threshold: 100,
        timestamp: metrics.timestamp,
      });
    }
  }

  /**
   * 发出性能警报
   */
  private emitAlert(alert: PerformanceAlert): void {
    this.emit('performance-alert', alert);
    
    const context = {
      alertType: alert.type,
      value: alert.value,
      threshold: alert.threshold,
    };
    
    if (alert.severity === 'critical') {
      pluginLogger.error(`Performance alert: ${alert.message}`, alert.pluginId, undefined, context);
    } else {
      pluginLogger.warn(`Performance alert: ${alert.message}`, alert.pluginId, context);
    }
  }

  /**
   * 清理过期指标数据
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.dataRetentionTime;
    
    for (const [pluginId, history] of this.metricsHistory) {
      const validMetrics = history.filter(metrics => metrics.timestamp > cutoffTime);
      
      if (validMetrics.length !== history.length) {
        this.metricsHistory.set(pluginId, validMetrics);
        
        pluginLogger.debug('Cleaned up old metrics', pluginId, {
          removed: history.length - validMetrics.length,
          remaining: validMetrics.length,
        });
      }
    }
  }

  /**
   * 生成性能报告
   */
  public generateReport(pluginId: string, timeRange?: { start: number; end: number }): PerformanceReport | null {
    const history = this.metricsHistory.get(pluginId);
    if (!history || history.length === 0) {
      return null;
    }
    
    const now = Date.now();
    const range = timeRange || {
      start: now - 3600000, // 默认1小时
      end: now,
    };
    
    const relevantMetrics = history.filter(
      metrics => metrics.timestamp >= range.start && metrics.timestamp <= range.end
    );
    
    if (relevantMetrics.length === 0) {
      return null;
    }
    
    // 计算汇总统计
    const summary = this.calculateSummary(relevantMetrics);
    
    // 分析趋势
    const trends = this.analyzeTrends(relevantMetrics);
    
    // 生成建议
    const recommendations = this.generateRecommendations(summary, trends);
    
    const report: PerformanceReport = {
      pluginId,
      timeRange: range,
      summary,
      trends,
      recommendations,
    };
    
    this.emit('performance-report', { pluginId, report });
    
    return report;
  }

  /**
   * 计算汇总统计
   */
  private calculateSummary(metrics: PerformanceMetrics[]): PerformanceReport['summary'] {
    const memoryValues = metrics.map(m => m.memoryUsage.heapUsed);
    const cpuValues = metrics.map(m => m.cpuUsage.percent);
    const responseTimeValues = metrics.map(m => m.networkStats.responseTime).filter(t => t > 0);
    
    const totalRequests = metrics.reduce((sum, m) => sum + m.networkStats.requestCount, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.networkStats.errorCount, 0);
    
    return {
      averageMemory: memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length,
      peakMemory: Math.max(...memoryValues),
      averageCpu: cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length,
      peakCpu: Math.max(...cpuValues),
      totalOperations: metrics.reduce((sum, m) => sum + m.executionTimes.totalOperations, 0),
      averageResponseTime: responseTimeValues.length > 0 
        ? responseTimeValues.reduce((sum, val) => sum + val, 0) / responseTimeValues.length 
        : 0,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
    };
  }

  /**
   * 分析性能趋势
   */
  private analyzeTrends(metrics: PerformanceMetrics[]): PerformanceReport['trends'] {
    if (metrics.length < 2) {
      return {
        memoryTrend: 'stable',
        cpuTrend: 'stable',
        performanceTrend: 'stable',
      };
    }
    
    const half = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, half);
    const secondHalf = metrics.slice(half);
    
    const firstMemory = firstHalf.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / firstHalf.length;
    const secondMemory = secondHalf.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / secondHalf.length;
    
    const firstCpu = firstHalf.reduce((sum, m) => sum + m.cpuUsage.percent, 0) / firstHalf.length;
    const secondCpu = secondHalf.reduce((sum, m) => sum + m.cpuUsage.percent, 0) / secondHalf.length;
    
    const memoryChange = (secondMemory - firstMemory) / firstMemory;
    const cpuChange = (secondCpu - firstCpu) / firstCpu;
    
    return {
      memoryTrend: Math.abs(memoryChange) < 0.1 ? 'stable' : memoryChange > 0 ? 'increasing' : 'decreasing',
      cpuTrend: Math.abs(cpuChange) < 0.1 ? 'stable' : cpuChange > 0 ? 'increasing' : 'decreasing',
      performanceTrend: (memoryChange + cpuChange) > 0.2 ? 'degrading' : 
                       (memoryChange + cpuChange) < -0.2 ? 'improving' : 'stable',
    };
  }

  /**
   * 生成性能建议
   */
  private generateRecommendations(
    summary: PerformanceReport['summary'], 
    trends: PerformanceReport['trends']
  ): string[] {
    const recommendations: string[] = [];
    
    if (summary.averageMemory > this.config.memoryWarningThreshold * 0.8) {
      recommendations.push('考虑优化内存使用，检查是否存在内存泄漏');
    }
    
    if (summary.averageCpu > this.config.cpuWarningThreshold * 0.8) {
      recommendations.push('CPU使用率较高，考虑优化算法或使用异步处理');
    }
    
    if (summary.errorRate > 0.05) {
      recommendations.push('错误率较高，建议检查错误处理逻辑');
    }
    
    if (summary.averageResponseTime > 1000) {
      recommendations.push('响应时间较长，考虑使用缓存或优化网络请求');
    }
    
    if (trends.memoryTrend === 'increasing') {
      recommendations.push('内存使用呈上升趋势，建议监控内存泄漏');
    }
    
    if (trends.cpuTrend === 'increasing') {
      recommendations.push('CPU使用呈上升趋势，建议优化计算密集型操作');
    }
    
    if (trends.performanceTrend === 'degrading') {
      recommendations.push('整体性能呈下降趋势，建议进行全面性能优化');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('性能表现良好，继续保持');
    }
    
    return recommendations;
  }

  /**
   * 获取插件性能指标
   */
  public getMetrics(pluginId: string, limit?: number): PerformanceMetrics[] {
    const history = this.metricsHistory.get(pluginId) || [];
    
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    
    return [...history];
  }

  /**
   * 获取所有监控的插件
   */
  public getMonitoredPlugins(): string[] {
    return Array.from(this.pluginStartTimes.keys());
  }

  /**
   * 开始监控
   */
  private startMonitoring(): void {
    this.monitorTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitorInterval);
  }

  /**
   * 停止监控
   */
  private stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }
  }

  /**
   * 销毁性能监控器
   */
  public destroy(): void {
    this.stopMonitoring();
    this.metricsHistory.clear();
    this.operationTimers.clear();
    this.pluginStartTimes.clear();
    this.lastCpuUsage.clear();
    
    pluginLogger.info('PluginPerformanceMonitor destroyed');
  }
}

// 全局性能监控器实例
export const pluginPerformanceMonitor = new PluginPerformanceMonitor();