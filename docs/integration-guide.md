# AcFun Live Toolbox 集成指南

## 概述

本文档提供了 AcFun Live Toolbox 的完整集成指南，包括认证设置、配置管理、故障排除和最佳实践。

## 认证设置

### API 合规性更新

**重要更新**: 项目已完成与 `acfunlive-http-api` 库的完全合规性验证和修复：

- **QR登录流程**: 现在完全符合 `acfunlive-http-api` 的 `AuthService.qrLogin()` 和 `AuthService.checkQrLoginStatus()` 标准接口
- **Token管理**: 实现了标准的token存储、自动刷新和过期处理机制
- **错误处理**: 统一的错误响应格式，提供详细的错误信息和状态码
- **类型安全**: 使用与 `acfunlive-http-api` 一致的TypeScript类型定义

### AcFun 账号认证

AcFun Live Toolbox 使用 `acfunlive-http-api` 库进行认证，支持二维码登录和令牌管理。

#### 二维码登录流程

1. **启动登录流程**
   ```javascript
   const authManager = new AuthManager(secretsPath);
   const loginResult = await authManager.loginWithQRCode();
   ```

2. **显示二维码**
   - 系统会生成二维码数据
   - 用户需要使用 AcFun 手机客户端扫描二维码

3. **轮询登录状态**
   ```javascript
   const statusResult = await authManager.checkQRLoginStatus();
   ```

4. **处理登录结果**
   - 成功：令牌自动保存到 `secrets.json`
   - 失败：显示错误信息并允许重试

#### 令牌管理

- **自动刷新**：系统会在令牌即将过期时自动刷新
- **过期检查**：定期检查令牌有效性
- **安全存储**：令牌加密存储在 `secrets.json` 文件中

### 认证事件监听

```javascript
authManager.on('qrCodeReady', (data) => {
  // 显示二维码
  console.log('二维码已准备:', data.qrCode);
});

authManager.on('loginSuccess', (data) => {
  // 登录成功处理
  console.log('登录成功:', data.tokenInfo);
});

authManager.on('loginFailed', (data) => {
  // 登录失败处理
  console.error('登录失败:', data.error);
});

authManager.on('tokenExpiring', () => {
  // 令牌即将过期
  console.warn('令牌即将过期，正在刷新...');
});
```

## 配置管理

### 配置文件结构

项目使用分离的配置文件结构：

```
用户数据目录/
├── config.json          # 核心业务配置
├── secrets.json         # 认证令牌（加密存储）
└── plugins/             # 插件配置目录
    ├── plugin-1/
    │   └── settings.json
    └── plugin-2/
        └── settings.json
```

### 配置文件位置

- **Windows**: `%APPDATA%/ACLiveFrame/`
- **macOS**: `~/Library/Application Support/ACLiveFrame/`
- **Linux**: `~/.config/ACLiveFrame/`

### 核心配置 (config.json)

```json
{
  "configVersion": "2.0.0",
  "server": {
    "port": 8080,
    "host": "localhost",
    "enableCors": true
  },
  "danmu": {
    "maxConnections": 10,
    "reconnectInterval": 5000,
    "maxReconnectAttempts": 3
  },
  "performance": {
    "enableMetrics": true,
    "metricsInterval": 30000,
    "maxMemoryUsage": 512
  },
  "plugins": {
    "enableAutoUpdate": false,
    "maxConcurrentPlugins": 20
  }
}
```

### 配置管理 API

```javascript
// 读取配置
const config = await configManager.get('server.port', 8080);

// 更新配置
await configManager.set('server.port', 9090);

// 监听配置变化
configManager.on('configChanged', (key, newValue, oldValue) => {
  console.log(`配置 ${key} 从 ${oldValue} 更改为 ${newValue}`);
});
```

## API 集成

### AcFun Live API 配置

