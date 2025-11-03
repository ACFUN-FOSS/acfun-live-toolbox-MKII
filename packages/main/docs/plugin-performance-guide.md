# 插件性能优化开发指南

## 概述

本指南介绍了如何在 AcFun Live Toolbox MKII 中开发高性能插件，以及如何利用内置的性能优化组件来提升插件的运行效率。

## 性能优化组件

### 1. 内存池管理器 (MemoryPoolManager)

内存池管理器提供了高效的内存分配和回收机制，减少了频繁的内存分配开销。

#### 基本用法

```typescript
import { MemoryPoolManager } from '../plugins/MemoryPoolManager';

// 获取全局内存池实例
const memoryPool = MemoryPoolManager.getInstance();

// 分配内存
const allocation = await memoryPool.allocate(1024); // 分配1KB内存
console.log('分配的内存ID:', allocation.id);
console.log('内存大小:', allocation.size);

// 使用内存
// ... 在这里使用分配的内存

// 释放内存
memoryPool.free(allocation);
```

#### 最佳实践

1. **合理选择内存块大小**：
   - 小于1KB的数据：使用1KB块
   - 1KB-4KB的数据：使用4KB块
   - 4KB-16KB的数据：使用16KB块
   - 16KB-64KB的数据：使用64KB块
   - 大于64KB的数据：考虑分块处理

2. **及时释放内存**：
   ```typescript
   try {
     const allocation = await memoryPool.allocate(size);
     // 使用内存
     return result;
   } finally {
     // 确保内存被释放
     if (allocation) {
       memoryPool.free(allocation);
     }
   }
   ```

3. **监控内存使用**：
   ```typescript
   const stats = memoryPool.getStats();
   console.log('内存使用率:', (stats.used / stats.total * 100).toFixed(2) + '%');
   console.log('碎片率:', (stats.fragmentation * 100).toFixed(2) + '%');
   
   // 当碎片率过高时进行整理
   if (stats.fragmentation > 0.3) {
     await memoryPool.defragment();
   }
   ```

### 2. 连接池管理器 (ConnectionPoolManager)

连接池管理器提供了高效的网络连接复用机制，减少连接建立和销毁的开销。

#### 基本用法

```typescript
import { ConnectionPoolManager } from '../plugins/ConnectionPoolManager';

// 获取全局连接池实例
const connectionPool = ConnectionPoolManager.getInstance();

// 获取HTTP连接
const httpConn = await connectionPool.acquire('http', {
  url: 'https://api.example.com',
  timeout: 5000
});

try {
  // 使用连接进行HTTP请求
  const response = await fetch(httpConn.url, {
    method: 'GET',
    headers: { 'User-Agent': 'ACLiveFrame' }
  });
  
  const data = await response.json();
  return data;
} finally {
  // 释放连接回池中
  connectionPool.release(httpConn.id);
}
```

#### 支持的连接类型

1. **HTTP连接**：
   ```typescript
   const conn = await connectionPool.acquire('http', {
     url: 'https://api.acfun.cn',
     timeout: 10000,
     headers: { 'Authorization': 'Bearer token' }
   });
   ```

2. **WebSocket连接**：
   ```typescript
   const conn = await connectionPool.acquire('websocket', {
     url: 'wss://live.acfun.cn/websocket',
     protocols: ['acfun-live'],
     timeout: 15000
   });
   ```

3. **IPC连接**：
   ```typescript
   const conn = await connectionPool.acquire('ipc', {
     path: '\\\\.\\pipe\\acfun-live',
     timeout: 5000
   });
   ```

#### 最佳实践

1. **连接复用**：
   ```typescript
   // 对于相同的URL，连接会被自动复用
   const conn1 = await connectionPool.acquire('http', { url: 'https://api.acfun.cn' });
   connectionPool.release(conn1.id);
   
   const conn2 = await connectionPool.acquire('http', { url: 'https://api.acfun.cn' });
   // conn2 可能复用了 conn1 的底层连接
   ```

