# 性能优化 API 文档

## 概述

本文档详细介绍了 AcFun Live Toolbox MKII 中新增的性能优化相关 API 接口。这些接口提供了内存管理、连接池、缓存、性能监控和懒加载等功能，帮助开发者构建高性能的插件。

## PluginManager 性能优化接口

### 获取性能指标

#### `getPluginPerformanceMetrics(pluginId: string)`

获取指定插件的性能指标。

**参数:**
- `pluginId` (string): 插件ID

**返回值:**
```typescript
interface PluginPerformanceMetrics {
  pluginId: string;
  currentMemoryUsage: number;      // 当前内存使用量 (字节)
  peakMemoryUsage: number;         // 峰值内存使用量 (字节)
  averageMemoryUsage: number;      // 平均内存使用量 (字节)
  currentCpuUsage: number;         // 当前CPU使用率 (%)
  averageCpuUsage: number;         // 平均CPU使用率 (%)
  peakCpuUsage: number;           // 峰值CPU使用率 (%)
  averageResponseTime: number;     // 平均响应时间 (毫秒)
  errorCount: number;             // 错误总数
  errorRate: number;              // 错误率 (0-1)
  uptime: number;                 // 运行时间 (毫秒)
  lastUpdated: number;            // 最后更新时间戳
}
```