```javascript
// 正确的 API 实例创建方式
const api = new AcFunLiveApi({
  timeout: 30000,
  retryCount: 3,
  baseUrl: 'https://api.acfun.cn'
});

// 设置认证令牌
api.setAuthToken(tokenInfo.accessToken);
```

### 连接池管理

```javascript
const connectionPool = new ConnectionPoolManager({
  maxConnections: 10,
  idleTimeout: 300000,
  enableHealthCheck: true,
  enableCircuitBreaker: true
});

// 获取连接
const connection = await connectionPool.acquire();

// 使用连接
const result = await connection.api.someMethod();

// 释放连接
await connectionPool.release(connection);
```

### 弹幕服务集成

```javascript
// 正确的弹幕服务调用
await api.danmu.startDanmu(liverUID, (event) => {
  switch (event.type) {
    case 'danmu':
      console.log('收到弹幕:', event.content);
      break;
    case 'gift':
      console.log('收到礼物:', event.giftName);
      break;
    case 'like':
      console.log('收到点赞');
      break;
  }
});
```

## 故障排除指南

### 常见问题

#### 1. 认证失败

**症状**: 二维码登录失败或令牌无效

**解决方案**:
- 确保网络连接正常
- 检查 AcFun 手机客户端是否为最新版本
- 清除 `secrets.json` 文件并重新登录
- 检查系统时间是否正确

**调试步骤**:
```javascript
// 检查认证状态
const isAuthenticated = await authManager.isAuthenticated();
console.log('认证状态:', isAuthenticated);

// 验证令牌
const tokenInfo = await authManager.getTokenInfo();
const isValid = await authManager.validateToken(tokenInfo);
console.log('令牌有效性:', isValid);
```

#### 2. 连接问题

**症状**: 无法连接到直播间或频繁断线

**解决方案**:
- 检查网络连接稳定性
- 调整重连参数
- 检查防火墙设置
- 验证直播间 ID 是否正确

**调试步骤**:
```javascript
// 检查连接池状态
const stats = connectionPool.getStats();
console.log('连接池统计:', stats);

// 测试单个连接
try {
  const connection = await connectionPool.acquire();
  console.log('连接获取成功');
  await connectionPool.release(connection);
} catch (error) {
  console.error('连接获取失败:', error);
}
```

#### 3. 性能问题

**症状**: 内存占用过高或响应缓慢

**解决方案**:
- 调整连接池大小
- 启用性能监控
- 检查插件资源使用
- 优化事件处理频率

**调试步骤**:
```javascript
// 检查内存使用
const memoryUsage = process.memoryUsage();
console.log('内存使用:', memoryUsage);

// 检查性能指标
const metrics = performanceMonitor.getMetrics();
console.log('性能指标:', metrics);
```

### 日志分析

#### 启用详细日志

```javascript
// 设置日志级别
logger.setLevel('debug');

// 启用特定模块的日志
logger.enableModule('auth');
logger.enableModule('connection');
logger.enableModule('danmu');
```

#### 日志文件位置

- **主日志**: `logs/main.log`
- **错误日志**: `logs/error.log`
- **调试日志**: `logs/debug.log`

### 网络诊断

#### 连接测试

```bash
# 测试 AcFun API 连接
curl -I https://api.acfun.cn

# 测试 WebSocket 连接
wscat -c wss://klink-newproduct-ws1.kwaicdn.com/websocket
```

#### 代理设置

如果使用代理，需要配置环境变量：

```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=https://proxy.example.com:8080
```

## 最佳实践

## 故障排除

### 常见问题

#### 1. 认证相关问题

**问题：认证失败或令牌过期**

症状：
- 收到 401 未授权错误
- 令牌刷新失败
- 无法访问需要认证的 API