2. **健康检查**：
   ```typescript
   // 启用自动健康检查
   const stats = connectionPool.getStats();
   console.log('活跃连接数:', stats.activeConnections);
   console.log('总连接数:', stats.totalConnections);
   
   // 手动健康检查
   await connectionPool.healthCheck();
   ```

3. **错误处理**：
   ```typescript
   try {
     const conn = await connectionPool.acquire('http', config);
     // 使用连接
   } catch (error) {
     if (error.code === 'CONNECTION_TIMEOUT') {
       // 处理连接超时
     } else if (error.code === 'MAX_CONNECTIONS_REACHED') {
       // 处理连接池满的情况
     }
   }
   ```

### 3. 缓存管理器 (PluginCacheManager)

缓存管理器提供了高效的数据缓存机制，支持TTL、LRU驱逐和插件隔离。

#### 基本用法

```typescript
import { PluginCacheManager } from '../plugins/PluginCacheManager';

// 获取全局缓存管理器实例
const cacheManager = PluginCacheManager.getInstance();

// 设置缓存
cacheManager.set('user:123', {
  id: 123,
  name: 'AcFun用户',
  avatar: 'https://cdn.acfun.cn/avatar/123.jpg'
}, 300000); // 5分钟TTL

// 获取缓存
const user = cacheManager.get('user:123');
if (user) {
  console.log('缓存命中:', user.name);
} else {
  console.log('缓存未命中');
}

// 插件专用缓存
const pluginId = 'my-plugin';
cacheManager.setPluginCache(pluginId, 'config', {
  apiKey: 'xxx',
  endpoint: 'https://api.example.com'
});

const config = cacheManager.getPluginCache(pluginId, 'config');
```

#### 缓存策略

1. **TTL缓存**：
   ```typescript
   // 短期缓存（1分钟）
   cacheManager.set('temp:data', data, 60000);
   
   // 中期缓存（1小时）
   cacheManager.set('api:response', response, 3600000);
   
   // 长期缓存（1天）
   cacheManager.set('static:config', config, 86400000);
   ```

2. **LRU缓存**：
   ```typescript
   // 当缓存满时，最近最少使用的项目会被自动驱逐
   const stats = cacheManager.getStats();
   console.log('缓存命中率:', (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) + '%');
   ```

3. **插件隔离**：
   ```typescript
   // 每个插件的缓存是隔离的
   cacheManager.setPluginCache('plugin-a', 'key', 'value-a');
   cacheManager.setPluginCache('plugin-b', 'key', 'value-b');
   
   // 清理特定插件的缓存
   cacheManager.clearPluginCache('plugin-a');
   ```

#### 最佳实践

1. **合理设置TTL**：
   ```typescript
   // 根据数据的更新频率设置TTL
   cacheManager.set('live:room:123', roomInfo, 30000); // 直播间信息30秒
   cacheManager.set('user:profile:456', userProfile, 600000); // 用户资料10分钟
   cacheManager.set('static:emoji', emojiList, 3600000); // 表情列表1小时
   ```

2. **缓存预热**：
   ```typescript
   // 在插件启动时预加载常用数据
   async function preloadCache() {
     const commonData = await fetchCommonData();
     cacheManager.set('common:data', commonData, 3600000);
   }
   ```

3. **缓存更新策略**：
   ```typescript
   // 写入时更新缓存
   async function updateUser(userId: number, data: any) {
     const result = await api.updateUser(userId, data);
     cacheManager.set(`user:${userId}`, result, 600000);
     return result;
   }
   
   // 删除时清理缓存
   async function deleteUser(userId: number) {
     await api.deleteUser(userId);
     cacheManager.delete(`user:${userId}`);
   }
   ```

### 4. 性能监控器 (PluginPerformanceMonitor)

性能监控器提供了实时的性能指标收集和分析功能。

#### 基本用法

