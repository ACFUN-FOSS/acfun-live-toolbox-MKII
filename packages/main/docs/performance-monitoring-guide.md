# 性能监控和调试指南

## 概述

本指南详细介绍了如何在 AcFun Live Toolbox MKII 中监控插件性能、诊断性能问题和进行性能调试。通过本指南，开发者可以有效地识别和解决性能瓶颈。

## 性能监控系统架构

### 监控组件概览

```
┌─────────────────────────────────────────────────────────────┐
│                    性能监控系统                              │
├─────────────────────────────────────────────────────────────┤
│  PluginPerformanceMonitor (核心监控器)                      │
│  ├── 实时指标收集                                           │
│  ├── 阈值检查和告警                                         │
│  ├── 历史数据管理                                           │
│  └── 性能报告生成                                           │
├─────────────────────────────────────────────────────────────┤
│  资源监控组件                                               │
│  ├── MemoryPoolManager (内存监控)                          │
│  ├── ConnectionPoolManager (连接监控)                      │
│  ├── PluginCacheManager (缓存监控)                         │
│  └── PluginLazyLoader (加载监控)                           │
├─────────────────────────────────────────────────────────────┤
│  数据收集和分析                                             │
│  ├── 指标聚合                                               │
│  ├── 趋势分析                                               │
│  ├── 异常检测                                               │
│  └── 性能基准对比                                           │
└─────────────────────────────────────────────────────────────┘
```

## 监控指标详解

### 1. 内存使用指标

#### 监控项目
- **堆内存使用量** (Heap Used)
- **堆内存总量** (Heap Total)
- **外部内存使用** (External Memory)
- **内存增长率** (Memory Growth Rate)
- **内存峰值** (Peak Memory Usage)

#### 获取内存指标

```typescript
import { PluginPerformanceMonitor } from '../plugins/PluginPerformanceMonitor';

const monitor = PluginPerformanceMonitor.getInstance();
const pluginId = 'my-plugin';

// 开始监控
monitor.startMonitoring(pluginId);

// 记录内存使用
function recordMemoryUsage() {
  const memUsage = process.memoryUsage();
  
  // 记录堆内存使用
  monitor.recordMemoryUsage(pluginId, memUsage.heapUsed);
  
  // 记录详细内存信息
  console.log('内存使用详情:');
  console.log(`- 堆已使用: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- 堆总量: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- 外部内存: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
}

// 定期记录内存使用
setInterval(recordMemoryUsage, 5000);
```

#### 内存监控告警

```typescript
// 设置内存使用阈值
const memoryThreshold = 100 * 1024 * 1024; // 100MB