解决方案：
```javascript
// 检查认证状态
if (!authManager.isAuthenticated()) {
  console.log('用户未认证，需要重新登录');
  // 触发重新认证流程
  await authManager.authenticate();
}

// 检查令牌是否即将过期
const tokenInfo = authManager.getTokenInfo();
if (tokenInfo && tokenInfo.expiresAt - Date.now() < 5 * 60 * 1000) {
  console.log('令牌即将过期，尝试刷新');
  await authManager.refreshToken();
}
```

**问题：QR 码登录超时**

症状：
- QR 码显示但无法扫描
- 扫描后没有响应
- 登录流程卡住

解决方案：
```javascript
// 设置合适的超时时间
const qrLoginConfig = {
  timeout: 120000, // 2分钟
  pollInterval: 2000, // 2秒轮询一次
  maxRetries: 3
};

// 添加错误处理
authManager.on('qr-login-timeout', () => {
  console.log('QR 码登录超时，请重新生成');
  // 重新生成 QR 码
});
```

#### 2. 连接相关问题

**问题：连接频繁断开**

症状：
- WebSocket 连接不稳定
- 频繁收到连接丢失事件
- 弹幕接收中断

解决方案：
```javascript
// 检查网络连接
const connectionHealth = connectionManager.getConnectionHealth();
if (connectionHealth.unhealthyConnections > 0) {
  console.log('检测到不健康连接，尝试重连');
  await connectionManager.reconnectUnhealthyConnections();
}

// 调整重连策略
const retryConfig = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2
};
```

**问题：连接池耗尽**

症状：
- 无法建立新连接
- 连接请求被拒绝
- 性能下降

解决方案：
```javascript
// 监控连接池状态
const stats = connectionManager.getConnectionStats();
console.log(`活跃连接: ${stats.activeConnections}/${stats.maxConnections}`);

if (stats.activeConnections >= stats.maxConnections * 0.9) {
  console.warn('连接池接近满载，考虑清理闲置连接');
  await connectionManager.cleanupIdleConnections();
}
```

#### 3. 性能相关问题

**问题：内存泄漏**

症状：
- 内存使用持续增长
- 应用变慢或崩溃
- 垃圾回收频繁

解决方案：
```javascript
// 定期检查内存使用
setInterval(() => {
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 512 * 1024 * 1024) { // 512MB
    console.warn('内存使用过高:', memUsage);
    // 触发清理操作
    global.gc && global.gc();
  }
}, 30000);

// 确保事件监听器被正确移除
class MyComponent {
  constructor() {
    this.handlers = new Map();
  }
  
  addListener(event, handler) {
    this.handlers.set(event, handler);
    eventEmitter.on(event, handler);
  }
  
  destroy() {
    for (const [event, handler] of this.handlers) {
      eventEmitter.off(event, handler);
    }
    this.handlers.clear();
  }
}
```

**问题：API 响应慢**

症状：
- 请求响应时间长
- 界面卡顿
- 超时错误

解决方案：
```javascript
// 使用连接池优化
const poolConfig = {
  maxConnections: 10,
  keepAlive: true,
  timeout: 5000
};

// 实现请求缓存
const cache = new Map();
async function cachedApiCall(key, apiCall, ttl = 60000) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = await apiCall();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

#### 4. 配置相关问题

**问题：配置文件损坏**

症状：
- 应用启动失败
- 配置加载错误
- 默认设置不生效

解决方案：
```javascript
// 配置文件验证和修复
async function validateAndRepairConfig() {
  try {
    const config = await configManager.load();
    const isValid = configManager.validate(config);
    
    if (!isValid) {
      console.warn('配置文件无效，使用默认配置');
      await configManager.reset();
    }
  } catch (error) {
    console.error('配置文件损坏，重新创建:', error);
    await configManager.createDefault();
  }
}
```

### 调试工具

#### 1. 日志分析

```javascript
// 启用详细日志
logger.setLevel('debug');

// 日志过滤
logger.addFilter((level, message, meta) => {
  // 只记录特定模块的日志
  return meta.module === 'auth' || meta.module === 'connection';
});