```typescript
import { PluginPerformanceMonitor } from '../plugins/PluginPerformanceMonitor';

// 获取全局性能监控器实例
const monitor = PluginPerformanceMonitor.getInstance();

// 开始监控插件
const pluginId = 'my-plugin';
monitor.startMonitoring(pluginId);

// 记录性能指标
monitor.recordMemoryUsage(pluginId, process.memoryUsage().heapUsed);
monitor.recordCpuUsage(pluginId, process.cpuUsage().user);

// 记录响应时间
const startTime = Date.now();
await performOperation();
const responseTime = Date.now() - startTime;
monitor.recordResponseTime(pluginId, responseTime);

// 记录错误
try {
  await riskyOperation();
} catch (error) {
  monitor.recordError(pluginId, error);
  throw error;
}

// 获取性能指标
const metrics = monitor.getMetrics(pluginId);
console.log('平均响应时间:', metrics.averageResponseTime);
console.log('错误率:', metrics.errorRate);
```

#### 性能指标

1. **内存使用**：
   ```typescript
   // 定期记录内存使用
   setInterval(() => {
     const memUsage = process.memoryUsage();
     monitor.recordMemoryUsage(pluginId, memUsage.heapUsed);
   }, 5000);
   ```

2. **CPU使用**：
   ```typescript
   // 记录CPU使用率
   const cpuUsage = process.cpuUsage();
   monitor.recordCpuUsage(pluginId, cpuUsage.user + cpuUsage.system);
   ```

3. **响应时间**：
   ```typescript
   // 装饰器方式记录响应时间
   function measureTime(target: any, propertyName: string, descriptor: PropertyDescriptor) {
     const method = descriptor.value;
     descriptor.value = async function(...args: any[]) {
       const start = Date.now();
       try {
         const result = await method.apply(this, args);
         monitor.recordResponseTime(pluginId, Date.now() - start);
         return result;
       } catch (error) {
         monitor.recordError(pluginId, error);
         throw error;
       }
     };
   }
   ```

#### 性能报告

```typescript
// 生成性能报告
const reports = monitor.generateReport();
for (const report of reports) {
  console.log(`插件 ${report.pluginId} 性能报告:`);
  console.log('- 平均内存使用:', report.summary.averageMemoryUsage);
  console.log('- 平均CPU使用:', report.summary.averageCpuUsage);
  console.log('- 平均响应时间:', report.summary.averageResponseTime);
  console.log('- 错误率:', report.summary.errorRate);
  
  if (report.recommendations.length > 0) {
    console.log('优化建议:');
    report.recommendations.forEach(rec => console.log(`- ${rec}`));
  }
}
```

### 5. 懒加载器 (PluginLazyLoader)

懒加载器提供了按需加载插件的机制，减少启动时间和内存占用。

#### 基本用法

```typescript
import { PluginLazyLoader } from '../plugins/PluginLazyLoader';

// 获取全局懒加载器实例
const lazyLoader = PluginLazyLoader.getInstance();

// 注册插件
lazyLoader.registerPlugin('my-plugin', {
  priority: 'normal',
  dependencies: ['base-plugin'],
  loader: async (pluginId) => {
    // 动态导入插件
    const plugin = await import(`./plugins/${pluginId}`);
    return plugin.default;
  }
});

// 加载插件
const result = await lazyLoader.loadPlugin('my-plugin');
if (result.success) {
  console.log('插件加载成功:', result.plugin);
} else {
  console.error('插件加载失败:', result.error);
}
```

#### 优先级和依赖

1. **优先级设置**：
   ```typescript
   // 高优先级插件会优先加载
   lazyLoader.registerPlugin('critical-plugin', {
     priority: 'high',
     loader: async () => await import('./critical-plugin')
   });
   
   // 低优先级插件会延迟加载
   lazyLoader.registerPlugin('optional-plugin', {
     priority: 'low',
     loader: async () => await import('./optional-plugin')
   });
   ```

2. **依赖管理**：
   ```typescript
   // 插件依赖会自动解析和加载
   lazyLoader.registerPlugin('ui-plugin', {
     priority: 'normal',
     dependencies: ['theme-plugin', 'i18n-plugin'],
     loader: async () => await import('./ui-plugin')
   });
   ```

#### 预加载策略

