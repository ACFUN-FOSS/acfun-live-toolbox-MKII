import { EventEmitter } from 'events';
import { connectionPool } from './ConnectionPoolManager';

// 性能指标接口
export interface PerformanceMetrics {
  timestamp: Date;
  connectionPool: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    failedConnections: number;
    averageResponseTime: number;
    errorRate: number;
    circuitBreakerOpen: boolean;
  };
  system: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage | null;
  };
  application: {
    uptime: number;
    requestCount: number;
    errorCount: number;
  };
}

// 性能监控器类
export class PerformanceMonitor extends EventEmitter {
  private isRunning: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize: number = 100;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private startTime: Date = new Date();
  private requestCount: number = 0;
  private errorCount: number = 0;

  constructor(private config: {
    interval?: number;
    maxHistorySize?: number;
    enableConnectionPoolMonitoring?: boolean;
  } = {}) {
    super();
    this.maxHistorySize = config.maxHistorySize || 100;
  }

  /**
   * 启动性能监控
   */
  start(): void {
    if (this.isRunning) {
      console.log('[PerformanceMonitor] Already running');
      return;
    }

    this.isRunning = true;
    this.startTime = new Date();
    
    const interval = this.config.interval || 30000; // 默认30秒
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    // 启动连接池性能监控
    if (this.config.enableConnectionPoolMonitoring !== false) {
      connectionPool.startPerformanceMonitoring((metrics) => {
        this.emit('connectionPoolMetrics', metrics);
      });
    }

    console.log(`[PerformanceMonitor] Started with ${interval}ms interval`);
    this.emit('started');
  }

  /**
   * 停止性能监控
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('[PerformanceMonitor] Stopped');
    this.emit('stopped');
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    try {
      const connectionPoolMetrics = connectionPool.getPerformanceMetrics();
      
      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        connectionPool: {
          totalConnections: connectionPoolMetrics.connectionPool.totalConnections,
          activeConnections: connectionPoolMetrics.connectionPool.activeConnections,
          idleConnections: connectionPoolMetrics.connectionPool.idleConnections,
          failedConnections: connectionPoolMetrics.connectionPool.failedRequests,
          averageResponseTime: connectionPoolMetrics.connectionPool.averageResponseTime,
          errorRate: connectionPoolMetrics.performance.errorRate,
          circuitBreakerOpen: connectionPoolMetrics.performance.circuitBreakerStatus.isOpen
        },
        system: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: this.getCpuUsage()
        },
        application: {
          uptime: Date.now() - this.startTime.getTime(),
          requestCount: this.requestCount,
          errorCount: this.errorCount
        }
      };

      // 添加到历史记录
      this.metricsHistory.push(metrics);
      
      // 限制历史记录大小
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      // 发出指标事件
      this.emit('metrics', metrics);

      // 检查是否有异常情况需要告警
      this.checkAlerts(metrics);

    } catch (error) {
      console.error('[PerformanceMonitor] Error collecting metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * 获取CPU使用率
   */
  private getCpuUsage(): NodeJS.CpuUsage | null {
    try {
      const currentUsage = process.cpuUsage(this.lastCpuUsage || undefined);
      this.lastCpuUsage = process.cpuUsage();
      return currentUsage;
    } catch (error) {
      console.error('[PerformanceMonitor] Error getting CPU usage:', error);
      return null;
    }
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    // 内存使用率告警
    const memoryUsageMB = metrics.system.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 500) { // 500MB
      this.emit('alert', {
        type: 'high_memory_usage',
        message: `High memory usage: ${memoryUsageMB.toFixed(2)}MB`,
        metrics
      });
    }

    // 连接池错误率告警
    if (metrics.connectionPool.errorRate > 0.1) { // 10%
      this.emit('alert', {
        type: 'high_error_rate',
        message: `High connection pool error rate: ${(metrics.connectionPool.errorRate * 100).toFixed(2)}%`,
        metrics
      });
    }

    // 熔断器开启告警
    if (metrics.connectionPool.circuitBreakerOpen) {
      this.emit('alert', {
        type: 'circuit_breaker_open',
        message: 'Connection pool circuit breaker is open',
        metrics
      });
    }

    // 响应时间告警
    if (metrics.connectionPool.averageResponseTime > 5000) { // 5秒
      this.emit('alert', {
        type: 'slow_response',
        message: `Slow average response time: ${metrics.connectionPool.averageResponseTime}ms`,
        metrics
      });
    }
  }

  /**
   * 增加请求计数
   */
  incrementRequestCount(): void {
    this.requestCount++;
  }

  /**
   * 增加错误计数
   */
  incrementErrorCount(): void {
    this.errorCount++;
  }

  /**
   * 获取最新的性能指标
   */
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 ? 
      this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  /**
   * 获取性能指标历史
   */
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit && limit < this.metricsHistory.length) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  /**
   * 获取性能摘要
   */
  getPerformanceSummary(): {
    uptime: number;
    totalRequests: number;
    totalErrors: number;
    averageMemoryUsage: number;
    averageResponseTime: number;
    connectionPoolHealth: string;
  } {
    const latest = this.getLatestMetrics();
    const history = this.getMetricsHistory();
    
    const averageMemoryUsage = history.length > 0 ? 
      history.reduce((sum, m) => sum + m.system.memoryUsage.heapUsed, 0) / history.length / 1024 / 1024 : 0;
    
    const averageResponseTime = history.length > 0 ?
      history.reduce((sum, m) => sum + m.connectionPool.averageResponseTime, 0) / history.length : 0;

    let connectionPoolHealth = 'unknown';
    if (latest) {
      if (latest.connectionPool.circuitBreakerOpen) {
        connectionPoolHealth = 'critical';
      } else if (latest.connectionPool.errorRate > 0.05) {
        connectionPoolHealth = 'warning';
      } else {
        connectionPoolHealth = 'healthy';
      }
    }

    return {
      uptime: latest ? latest.application.uptime : 0,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      averageMemoryUsage,
      averageResponseTime,
      connectionPoolHealth
    };
  }

  /**
   * 重置统计信息
   */
  reset(): void {
    this.metricsHistory = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.startTime = new Date();
    this.lastCpuUsage = null;
    console.log('[PerformanceMonitor] Statistics reset');
  }

  /**
   * 获取运行状态
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }
}

// 创建全局性能监控器实例
export const performanceMonitor = new PerformanceMonitor({
  interval: 30000, // 30秒
  maxHistorySize: 100,
  enableConnectionPoolMonitoring: true
});

// 导出便捷函数
export function startPerformanceMonitoring(): void {
  performanceMonitor.start();
}

export function stopPerformanceMonitoring(): void {
  performanceMonitor.stop();
}

export function getPerformanceMetrics(): PerformanceMetrics | null {
  return performanceMonitor.getLatestMetrics();
}

export function getPerformanceSummary() {
  return performanceMonitor.getPerformanceSummary();
}