# Technical Design

## Context

当前系统已经通过 `AcfunDanmuModule` 和 `AcfunAdapter` 集成了 `acfunlive-http-api`，但这些功能只能在主进程内部使用。插件通过 `ApiBridge.callAcfun()` 可以间接访问，但缺乏直接的HTTP接口。渲染进程则完全依赖IPC通信。

为了提供更灵活的API访问方式，需要将 `acfunlive-http-api` 的功能通过HTTP接口暴露出来，同时保持安全性和性能。

## Goals / Non-Goals

### Goals
- 通过HTTP接口暴露 `acfunlive-http-api` 的核心功能
- 提供统一的认证和权限控制机制
- 保持与现有系统的兼容性
- 实现适当的速率限制和错误处理
- 提供清晰的API文档和类型定义

### Non-Goals
- 不替换现有的 `ApiBridge.callAcfun()` 方法
- 不改变现有的弹幕EventSource机制
- 不实现复杂的用户权限管理系统
- 不支持跨域访问（仅限本地访问）

## Decisions

### 1. API路由设计
```
/api/acfun/auth/*          - 认证相关API
/api/acfun/danmu/*         - 弹幕相关API  
/api/acfun/live/*          - 直播相关API
/api/acfun/user/*          - 用户相关API
/api/acfun/gift/*          - 礼物相关API
/api/acfun/manager/*       - 房管相关API
/api/acfun/replay/*        - 回放相关API
```

### 2. 认证机制
- 使用简单的Bearer Token认证
- Token由系统内部生成，包含来源标识（plugin-id或renderer）
- Token有效期为会话期间，应用重启后失效
- 支持不同来源的权限级别控制

### 3. 代理层架构
```typescript
class AcfunApiProxy {
  private api: AcFunLiveApi;
  private authManager: AuthManager;
  private rateLimiter: RateLimitManager;
  
  async proxyRequest(endpoint: string, method: string, params: any, token: string): Promise<ApiResponse>
}
```

### 4. 响应格式标准化
```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
  timestamp: number;
  requestId: string;
}
```

### 5. 错误处理策略
- 统一错误码和错误消息
- 区分客户端错误（4xx）和服务器错误（5xx）
- 记录详细的错误日志用于调试
- 对敏感错误信息进行脱敏处理

## Risks / Trade-offs

### Risks
- **安全风险**: HTTP接口可能被恶意访问，需要严格的认证控制
- **性能影响**: 额外的HTTP层可能增加延迟
- **维护复杂性**: 需要维护API代理层和路由映射

### Mitigations
- 实现基于token的访问控制，限制本地访问
- 使用连接池和缓存优化性能
- 提供清晰的文档和测试覆盖

### Trade-offs
- **灵活性 vs 安全性**: 选择相对简单的认证机制，平衡易用性和安全性
- **功能完整性 vs 维护成本**: 优先暴露核心API，后续按需扩展

## Migration Plan

### Phase 1: 核心基础设施
1. 实现 `AcfunApiProxy` 类
2. 在 `ApiServer` 中添加基础路由框架
3. 实现认证中间件

### Phase 2: 核心API暴露
1. 实现认证API端点
2. 实现弹幕API端点
3. 实现直播API端点

### Phase 3: 扩展和优化
1. 添加用户、礼物、房管API
2. 实现客户端集成方法
3. 完善文档和测试

### Rollback Plan
- 新功能通过配置开关控制，可以随时禁用
- 不影响现有的 `callAcfun` 方法
- 可以通过移除路由快速回滚

## Open Questions

1. **权限粒度**: 是否需要实现更细粒度的API权限控制？
2. **缓存策略**: 对于频繁调用的API是否需要实现缓存？
3. **监控指标**: 需要收集哪些API使用指标？
4. **版本控制**: 是否需要考虑API版本控制机制？