```typescript
// 条件预加载
lazyLoader.preloadPlugins(['frequently-used-plugin'], {
  condition: () => {
    // 只在特定条件下预加载
    return getCurrentUser().isPremium;
  }
});

// 内存压力下暂停懒加载
const memoryUsage = process.memoryUsage().heapUsed;
if (memoryUsage > 100 * 1024 * 1024) { // 100MB
  lazyLoader.suspendLazyLoading();
}
```

## 插件开发最佳实践

### 1. 插件生命周期优化

```typescript
export default class MyPlugin {
  private memoryPool: MemoryPoolManager;
  private connectionPool: ConnectionPoolManager;
  private cacheManager: PluginCacheManager;
  private monitor: PluginPerformanceMonitor;
  
  async onEnable() {
    // 获取性能优化组件实例
    this.memoryPool = MemoryPoolManager.getInstance();
    this.connectionPool = ConnectionPoolManager.getInstance();
    this.cacheManager = PluginCacheManager.getInstance();
    this.monitor = PluginPerformanceMonitor.getInstance();
    
    // 开始性能监控
    this.monitor.startMonitoring(this.id);
    
    // 预加载缓存
    await this.preloadCache();
  }
  
  async onDisable() {
    // 停止性能监控
    this.monitor.stopMonitoring(this.id);
    
    // 清理插件缓存
    this.cacheManager.clearPluginCache(this.id);
    
    // 释放连接
    // 连接池会自动处理
  }
  
  private async preloadCache() {
    // 预加载常用数据
    const config = await this.loadConfig();
    this.cacheManager.setPluginCache(this.id, 'config', config, 3600000);
  }
}
```

### 2. 异步操作优化

```typescript
class OptimizedPlugin {
  async processLargeDataset(data: any[]) {
    const batchSize = 100;
    const results = [];
    
    // 分批处理大数据集
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // 并行处理批次
      const batchResults = await Promise.all(
        batch.map(item => this.processItem(item))
      );
      
      results.push(...batchResults);
      
      // 让出控制权，避免阻塞事件循环
      await new Promise(resolve => setImmediate(resolve));
    }
    
    return results;
  }
  
  private async processItem(item: any) {
    // 使用内存池分配临时内存
    const allocation = await this.memoryPool.allocate(item.size);
    
    try {
      // 处理项目
      const result = await this.doProcessing(item, allocation);
      
      // 缓存结果
      this.cacheManager.setPluginCache(
        this.id, 
        `result:${item.id}`, 
        result, 
        300000
      );
      
      return result;
    } finally {
      // 确保释放内存
      this.memoryPool.free(allocation);
    }
  }
}
```

### 3. 网络请求优化

```typescript
class NetworkOptimizedPlugin {
  async fetchUserData(userId: number) {
    const cacheKey = `user:${userId}`;
    
    // 先检查缓存
    let userData = this.cacheManager.getPluginCache(this.id, cacheKey);
    if (userData) {
      return userData;
    }
    
    // 获取连接
    const conn = await this.connectionPool.acquire('http', {
      url: 'https://api.acfun.cn',
      timeout: 10000
    });
    
    try {
      // 记录请求开始时间
      const startTime = Date.now();
      
      // 发起请求
      const response = await fetch(`${conn.url}/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${this.getToken()}` }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      userData = await response.json();
      
      // 记录响应时间
      this.monitor.recordResponseTime(this.id, Date.now() - startTime);
      
      // 缓存结果
      this.cacheManager.setPluginCache(this.id, cacheKey, userData, 600000);
      
      return userData;
    } catch (error) {
      // 记录错误
      this.monitor.recordError(this.id, error);
      throw error;
    } finally {
      // 释放连接
      this.connectionPool.release(conn.id);
    }
  }
}
```

### 4. 内存管理优化