// 日志导出
const diagnostics = new DiagnosticsService();
const logPackage = await diagnostics.generateDiagnosticPackage();
console.log('诊断包已生成:', logPackage.path);
```

#### 2. 性能监控

```javascript
// 启用性能监控
const monitor = new PerformanceMonitor();
monitor.start();

// 监控特定操作
const timer = monitor.startTimer('api-call');
try {
  await someApiCall();
} finally {
  timer.end();
}

// 获取性能报告
const report = monitor.getReport();
console.log('平均响应时间:', report.averageResponseTime);
```

#### 3. 网络诊断

```javascript
// 网络连接测试
async function networkDiagnostics() {
  const tests = [
    { name: 'DNS解析', test: () => dns.resolve('api.acfun.cn') },
    { name: 'HTTP连接', test: () => fetch('https://api.acfun.cn/health') },
    { name: 'WebSocket连接', test: () => testWebSocketConnection() }
  ];
  
  for (const { name, test } of tests) {
    try {
      await test();
      console.log(`✓ ${name} 正常`);
    } catch (error) {
      console.error(`✗ ${name} 失败:`, error.message);
    }
  }
}
```

### 错误代码参考

| 错误代码 | 描述 | 解决方案 |
|---------|------|----------|
| AUTH_001 | 认证令牌无效 | 重新登录获取新令牌 |
| AUTH_002 | 令牌已过期 | 刷新令牌或重新认证 |
| CONN_001 | 连接超时 | 检查网络连接，调整超时设置 |
| CONN_002 | 连接被拒绝 | 检查服务器状态和防火墙设置 |
| API_001 | API 调用频率超限 | 实现请求限流和重试机制 |
| API_002 | 服务器内部错误 | 稍后重试，如持续出现请联系支持 |

### 1. 错误处理

```javascript
// 使用重试机制
const apiRetryManager = new ApiRetryManager(authManager);

try {
  const result = await apiRetryManager.executeWithRetry(
    'api-call',
    () => api.someMethod(),
    { maxRetries: 3, backoffMs: 1000 }
  );
} catch (error) {
  logger.error('API 调用最终失败', { error: error.message });
}
```

### 2. 资源管理

```javascript
// 正确的资源清理
class MyService {
  constructor() {
    this.connections = [];
    this.timers = [];
  }

  async destroy() {
    // 清理连接
    for (const connection of this.connections) {
      await connection.close();
    }
    
    // 清理定时器
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    
    // 清理事件监听器
    this.removeAllListeners();
  }
}
```

### 3. 配置验证

```javascript
// 配置模式验证
const configSchema = {
  server: {
    port: { type: 'number', min: 1024, max: 65535 },
    host: { type: 'string', default: 'localhost' }
  }
};

const isValid = configManager.validate(config, configSchema);
if (!isValid) {
  throw new Error('配置验证失败');
}
```

### 4. 监控和告警

```javascript
// 设置性能监控
const monitor = new PerformanceMonitor({
  memoryThreshold: 512 * 1024 * 1024, // 512MB
  cpuThreshold: 80, // 80%
  responseTimeThreshold: 5000 // 5秒
});

monitor.on('threshold-exceeded', (metric, value) => {
  logger.warn(`性能阈值超出: ${metric} = ${value}`);
});
```

## 开发环境设置

### 本地开发

1. **克隆项目**
   ```bash
   git clone https://github.com/your-org/ACLiveFrame.git
cd ACLiveFrame
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件设置必要的配置
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

### 测试环境

```bash
# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e
```

### 生产部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm run start
```

## 支持和反馈

如果遇到问题或需要帮助，请：

1. 查看 [API 参考文档](./api-reference.md)
2. 查看 [插件开发指南](./plugin-development.md)
3. 提交 Issue 到项目仓库
4. 加入社区讨论群

---

更多技术细节请参考项目源码和相关文档。