function checkMemoryUsage() {
  const metrics = monitor.getMetrics(pluginId);
  
  if (metrics.currentMemoryUsage > memoryThreshold) {
    console.warn(`⚠️  插件 ${pluginId} 内存使用超过阈值:`);
    console.warn(`   当前使用: ${(metrics.currentMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
    console.warn(`   阈值: ${(memoryThreshold / 1024 / 1024).toFixed(2)} MB`);
    
    // 触发内存清理
    await triggerMemoryCleanup();
  }
  
  // 检查内存增长趋势
  if (metrics.memoryGrowthRate > 0.1) { // 10%增长率
    console.warn(`⚠️  插件 ${pluginId} 内存增长过快: ${(metrics.memoryGrowthRate * 100).toFixed(2)}%/分钟`);
  }
}

async function triggerMemoryCleanup() {
  // 清理插件缓存
  const cacheManager = PluginCacheManager.getInstance();
  cacheManager.clearPluginCache(pluginId);
  
  // 触发垃圾回收
  if (global.gc) {
    global.gc();
  }
  
  console.log('✅ 内存清理完成');
}
```

### 2. CPU使用指标

#### 监控项目
- **CPU使用率** (CPU Usage Percentage)
- **用户态时间** (User CPU Time)
- **系统态时间** (System CPU Time)
- **CPU峰值使用** (Peak CPU Usage)

#### CPU监控实现

```typescript
class CPUMonitor {
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastTimestamp: number = 0;
  
  startCPUMonitoring(pluginId: string) {
    this.lastCpuUsage = process.cpuUsage();
    this.lastTimestamp = Date.now();
    
    setInterval(() => {
      this.recordCPUUsage(pluginId);
    }, 1000);
  }
  
  private recordCPUUsage(pluginId: string) {
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    const currentTimestamp = Date.now();
    const timeDiff = currentTimestamp - this.lastTimestamp;
    
    // 计算CPU使用率 (微秒转换为百分比)
    const userCpuPercent = (currentCpuUsage.user / 1000 / timeDiff) * 100;
    const systemCpuPercent = (currentCpuUsage.system / 1000 / timeDiff) * 100;
    const totalCpuPercent = userCpuPercent + systemCpuPercent;
    
    // 记录CPU使用率
    monitor.recordCpuUsage(pluginId, totalCpuPercent);
    
    // 更新基准值
    this.lastCpuUsage = process.cpuUsage();
    this.lastTimestamp = currentTimestamp;
    
    // 检查CPU使用告警
    if (totalCpuPercent > 80) {
      console.warn(`⚠️  插件 ${pluginId} CPU使用率过高: ${totalCpuPercent.toFixed(2)}%`);
    }
  }
}
```

### 3. 响应时间指标

#### 监控项目
- **平均响应时间** (Average Response Time)
- **响应时间分布** (Response Time Distribution)
- **95%分位数响应时间** (95th Percentile)
- **最大响应时间** (Max Response Time)

#### 响应时间监控

```typescript
// 装饰器方式监控方法响应时间
function MonitorResponseTime(pluginId: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = process.hrtime.bigint();
      const startTimestamp = Date.now();
      
      try {
        const result = await method.apply(this, args);
        
        // 计算响应时间
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // 转换为毫秒
        
        // 记录响应时间
        monitor.recordResponseTime(pluginId, responseTime);
        
        // 记录详细信息
        console.log(`📊 ${propertyName} 响应时间: ${responseTime.toFixed(2)}ms`);
        
        return result;
      } catch (error) {
        // 记录错误和响应时间
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        
        monitor.recordResponseTime(pluginId, responseTime);
        monitor.recordError(pluginId, error);
        
        console.error(`❌ ${propertyName} 执行失败 (${responseTime.toFixed(2)}ms):`, error.message);
        throw error;
      }
    };
  };
}

// 使用示例
class MyPlugin {
  @MonitorResponseTime('my-plugin')
  async fetchUserData(userId: number) {
    // 模拟API调用
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  }
  
  @MonitorResponseTime('my-plugin')
  async processLargeDataset(data: any[]) {
    // 模拟数据处理
    return data.map(item => this.processItem(item));
  }
}
```

#### 响应时间分析

```typescript
class ResponseTimeAnalyzer {
  static analyzeResponseTimes(pluginId: string) {
    const metrics = monitor.getMetrics(pluginId);
    const responseTimes = metrics.responseTimeHistory || [];
    
    if (responseTimes.length === 0) {
      console.log('📊 暂无响应时间数据');
      return;
    }
    
    // 计算统计信息
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    const stats = {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      average: sum / count,
      median: sorted[Math.floor(count / 2)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
    
    console.log(`📊 插件 ${pluginId} 响应时间统计:`);
    console.log(`   请求总数: ${stats.count}`);
    console.log(`   平均响应时间: ${stats.average.toFixed(2)}ms`);
    console.log(`   中位数: ${stats.median.toFixed(2)}ms`);
    console.log(`   95%分位数: ${stats.p95.toFixed(2)}ms`);
    console.log(`   99%分位数: ${stats.p99.toFixed(2)}ms`);
    console.log(`   最小值: ${stats.min.toFixed(2)}ms`);
    console.log(`   最大值: ${stats.max.toFixed(2)}ms`);
    
    // 性能评估
    if (stats.average > 1000) {
      console.warn('⚠️  平均响应时间过长，建议优化');
    }
    
    if (stats.p95 > 2000) {
      console.warn('⚠️  95%分位数响应时间过长，存在性能瓶颈');
    }
    
    return stats;
  }
}
```

### 4. 错误率指标

#### 监控项目
- **总错误数** (Total Errors)
- **错误率** (Error Rate)
- **错误类型分布** (Error Type Distribution)
- **错误趋势** (Error Trend)

#### 错误监控实现

```typescript
class ErrorMonitor {
  private errorCategories = new Map<string, number>();
  
  recordError(pluginId: string, error: Error, context?: any) {
    // 记录到性能监控器
    monitor.recordError(pluginId, error);
    
    // 分类错误
    const errorType = this.categorizeError(error);
    this.errorCategories.set(errorType, (this.errorCategories.get(errorType) || 0) + 1);
    
    // 记录详细错误信息
    console.error(`❌ 插件 ${pluginId} 发生错误:`);
    console.error(`   类型: ${errorType}`);
    console.error(`   消息: ${error.message}`);
    console.error(`   堆栈: ${error.stack}`);
    
    if (context) {
      console.error(`   上下文:`, context);
    }
    
    // 检查错误率告警
    this.checkErrorRateAlert(pluginId);
  }
  
  private categorizeError(error: Error): string {
    if (error.name === 'TypeError') return 'TYPE_ERROR';
    if (error.name === 'ReferenceError') return 'REFERENCE_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    if (error.message.includes('permission')) return 'PERMISSION_ERROR';
    return 'UNKNOWN_ERROR';
  }
  
  private checkErrorRateAlert(pluginId: string) {
    const metrics = monitor.getMetrics(pluginId);
    
    if (metrics.errorRate > 0.05) { // 5%错误率
      console.warn(`⚠️  插件 ${pluginId} 错误率过高: ${(metrics.errorRate * 100).toFixed(2)}%`);
      
      // 生成错误报告
      this.generateErrorReport(pluginId);
    }
  }
  
  generateErrorReport(pluginId: string) {
    console.log(`📋 插件 ${pluginId} 错误报告:`);
    console.log('   错误类型分布:');
    
    for (const [type, count] of this.errorCategories.entries()) {
      console.log(`   - ${type}: ${count}次`);
    }
    
    const metrics = monitor.getMetrics(pluginId);
    console.log(`   总错误数: ${metrics.errorCount}`);
    console.log(`   错误率: ${(metrics.errorRate * 100).toFixed(2)}%`);
  }
}
```

## 资源监控

### 1. 内存池监控

```typescript
class MemoryPoolMonitor {
  static monitorMemoryPool() {
    const memoryPool = MemoryPoolManager.getInstance();
    
    setInterval(() => {
      const stats = memoryPool.getStats();
      
      console.log('🧠 内存池状态:');
      console.log(`   总容量: ${(stats.total / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   已使用: ${(stats.used / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   使用率: ${(stats.used / stats.total * 100).toFixed(2)}%`);
      console.log(`   碎片率: ${(stats.fragmentation * 100).toFixed(2)}%`);
      console.log(`   分配次数: ${stats.allocations}`);
      console.log(`   释放次数: ${stats.deallocations}`);
      
      // 告警检查
      if (stats.used / stats.total > 0.9) {
        console.warn('⚠️  内存池使用率过高，建议清理或扩容');
      }
      
      if (stats.fragmentation > 0.3) {
        console.warn('⚠️  内存碎片率过高，建议进行碎片整理');
        memoryPool.defragment();
      }
    }, 10000); // 每10秒检查一次
  }
}
```

### 2. 连接池监控

```typescript
class ConnectionPoolMonitor {
  static monitorConnectionPool() {
    const connectionPool = ConnectionPoolManager.getInstance();
    
    setInterval(() => {
      const stats = connectionPool.getStats();
      
      console.log('🔗 连接池状态:');
      console.log(`   总连接数: ${stats.totalConnections}`);
      console.log(`   活跃连接: ${stats.activeConnections}`);
      console.log(`   空闲连接: ${stats.idleConnections}`);
      console.log(`   使用率: ${(stats.activeConnections / stats.totalConnections * 100).toFixed(2)}%`);
      
      // 按类型统计
      console.log('   连接类型分布:');
      for (const [type, count] of Object.entries(stats.connectionsByType)) {
        console.log(`   - ${type}: ${count}个`);
      }
      
      // 告警检查
      if (stats.activeConnections / stats.totalConnections > 0.8) {
        console.warn('⚠️  连接池使用率过高，建议增加连接数或优化连接复用');
      }
      
      // 健康检查
      connectionPool.healthCheck().then(unhealthyCount => {
        if (unhealthyCount > 0) {
          console.warn(`⚠️  发现 ${unhealthyCount} 个不健康连接，已自动清理`);
        }
      });
    }, 15000); // 每15秒检查一次
  }
}
```

### 3. 缓存监控

```typescript
class CacheMonitor {
  static monitorCache() {
    const cacheManager = PluginCacheManager.getInstance();
    
    setInterval(() => {
      const stats = cacheManager.getStats();
      
      console.log('💾 缓存状态:');
      console.log(`   缓存项数: ${stats.totalItems}`);
      console.log(`   缓存大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   命中次数: ${stats.hits}`);
      console.log(`   未命中次数: ${stats.misses}`);
      
      if (stats.hits + stats.misses > 0) {
        const hitRate = stats.hits / (stats.hits + stats.misses);
        console.log(`   命中率: ${(hitRate * 100).toFixed(2)}%`);
        
        // 告警检查
        if (hitRate < 0.7) {
          console.warn('⚠️  缓存命中率较低，建议优化缓存策略');
        }
      }
      
      console.log(`   驱逐次数: ${stats.evictions}`);
      console.log(`   过期次数: ${stats.expirations}`);
      
      // 内存使用告警
      if (stats.totalSize > 100 * 1024 * 1024) { // 100MB
        console.warn('⚠️  缓存占用内存过多，建议清理或调整缓存策略');
      }
    }, 20000); // 每20秒检查一次
  }
}
```

## 性能诊断工具

### 1. 综合性能诊断

```typescript
class PerformanceDiagnostics {
  static async runFullDiagnosis(pluginId?: string) {
    console.log('🔍 开始性能诊断...\n');
    
    if (pluginId) {
      await this.diagnosePlugin(pluginId);
    } else {
      await this.diagnoseAllPlugins();
    }
    
    await this.diagnoseSystemResources();
    await this.generateRecommendations();
    
    console.log('\n✅ 性能诊断完成');
  }
  
  private static async diagnosePlugin(pluginId: string) {
    console.log(`📊 诊断插件: ${pluginId}`);
    
    const metrics = monitor.getMetrics(pluginId);
    const issues = [];
    
    // 内存诊断
    if (metrics.currentMemoryUsage > 100 * 1024 * 1024) {
      issues.push({
        type: 'memory',
        severity: 'high',
        message: `内存使用过高: ${(metrics.currentMemoryUsage / 1024 / 1024).toFixed(2)} MB`
      });
    }
    
    // CPU诊断
    if (metrics.averageCpuUsage > 80) {
      issues.push({
        type: 'cpu',
        severity: 'high',
        message: `CPU使用率过高: ${metrics.averageCpuUsage.toFixed(2)}%`
      });
    }
    
    // 响应时间诊断
    if (metrics.averageResponseTime > 1000) {
      issues.push({
        type: 'response_time',
        severity: 'medium',
        message: `响应时间过长: ${metrics.averageResponseTime.toFixed(2)}ms`
      });
    }
    
    // 错误率诊断
    if (metrics.errorRate > 0.05) {
      issues.push({
        type: 'error_rate',
        severity: 'high',
        message: `错误率过高: ${(metrics.errorRate * 100).toFixed(2)}%`
      });
    }
    
    // 输出诊断结果
    if (issues.length === 0) {
      console.log('   ✅ 性能正常');
    } else {
      console.log('   ⚠️  发现性能问题:');
      issues.forEach(issue => {
        const icon = issue.severity === 'high' ? '🔴' : '🟡';
        console.log(`   ${icon} ${issue.message}`);
      });
    }
    
    return issues;
  }
  
  private static async diagnoseAllPlugins() {
    const reports = monitor.generateReport();
    
    console.log(`📊 诊断所有插件 (共${reports.length}个):`);
    
    for (const report of reports) {
      const issues = await this.diagnosePlugin(report.pluginId);
      
      if (issues.length > 0) {
        console.log(`   插件 ${report.pluginId}: ${issues.length}个问题`);
      }
    }
  }
  
  private static async diagnoseSystemResources() {
    console.log('\n🖥️  系统资源诊断:');
    
    // 内存池诊断
    const memoryPool = MemoryPoolManager.getInstance();
    const memoryStats = memoryPool.getStats();
    
    console.log('   内存池:');
    console.log(`   - 使用率: ${(memoryStats.used / memoryStats.total * 100).toFixed(2)}%`);
    console.log(`   - 碎片率: ${(memoryStats.fragmentation * 100).toFixed(2)}%`);
    
    if (memoryStats.fragmentation > 0.3) {
      console.log('   ⚠️  内存碎片率过高');
    }
    
    // 连接池诊断
    const connectionPool = ConnectionPoolManager.getInstance();
    const connectionStats = connectionPool.getStats();
    
    console.log('   连接池:');
    console.log(`   - 使用率: ${(connectionStats.activeConnections / connectionStats.totalConnections * 100).toFixed(2)}%`);
    console.log(`   - 活跃连接: ${connectionStats.activeConnections}`);
    
    if (connectionStats.activeConnections / connectionStats.totalConnections > 0.8) {
      console.log('   ⚠️  连接池使用率过高');
    }
    
    // 缓存诊断
    const cacheManager = PluginCacheManager.getInstance();
    const cacheStats = cacheManager.getStats();
    
    console.log('   缓存:');
    if (cacheStats.hits + cacheStats.misses > 0) {
      const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
      console.log(`   - 命中率: ${(hitRate * 100).toFixed(2)}%`);
      
      if (hitRate < 0.7) {
        console.log('   ⚠️  缓存命中率较低');
      }
    }
    
    console.log(`   - 缓存大小: ${(cacheStats.totalSize / 1024 / 1024).toFixed(2)} MB`);
  }
  
  private static async generateRecommendations() {
    console.log('\n💡 优化建议:');
    
    const recommendations = [
      '定期监控插件性能指标',
      '合理设置缓存TTL和大小限制',
      '及时释放不再使用的资源',
      '使用连接池复用网络连接',
      '避免在主线程执行CPU密集型操作',
      '实施内存泄漏检测和预防',
      '设置合理的性能告警阈值'
    ];
    
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
}
```

### 2. 性能基准测试

```typescript
class PerformanceBenchmark {
  static async runBenchmarks() {
    console.log('🏃‍♂️ 开始性能基准测试...\n');
    
    await this.benchmarkMemoryAllocation();
    await this.benchmarkConnectionAcquisition();
    await this.benchmarkCacheOperations();
    await this.benchmarkPluginLoading();
    
    console.log('\n✅ 性能基准测试完成');
  }
  
  private static async benchmarkMemoryAllocation() {
    console.log('📊 内存分配基准测试:');
    
    const memoryPool = MemoryPoolManager.getInstance();
    const iterations = 10000;
    
    // 小块内存分配测试
    const startTime = process.hrtime.bigint();
    const allocations = [];
    
    for (let i = 0; i < iterations; i++) {
      const allocation = await memoryPool.allocate(1024); // 1KB
      allocations.push(allocation);
    }
    
    const allocTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    // 内存释放测试
    const freeStartTime = process.hrtime.bigint();
    
    for (const allocation of allocations) {
      memoryPool.free(allocation);
    }
    
    const freeTime = Number(process.hrtime.bigint() - freeStartTime) / 1000000;
    
    console.log(`   ${iterations}次1KB分配: ${allocTime.toFixed(2)}ms (${(allocTime / iterations).toFixed(4)}ms/次)`);
    console.log(`   ${iterations}次释放: ${freeTime.toFixed(2)}ms (${(freeTime / iterations).toFixed(4)}ms/次)`);
  }
  
  private static async benchmarkConnectionAcquisition() {
    console.log('📊 连接获取基准测试:');
    
    const connectionPool = ConnectionPoolManager.getInstance();
    const iterations = 1000;
    
    const startTime = process.hrtime.bigint();
    const connections = [];
    
    for (let i = 0; i < iterations; i++) {
      const conn = await connectionPool.acquire('http', {
        url: `http://test${i % 10}.com`
      });
      connections.push(conn);
    }
    
    const acquireTime = Number(process.hrtime.bigint() - startTime) / 1000000;
    
    // 释放连接
    const releaseStartTime = process.hrtime.bigint();
    
    for (const conn of connections) {
      connectionPool.release(conn.id);
    }
    
    const releaseTime = Number(process.hrtime.bigint() - releaseStartTime) / 1000000;
    
    console.log(`   ${iterations}次连接获取: ${acquireTime.toFixed(2)}ms (${(acquireTime / iterations).toFixed(4)}ms/次)`);
    console.log(`   ${iterations}次连接释放: ${releaseTime.toFixed(2)}ms (${(releaseTime / iterations).toFixed(4)}ms/次)`);
  }
  
  private static async benchmarkCacheOperations() {
    console.log('📊 缓存操作基准测试:');
    
    const cacheManager = PluginCacheManager.getInstance();
    const iterations = 10000;
    
    // 缓存设置测试
    const setStartTime = process.hrtime.bigint();
    
    for (let i = 0; i < iterations; i++) {
      cacheManager.set(`benchmark-key-${i}`, {
        data: `value-${i}`,
        timestamp: Date.now()
      });
    }
    
    const setTime = Number(process.hrtime.bigint() - setStartTime) / 1000000;
    
    // 缓存获取测试
    const getStartTime = process.hrtime.bigint();
    
    for (let i = 0; i < iterations; i++) {
      cacheManager.get(`benchmark-key-${i}`);
    }
    
    const getTime = Number(process.hrtime.bigint() - getStartTime) / 1000000;
    
    console.log(`   ${iterations}次缓存设置: ${setTime.toFixed(2)}ms (${(setTime / iterations).toFixed(4)}ms/次)`);
    console.log(`   ${iterations}次缓存获取: ${getTime.toFixed(2)}ms (${(getTime / iterations).toFixed(4)}ms/次)`);
  }
  
  private static async benchmarkPluginLoading() {
    console.log('📊 插件加载基准测试:');
    
    const lazyLoader = PluginLazyLoader.getInstance();
    const pluginCount = 100;
    
    // 注册插件
    const registerStartTime = process.hrtime.bigint();
    
    for (let i = 0; i < pluginCount; i++) {
      lazyLoader.registerPlugin(`benchmark-plugin-${i}`, {
        priority: 'normal',
        loader: async (pluginId) => {
          // 模拟插件加载
          await new Promise(resolve => setTimeout(resolve, 1));
          return { id: pluginId, loaded: true };
        }
      });
    }
    
    const registerTime = Number(process.hrtime.bigint() - registerStartTime) / 1000000;
    
    // 加载插件
    const loadStartTime = process.hrtime.bigint();
    
    const loadPromises = [];
    for (let i = 0; i < pluginCount; i++) {
      loadPromises.push(lazyLoader.loadPlugin(`benchmark-plugin-${i}`));
    }
    
    await Promise.all(loadPromises);
    
    const loadTime = Number(process.hrtime.bigint() - loadStartTime) / 1000000;
    
    console.log(`   ${pluginCount}个插件注册: ${registerTime.toFixed(2)}ms (${(registerTime / pluginCount).toFixed(4)}ms/个)`);
    console.log(`   ${pluginCount}个插件加载: ${loadTime.toFixed(2)}ms (${(loadTime / pluginCount).toFixed(4)}ms/个)`);
  }
}
```

## 实时监控仪表板

### 1. 控制台仪表板

```typescript
class PerformanceDashboard {
  private updateInterval: NodeJS.Timeout | null = null;
  
  start() {
    console.clear();
    console.log('🚀 AcFun Live Toolbox MKII 性能监控仪表板');
    console.log('=' .repeat(60));
    
    this.updateInterval = setInterval(() => {
      this.updateDashboard();
    }, 2000);
  }
  
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  private updateDashboard() {
    // 清屏并重新绘制
    console.clear();
    console.log('🚀 AcFun Live Toolbox MKII 性能监控仪表板');
    console.log('=' .repeat(60));
    console.log(`更新时间: ${new Date().toLocaleTimeString()}\n`);
    
    this.displaySystemOverview();
    this.displayPluginMetrics();
    this.displayResourceUsage();
    this.displayAlerts();
  }
  
  private displaySystemOverview() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    console.log('📊 系统概览:');
    console.log(`   Node.js 内存: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   RSS 内存: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   外部内存: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   运行时间: ${Math.floor(process.uptime() / 60)}分${Math.floor(process.uptime() % 60)}秒\n`);
  }
  
  private displayPluginMetrics() {
    const reports = monitor.generateReport();
    
    console.log('🔌 插件性能 (前5个):');
    
    if (reports.length === 0) {
      console.log('   暂无插件监控数据\n');
      return;
    }
    
    // 按内存使用排序
    const sortedReports = reports
      .sort((a, b) => b.summary.currentMemoryUsage - a.summary.currentMemoryUsage)
      .slice(0, 5);
    
    for (const report of sortedReports) {
      const memory = (report.summary.currentMemoryUsage / 1024 / 1024).toFixed(2);
      const cpu = report.summary.averageCpuUsage.toFixed(1);
      const responseTime = report.summary.averageResponseTime.toFixed(2);
      const errorRate = (report.summary.errorRate * 100).toFixed(2);
      
      console.log(`   ${report.pluginId}:`);
      console.log(`     内存: ${memory}MB | CPU: ${cpu}% | 响应: ${responseTime}ms | 错误: ${errorRate}%`);
    }
    console.log();
  }
  
  private displayResourceUsage() {
    console.log('💾 资源使用:');
    
    // 内存池状态
    const memoryPool = MemoryPoolManager.getInstance();
    const memoryStats = memoryPool.getStats();
    const memoryUsagePercent = (memoryStats.used / memoryStats.total * 100).toFixed(1);
    
    console.log(`   内存池: ${memoryUsagePercent}% (${(memoryStats.used / 1024 / 1024).toFixed(2)}MB / ${(memoryStats.total / 1024 / 1024).toFixed(2)}MB)`);
    
    // 连接池状态
    const connectionPool = ConnectionPoolManager.getInstance();
    const connectionStats = connectionPool.getStats();
    const connectionUsagePercent = (connectionStats.activeConnections / connectionStats.totalConnections * 100).toFixed(1);
    
    console.log(`   连接池: ${connectionUsagePercent}% (${connectionStats.activeConnections} / ${connectionStats.totalConnections})`);
    
    // 缓存状态
    const cacheManager = PluginCacheManager.getInstance();
    const cacheStats = cacheManager.getStats();
    const hitRate = cacheStats.hits + cacheStats.misses > 0 
      ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(1)
      : '0.0';
    
    console.log(`   缓存: ${hitRate}% 命中率 (${cacheStats.totalItems}项, ${(cacheStats.totalSize / 1024 / 1024).toFixed(2)}MB)`);
    console.log();
  }
  
  private displayAlerts() {
    const alerts = this.checkAlerts();
    
    if (alerts.length === 0) {
      console.log('✅ 无告警');
      return;
    }
    
    console.log('⚠️  告警信息:');
    alerts.forEach(alert => {
      const icon = alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟡' : '🟢';
      console.log(`   ${icon} ${alert.message}`);
    });
  }
  
  private checkAlerts(): Array<{severity: string, message: string}> {
    const alerts = [];
    
    // 检查系统内存
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      alerts.push({
        severity: 'high',
        message: `系统内存使用过高: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
      });
    }
    
    // 检查内存池
    const memoryPool = MemoryPoolManager.getInstance();
    const memoryStats = memoryPool.getStats();
    if (memoryStats.used / memoryStats.total > 0.9) {
      alerts.push({
        severity: 'medium',
        message: `内存池使用率过高: ${(memoryStats.used / memoryStats.total * 100).toFixed(1)}%`
      });
    }
    
    // 检查连接池
    const connectionPool = ConnectionPoolManager.getInstance();
    const connectionStats = connectionPool.getStats();
    if (connectionStats.activeConnections / connectionStats.totalConnections > 0.8) {
      alerts.push({
        severity: 'medium',
        message: `连接池使用率过高: ${(connectionStats.activeConnections / connectionStats.totalConnections * 100).toFixed(1)}%`
      });
    }
    
    // 检查插件错误率
    const reports = monitor.generateReport();
    for (const report of reports) {
      if (report.summary.errorRate > 0.05) {
        alerts.push({
          severity: 'high',
          message: `插件 ${report.pluginId} 错误率过高: ${(report.summary.errorRate * 100).toFixed(2)}%`
        });
      }
    }
    
    return alerts;
  }
}
```

### 2. 启动监控

```typescript
// 在主程序中启动性能监控
class PerformanceMonitoringService {
  private dashboard: PerformanceDashboard;
  private monitors: Array<{ stop: () => void }> = [];
  
  async start() {
    console.log('🚀 启动性能监控服务...');
    
    // 启动各种监控器
    MemoryPoolMonitor.monitorMemoryPool();
    ConnectionPoolMonitor.monitorConnectionPool();
    CacheMonitor.monitorCache();
    
    // 启动仪表板
    this.dashboard = new PerformanceDashboard();
    this.dashboard.start();
    
    // 定期运行诊断
    const diagnosticsInterval = setInterval(() => {
      PerformanceDiagnostics.runFullDiagnosis();
    }, 300000); // 每5分钟
    
    this.monitors.push({
      stop: () => clearInterval(diagnosticsInterval)
    });
    
    // 定期运行基准测试
    const benchmarkInterval = setInterval(() => {
      PerformanceBenchmark.runBenchmarks();
    }, 3600000); // 每小时
    
    this.monitors.push({
      stop: () => clearInterval(benchmarkInterval)
    });
    
    console.log('✅ 性能监控服务已启动');
  }
  
  stop() {
    console.log('🛑 停止性能监控服务...');
    
    // 停止仪表板
    if (this.dashboard) {
      this.dashboard.stop();
    }
    
    // 停止所有监控器
    this.monitors.forEach(monitor => monitor.stop());
    this.monitors = [];
    
    console.log('✅ 性能监控服务已停止');
  }
}

// 使用示例
const monitoringService = new PerformanceMonitoringService();

// 启动监控
await monitoringService.start();

// 在程序退出时停止监控
process.on('SIGINT', () => {
  monitoringService.stop();
  process.exit(0);
});
```

## 性能优化建议

### 1. 内存优化
- 使用内存池减少频繁分配
- 及时释放不再使用的资源
- 避免内存泄漏和循环引用
- 定期进行内存碎片整理

### 2. CPU优化
- 避免在主线程执行CPU密集型操作
- 使用Worker线程处理计算任务
- 合理使用异步操作
- 优化算法复杂度

### 3. 网络优化
- 使用连接池复用连接
- 实施请求缓存策略
- 设置合理的超时时间
- 处理网络错误和重试

### 4. 缓存优化
- 根据数据特性设置TTL
- 使用LRU策略管理缓存
- 实施缓存预热
- 监控缓存命中率

### 5. 监控优化
- 设置合理的监控频率
- 实施分级告警机制
- 定期生成性能报告
- 建立性能基准线

通过本指南，开发者可以全面了解和掌握 AcFun Live Toolbox MKII 的性能监控和调试技术，有效提升插件的运行效率和稳定性。