```typescript
class MemoryOptimizedPlugin {
  private dataBuffer: Map<string, any> = new Map();
  
  async processLargeFile(filePath: string) {
    // 检查内存使用情况
    const memUsage = process.memoryUsage().heapUsed;
    this.monitor.recordMemoryUsage(this.id, memUsage);
    
    if (memUsage > 200 * 1024 * 1024) { // 200MB
      // 内存使用过高，清理缓存
      await this.cleanupMemory();
    }
    
    // 分配处理缓冲区
    const bufferSize = 64 * 1024; // 64KB
    const allocation = await this.memoryPool.allocate(bufferSize);
    
    try {
      // 流式处理文件
      const stream = fs.createReadStream(filePath, { 
        highWaterMark: bufferSize 
      });
      
      const results = [];
      for await (const chunk of stream) {
        const processed = await this.processChunk(chunk, allocation);
        results.push(processed);
        
        // 定期检查内存使用
        if (results.length % 100 === 0) {
          const currentMem = process.memoryUsage().heapUsed;
          this.monitor.recordMemoryUsage(this.id, currentMem);
        }
      }
      
      return results;
    } finally {
      // 释放缓冲区
      this.memoryPool.free(allocation);
    }
  }
  
  private async cleanupMemory() {
    // 清理内部缓存
    this.dataBuffer.clear();
    
    // 清理插件缓存中的临时数据
    const tempKeys = ['temp:', 'cache:', 'buffer:'];
    for (const prefix of tempKeys) {
      // 这里需要实现按前缀删除的功能
      // this.cacheManager.deleteByPrefix(this.id, prefix);
    }
    
    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }
  }
}
```

## 性能监控和调试

### 1. 性能指标监控

```typescript
// 在插件中添加性能监控
class MonitoredPlugin {
  private performanceTimer: NodeJS.Timeout;
  
  async onEnable() {
    // 开始监控
    this.monitor.startMonitoring(this.id);
    
    // 定期收集性能指标
    this.performanceTimer = setInterval(() => {
      this.collectMetrics();
    }, 5000);
  }
  
  async onDisable() {
    // 停止定期监控
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
    }
    
    // 生成最终报告
    const report = this.monitor.generateReport([this.id]);
    console.log('插件性能报告:', report);
    
    this.monitor.stopMonitoring(this.id);
  }
  
  private collectMetrics() {
    // 内存使用
    const memUsage = process.memoryUsage();
    this.monitor.recordMemoryUsage(this.id, memUsage.heapUsed);
    
    // CPU使用
    const cpuUsage = process.cpuUsage();
    this.monitor.recordCpuUsage(this.id, cpuUsage.user + cpuUsage.system);
    
    // 缓存统计
    const cacheStats = this.cacheManager.getStats();
    if (cacheStats.misses > 0) {
      const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
      if (hitRate < 0.8) {
        console.warn(`插件 ${this.id} 缓存命中率较低: ${(hitRate * 100).toFixed(2)}%`);
      }
    }
  }
}
```

### 2. 性能问题诊断

```typescript
// 性能问题诊断工具
class PerformanceDiagnostics {
  static async diagnosePlugin(pluginId: string) {
    const monitor = PluginPerformanceMonitor.getInstance();
    const cacheManager = PluginCacheManager.getInstance();
    const memoryPool = MemoryPoolManager.getInstance();
    const connectionPool = ConnectionPoolManager.getInstance();
    
    const metrics = monitor.getMetrics(pluginId);
    const cacheStats = cacheManager.getStats();
    const memoryStats = memoryPool.getStats();
    const connectionStats = connectionPool.getStats();
    
    const issues = [];
    
    // 检查内存使用
    if (metrics.peakMemoryUsage > 100 * 1024 * 1024) {
      issues.push('内存使用过高，建议优化内存分配策略');
    }
    
    // 检查响应时间
    if (metrics.averageResponseTime > 1000) {
      issues.push('响应时间过长，建议优化算法或使用缓存');
    }
    
    // 检查错误率
    if (metrics.errorRate > 0.05) {
      issues.push('错误率过高，建议增强错误处理');
    }
    
    // 检查缓存命中率
    const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
    if (hitRate < 0.7) {
      issues.push('缓存命中率较低，建议优化缓存策略');
    }
    
    // 检查内存碎片
    if (memoryStats.fragmentation > 0.3) {
      issues.push('内存碎片率过高，建议进行内存整理');
    }
    
    // 检查连接使用
    if (connectionStats.activeConnections > connectionStats.totalConnections * 0.8) {
      issues.push('连接池使用率过高，建议增加连接池大小或优化连接复用');
    }
    
    return {
      pluginId,
      metrics,
      issues,
      recommendations: this.generateRecommendations(issues)
    };
  }
  
  private static generateRecommendations(issues: string[]): string[] {
    const recommendations = [];
    
    if (issues.some(issue => issue.includes('内存'))) {
      recommendations.push('使用内存池管理器进行内存分配');
      recommendations.push('及时释放不再使用的内存');
      recommendations.push('考虑使用流式处理大数据');
    }
    
    if (issues.some(issue => issue.includes('响应时间'))) {
      recommendations.push('使用缓存减少重复计算');
      recommendations.push('优化算法复杂度');
      recommendations.push('使用异步处理避免阻塞');
    }
    
    if (issues.some(issue => issue.includes('缓存'))) {
      recommendations.push('调整缓存TTL策略');
      recommendations.push('增加缓存预热');
      recommendations.push('优化缓存键设计');
    }
    
    if (issues.some(issue => issue.includes('连接'))) {
      recommendations.push('使用连接池复用连接');
      recommendations.push('及时释放连接');
      recommendations.push('增加连接超时设置');
    }
    
    return recommendations;
  }
}
```