**示例:**
```typescript
const pluginManager = PluginManager.getInstance();
const metrics = pluginManager.getPluginPerformanceMetrics('my-plugin');

console.log(`插件内存使用: ${(metrics.currentMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
console.log(`平均响应时间: ${metrics.averageResponseTime.toFixed(2)} ms`);
console.log(`错误率: ${(metrics.errorRate * 100).toFixed(2)}%`);
```

### 获取缓存统计

#### `getPluginCacheStats(pluginId?: string)`

获取插件缓存统计信息。

**参数:**
- `pluginId` (string, 可选): 插件ID，如果不提供则返回全局统计

**返回值:**
```typescript
interface CacheStats {
  totalItems: number;        // 缓存项总数
  totalSize: number;         // 缓存总大小 (字节)
  hits: number;             // 命中次数
  misses: number;           // 未命中次数
  hitRate: number;          // 命中率 (0-1)
  evictions: number;        // 驱逐次数
  expirations: number;      // 过期次数
  oldestItem?: number;      // 最旧项时间戳
  newestItem?: number;      // 最新项时间戳
}
```

**示例:**
```typescript
// 获取特定插件的缓存统计
const pluginCacheStats = pluginManager.getPluginCacheStats('my-plugin');
console.log(`缓存命中率: ${(pluginCacheStats.hitRate * 100).toFixed(2)}%`);

// 获取全局缓存统计
const globalCacheStats = pluginManager.getPluginCacheStats();
console.log(`全局缓存大小: ${(globalCacheStats.totalSize / 1024 / 1024).toFixed(2)} MB`);
```

### 获取懒加载状态

#### `getPluginLazyLoadStatus(pluginId?: string)`

获取插件懒加载状态信息。

**参数:**
- `pluginId` (string, 可选): 插件ID，如果不提供则返回全局状态

**返回值:**
```typescript
interface LazyLoadStatus {
  totalRegistered: number;     // 已注册插件总数
  totalLoaded: number;         // 已加载插件总数
  loadingQueue: number;        // 加载队列长度
  suspended: boolean;          // 是否暂停加载
  memoryPressure: boolean;     // 是否存在内存压力
  concurrentLoads: number;     // 当前并发加载数
  maxConcurrentLoads: number;  // 最大并发加载数
  pluginStatus?: {
    [pluginId: string]: 'registered' | 'loading' | 'loaded' | 'failed';
  };
}
```

**示例:**
```typescript
// 获取特定插件状态
const pluginStatus = pluginManager.getPluginLazyLoadStatus('my-plugin');
console.log(`插件状态: ${pluginStatus.pluginStatus?.['my-plugin']}`);

// 获取全局懒加载状态
const globalStatus = pluginManager.getPluginLazyLoadStatus();
console.log(`已加载插件: ${globalStatus.totalLoaded}/${globalStatus.totalRegistered}`);
console.log(`加载队列: ${globalStatus.loadingQueue}个插件等待加载`);
```

### 获取内存池统计

#### `getMemoryPoolStats()`

获取内存池使用统计信息。

**返回值:**
```typescript
interface MemoryPoolStats {
  total: number;           // 总内存容量 (字节)
  used: number;           // 已使用内存 (字节)
  available: number;      // 可用内存 (字节)
  fragmentation: number;  // 碎片率 (0-1)
  allocations: number;    // 分配次数
  deallocations: number;  // 释放次数
  blocks: {
    total: number;        // 总块数
    free: number;         // 空闲块数
    used: number;         // 已使用块数
  };
}
```

**示例:**
```typescript
const memoryStats = pluginManager.getMemoryPoolStats();
console.log(`内存池使用率: ${(memoryStats.used / memoryStats.total * 100).toFixed(2)}%`);
console.log(`内存碎片率: ${(memoryStats.fragmentation * 100).toFixed(2)}%`);
console.log(`分配/释放比: ${memoryStats.allocations}/${memoryStats.deallocations}`);
```

### 获取连接池统计

#### `getConnectionPoolStats()`

获取连接池使用统计信息。

**返回值:**
```typescript
interface ConnectionPoolStats {
  totalConnections: number;      // 总连接数
  activeConnections: number;     // 活跃连接数
  idleConnections: number;       // 空闲连接数
  connectionsByType: {           // 按类型分组的连接数
    [type: string]: number;
  };
  averageAcquisitionTime: number; // 平均获取时间 (毫秒)
  totalAcquisitions: number;      // 总获取次数
  totalReleases: number;          // 总释放次数
  healthyConnections: number;     // 健康连接数
  unhealthyConnections: number;   // 不健康连接数
}
```

**示例:**
```typescript
const connectionStats = pluginManager.getConnectionPoolStats();
console.log(`连接池使用率: ${(connectionStats.activeConnections / connectionStats.totalConnections * 100).toFixed(2)}%`);
console.log(`平均获取时间: ${connectionStats.averageAcquisitionTime.toFixed(2)} ms`);

// 显示各类型连接分布
for (const [type, count] of Object.entries(connectionStats.connectionsByType)) {
  console.log(`${type} 连接: ${count}个`);
}
```

### 生成性能报告

#### `generatePerformanceReport(pluginId?: string)`

生成详细的性能报告。

**参数:**
- `pluginId` (string, 可选): 插件ID，如果不提供则生成全局报告

**返回值:**
```typescript
interface PerformanceReport {
  timestamp: number;
  reportType: 'plugin' | 'global';
  pluginId?: string;
  
  // 性能指标摘要
  summary: {
    totalPlugins: number;
    activePlugins: number;
    totalMemoryUsage: number;
    averageCpuUsage: number;
    totalErrors: number;
    averageResponseTime: number;
  };
  
  // 详细指标
  metrics: PluginPerformanceMetrics[];
  
  // 资源使用情况
  resources: {
    memoryPool: MemoryPoolStats;
    connectionPool: ConnectionPoolStats;
    cache: CacheStats;
    lazyLoad: LazyLoadStatus;
  };
  
  // 性能建议
  recommendations: string[];
  
  // 告警信息
  alerts: Array<{
    level: 'info' | 'warning' | 'error';
    message: string;
    pluginId?: string;
  }>;
}
```

**示例:**
```typescript
// 生成特定插件报告
const pluginReport = pluginManager.generatePerformanceReport('my-plugin');
console.log('插件性能报告:');
console.log(`- 内存使用: ${(pluginReport.summary.totalMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
console.log(`- 平均响应时间: ${pluginReport.summary.averageResponseTime.toFixed(2)} ms`);

// 显示建议
pluginReport.recommendations.forEach((rec, index) => {
  console.log(`${index + 1}. ${rec}`);
});

// 生成全局报告
const globalReport = pluginManager.generatePerformanceReport();
console.log(`系统概览: ${globalReport.summary.activePlugins}/${globalReport.summary.totalPlugins} 插件运行中`);
```

### 缓存管理

#### `clearPluginCache(pluginId?: string)`

清理插件缓存。

**参数:**
- `pluginId` (string, 可选): 插件ID，如果不提供则清理所有缓存

**返回值:** `Promise<void>`

**示例:**
```typescript
// 清理特定插件缓存
await pluginManager.clearPluginCache('my-plugin');
console.log('插件缓存已清理');

// 清理所有缓存
await pluginManager.clearPluginCache();
console.log('所有缓存已清理');
```

### 插件预加载

#### `preloadPlugins(pluginIds: string[], options?: PreloadOptions)`

预加载指定的插件。

**参数:**
- `pluginIds` (string[]): 要预加载的插件ID列表
- `options` (PreloadOptions, 可选): 预加载选项

```typescript
interface PreloadOptions {
  priority?: 'high' | 'normal' | 'low';  // 预加载优先级
  timeout?: number;                       // 超时时间 (毫秒)
  skipIfLoaded?: boolean;                // 如果已加载则跳过
  maxConcurrent?: number;                // 最大并发数
}
```

**返回值:** `Promise<PreloadResult[]>`

```typescript
interface PreloadResult {
  pluginId: string;
  success: boolean;
  loadTime?: number;    // 加载时间 (毫秒)
  error?: string;       // 错误信息
}
```

**示例:**
```typescript
// 预加载多个插件
const results = await pluginManager.preloadPlugins(
  ['plugin-a', 'plugin-b', 'plugin-c'],
  {
    priority: 'high',
    timeout: 5000,
    maxConcurrent: 2
  }
);

results.forEach(result => {
  if (result.success) {
    console.log(`✅ ${result.pluginId} 预加载成功 (${result.loadTime}ms)`);
  } else {
    console.error(`❌ ${result.pluginId} 预加载失败: ${result.error}`);
  }
});
```

### 懒加载控制

#### `suspendPluginLazyLoading()`

暂停插件懒加载。

**返回值:** `Promise<void>`

#### `resumePluginLazyLoading()`

恢复插件懒加载。

**返回值:** `Promise<void>`

**示例:**
```typescript
// 在内存压力大时暂停懒加载
const memoryStats = pluginManager.getMemoryPoolStats();
if (memoryStats.used / memoryStats.total > 0.9) {
  await pluginManager.suspendPluginLazyLoading();
  console.log('⏸️  懒加载已暂停 (内存压力)');
  
  // 清理缓存释放内存
  await pluginManager.clearPluginCache();
  
  // 等待内存释放后恢复
  setTimeout(async () => {
    await pluginManager.resumePluginLazyLoading();
    console.log('▶️  懒加载已恢复');
  }, 10000);
}
```

## 性能监控事件

### 事件监听

PluginManager 提供了性能相关的事件监听功能：

```typescript
// 监听性能告警
pluginManager.on('performance:alert', (alert) => {
  console.warn(`⚠️  性能告警: ${alert.message}`);
  
  if (alert.level === 'error') {
    // 处理严重性能问题
    handleCriticalPerformanceIssue(alert);
  }
});

// 监听内存压力
pluginManager.on('memory:pressure', (data) => {
  console.warn(`🧠 内存压力: 使用率 ${data.usagePercent}%`);
  
  // 自动清理缓存
  pluginManager.clearPluginCache();
});

// 监听连接池状态
pluginManager.on('connectionPool:full', (data) => {
  console.warn(`🔗 连接池已满: ${data.activeConnections}/${data.totalConnections}`);
  
  // 可以考虑扩展连接池或优化连接使用
});

// 监听缓存命中率低
pluginManager.on('cache:lowHitRate', (data) => {
  console.warn(`💾 缓存命中率低: ${data.hitRate}%`);
  
  // 可以考虑调整缓存策略
});
```

## 最佳实践

### 1. 性能监控集成

```typescript
class PluginPerformanceManager {
  private pluginManager: PluginManager;
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.pluginManager = PluginManager.getInstance();
    this.setupPerformanceMonitoring();
  }
  
  private setupPerformanceMonitoring() {
    // 定期检查性能指标
    this.monitoringInterval = setInterval(() => {
      this.checkPerformanceMetrics();
    }, 30000); // 每30秒检查一次
    
    // 监听性能事件
    this.pluginManager.on('performance:alert', this.handlePerformanceAlert.bind(this));
    this.pluginManager.on('memory:pressure', this.handleMemoryPressure.bind(this));
  }
  
  private async checkPerformanceMetrics() {
    const report = this.pluginManager.generatePerformanceReport();
    
    // 检查内存使用
    if (report.summary.totalMemoryUsage > 200 * 1024 * 1024) { // 200MB
      console.warn('系统内存使用过高，开始优化...');
      await this.optimizeMemoryUsage();
    }
    
    // 检查响应时间
    if (report.summary.averageResponseTime > 1000) { // 1秒
      console.warn('系统响应时间过长，开始优化...');
      await this.optimizeResponseTime();
    }
  }
  
  private async handlePerformanceAlert(alert: any) {
    switch (alert.type) {
      case 'memory':
        await this.optimizeMemoryUsage();
        break;
      case 'cpu':
        await this.optimizeCpuUsage();
        break;
      case 'response_time':
        await this.optimizeResponseTime();
        break;
    }
  }
  
  private async handleMemoryPressure(data: any) {
    // 暂停懒加载
    await this.pluginManager.suspendPluginLazyLoading();
    
    // 清理缓存
    await this.pluginManager.clearPluginCache();
    
    // 触发垃圾回收
    if (global.gc) {
      global.gc();
    }
    
    // 等待内存释放后恢复
    setTimeout(async () => {
      await this.pluginManager.resumePluginLazyLoading();
    }, 5000);
  }
  
  private async optimizeMemoryUsage() {
    // 清理低优先级插件缓存
    const report = this.pluginManager.generatePerformanceReport();
    
    for (const metric of report.metrics) {
      if (metric.currentMemoryUsage > 50 * 1024 * 1024) { // 50MB
        await this.pluginManager.clearPluginCache(metric.pluginId);
      }
    }
  }
  
  private async optimizeResponseTime() {
    // 预加载高频使用的插件
    const highPriorityPlugins = ['core-plugin', 'ui-plugin', 'api-plugin'];
    await this.pluginManager.preloadPlugins(highPriorityPlugins, {
      priority: 'high',
      maxConcurrent: 3
    });
  }
  
  private async optimizeCpuUsage() {
    // 暂时降低监控频率
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = setInterval(() => {
        this.checkPerformanceMetrics();
      }, 60000); // 改为每分钟检查一次
    }
  }
  
  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}
```

### 2. 自适应性能优化

```typescript
class AdaptivePerformanceOptimizer {
  private pluginManager: PluginManager;
  private optimizationHistory: Map<string, number> = new Map();
  
  constructor() {
    this.pluginManager = PluginManager.getInstance();
  }
  
  async optimizeBasedOnUsage() {
    const report = this.pluginManager.generatePerformanceReport();
    
    // 根据使用模式调整缓存策略
    await this.adjustCacheStrategy(report);
    
    // 根据负载调整连接池大小
    await this.adjustConnectionPool(report);
    
    // 根据内存使用调整懒加载策略
    await this.adjustLazyLoadStrategy(report);
  }
  
  private async adjustCacheStrategy(report: PerformanceReport) {
    const cacheStats = report.resources.cache;
    
    if (cacheStats.hitRate < 0.7) {
      // 命中率低，可能需要预热缓存
      console.log('缓存命中率低，开始预热常用数据...');
      await this.preloadCommonData();
    } else if (cacheStats.hitRate > 0.95 && cacheStats.totalSize > 100 * 1024 * 1024) {
      // 命中率很高但占用内存多，可以适当减少缓存
      console.log('缓存效率高但占用内存多，开始优化缓存大小...');
      await this.optimizeCacheSize();
    }
  }
  
  private async adjustConnectionPool(report: PerformanceReport) {
    const connectionStats = report.resources.connectionPool;
    const usageRate = connectionStats.activeConnections / connectionStats.totalConnections;
    
    if (usageRate > 0.8) {
      console.log('连接池使用率高，建议增加连接数');
      // 这里可以动态调整连接池配置
    } else if (usageRate < 0.3) {
      console.log('连接池使用率低，可以减少连接数以节省资源');
    }
  }
  
  private async adjustLazyLoadStrategy(report: PerformanceReport) {
    const memoryStats = report.resources.memoryPool;
    const lazyLoadStatus = report.resources.lazyLoad;
    
    if (memoryStats.used / memoryStats.total > 0.8) {
      // 内存使用率高，暂停懒加载
      if (!lazyLoadStatus.suspended) {
        await this.pluginManager.suspendPluginLazyLoading();
        console.log('内存使用率高，暂停懒加载');
      }
    } else if (memoryStats.used / memoryStats.total < 0.5) {
      // 内存使用率低，可以恢复懒加载
      if (lazyLoadStatus.suspended) {
        await this.pluginManager.resumePluginLazyLoading();
        console.log('内存使用率正常，恢复懒加载');
      }
    }
  }
  
  private async preloadCommonData() {
    // 预加载常用插件
    const commonPlugins = ['dashboard', 'settings', 'notifications'];
    await this.pluginManager.preloadPlugins(commonPlugins);
  }
  
  private async optimizeCacheSize() {
    // 清理使用频率低的缓存
    await this.pluginManager.clearPluginCache();
  }
}
```

## 错误处理

所有性能优化 API 都包含适当的错误处理：

```typescript
try {
  const metrics = pluginManager.getPluginPerformanceMetrics('non-existent-plugin');
} catch (error) {
  if (error.code === 'PLUGIN_NOT_FOUND') {
    console.error('插件不存在');
  } else if (error.code === 'MONITORING_NOT_STARTED') {
    console.error('插件监控未启动');
  } else {
    console.error('获取性能指标失败:', error.message);
  }
}

try {
  await pluginManager.preloadPlugins(['plugin1', 'plugin2']);
} catch (error) {
  if (error.code === 'PRELOAD_TIMEOUT') {
    console.error('预加载超时');
  } else if (error.code === 'MEMORY_PRESSURE') {
    console.error('内存压力过大，无法预加载');
  } else {
    console.error('预加载失败:', error.message);
  }
}
```

## 总结

这些性能优化 API 提供了全面的性能管理功能，包括：

1. **实时监控**: 获取详细的性能指标和统计信息
2. **资源管理**: 管理内存池、连接池和缓存
3. **智能优化**: 自动调整和优化系统性能
4. **预测性维护**: 基于历史数据预测和预防性能问题
5. **事件驱动**: 响应性能事件进行实时优化

通过合理使用这些 API，开发者可以构建高性能、可扩展的插件系统。