## 常见性能问题和解决方案

### 1. 内存泄漏

**问题**：插件运行时间长了内存使用持续增长

**解决方案**：
```typescript
// 使用WeakMap避免循环引用
private cache = new WeakMap();

// 及时清理事件监听器
onDisable() {
  this.eventEmitter.removeAllListeners();
}

// 使用内存池管理临时对象
async processData(data: any) {
  const allocation = await this.memoryPool.allocate(data.length * 8);
  try {
    // 处理数据
  } finally {
    this.memoryPool.free(allocation);
  }
}
```

### 2. 频繁的网络请求

**问题**：相同的API请求被重复调用

**解决方案**：
```typescript
// 使用缓存减少重复请求
async fetchData(key: string) {
  const cached = this.cacheManager.getPluginCache(this.id, key);
  if (cached) return cached;
  
  const data = await this.apiCall(key);
  this.cacheManager.setPluginCache(this.id, key, data, 300000);
  return data;
}

// 使用连接池复用连接
const conn = await this.connectionPool.acquire('http', { url: baseUrl });
```

### 3. 阻塞主线程

**问题**：CPU密集型操作阻塞了事件循环

**解决方案**：
```typescript
// 分批处理大数据
async processBatch(items: any[]) {
  const batchSize = 100;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await this.processBatchItems(batch);
    
    // 让出控制权
    await new Promise(resolve => setImmediate(resolve));
  }
}

// 使用Worker线程处理CPU密集型任务
const worker = new Worker('./cpu-intensive-task.js');
const result = await new Promise((resolve, reject) => {
  worker.postMessage(data);
  worker.on('message', resolve);
  worker.on('error', reject);
});
```

### 4. 缓存策略不当

**问题**：缓存命中率低或缓存占用内存过多

**解决方案**：
```typescript
// 根据数据特性设置合适的TTL
this.cacheManager.setPluginCache(this.id, 'static-data', data, 3600000); // 1小时
this.cacheManager.setPluginCache(this.id, 'dynamic-data', data, 60000);  // 1分钟

// 使用LRU策略自动清理
const cacheManager = new PluginCacheManager({
  maxItems: 1000,
  enableLRU: true
});

// 定期清理过期缓存
setInterval(() => {
  this.cacheManager.cleanup();
}, 300000); // 5分钟
```

## 总结

通过合理使用这些性能优化组件，可以显著提升插件的运行效率：

1. **内存池管理器**：减少内存分配开销，降低GC压力
2. **连接池管理器**：复用网络连接，减少连接建立时间
3. **缓存管理器**：避免重复计算，提升响应速度
4. **性能监控器**：实时监控性能指标，及时发现问题
5. **懒加载器**：按需加载插件，减少启动时间

记住，性能优化是一个持续的过程，需要根据实际使用情况不断调整和改进。定期使用性能监控工具分析插件性能，及时发现和解决性能瓶颈。