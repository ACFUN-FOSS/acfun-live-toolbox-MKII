# Token Management Architecture Design

## Context

当前项目中存在多个acfunlive-http-api实例分散在不同模块中，每个实例独立管理token状态。这种架构导致了token状态不一致、重复认证、内存浪费等问题。需要重构为统一的token管理架构。

## Goals / Non-Goals

### Goals
- 统一token管理：所有API调用使用同一个认证状态
- 简化架构：减少重复的API实例创建和管理
- 提高性能：减少内存占用和重复认证
- 增强可维护性：集中管理token生命周期

### Non-Goals
- 不改变现有的API接口签名
- 不影响插件系统的现有功能
- 不改变用户的登录体验

## Decisions

### Decision 1: 单例TokenManager服务
**What**: 创建一个单例的TokenManager服务，管理全局唯一的acfunlive-http-api实例
**Why**: 确保所有模块使用相同的认证状态，避免状态不一致问题

**Alternatives considered**:
- 保持现有多实例架构但添加同步机制 → 复杂度高，容易出错
- 使用事件总线同步token状态 → 仍然存在多实例内存开销

### Decision 2: 渐进式重构策略
**What**: 逐步替换各模块中的API实例，保持向后兼容
**Why**: 降低重构风险，确保系统稳定性

### Decision 3: 事件驱动的状态通知
**What**: 使用EventEmitter模式通知token状态变更
**Why**: 解耦各模块对token状态的依赖，提高系统灵活性

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Process                             │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────────┐│
│  │   TokenManager  │    │     acfunlive-http-api          ││
│  │   (Singleton)   │────│        (Single Instance)        ││
│  │                 │    │                                  ││
│  │ - token storage │    │ - HTTP client                    ││
│  │ - auth state    │    │ - API services                   ││
│  │ - event emitter │    │ - request handling               ││
│  └─────────────────┘    └──────────────────────────────────┘│
│           │                                                 │
│           │ (events)                                        │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Consuming Modules                          ││
│  │                                                         ││
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ ││
│  │ │AcfunAdapter │ │AcfunApiProxy│ │   ApiBridge         │ ││
│  │ └─────────────┘ └─────────────┘ └─────────────────────┘ ││
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ ││
│  │ │AuthManager  │ │DanmuModule  │ │   Other Modules     │ ││
│  │ └─────────────┘ └─────────────┘ └─────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### TokenManager Service
```typescript
class TokenManager extends EventEmitter {
  private static instance: TokenManager;
  private api: AcFunLiveApi;
  private tokenInfo: TokenInfo | null = null;
  
  static getInstance(): TokenManager;
  getApiInstance(): AcFunLiveApi;
  setToken(token: TokenInfo): Promise<void>;
  clearToken(): Promise<void>;
  isAuthenticated(): boolean;
  refreshToken(): Promise<AuthResult>;
}
```

### Migration Strategy
1. 创建TokenManager服务
2. 逐步替换各模块的API实例获取方式
3. 保持现有接口不变，内部使用统一实例
4. 添加事件监听处理token状态变更
5. 移除废弃的API实例创建代码

## Risks / Trade-offs

### Risk: 单点故障
**Mitigation**: 添加健壮的错误处理和恢复机制，确保TokenManager服务的稳定性

### Risk: 并发访问问题
**Mitigation**: 使用适当的锁机制和异步处理，确保token操作的原子性

### Trade-off: 灵活性 vs 一致性
选择一致性，牺牲了部分模块独立配置API的灵活性，但获得了更好的状态管理

## Migration Plan

### Phase 1: 基础设施
1. 创建TokenManager服务
2. 实现基本的token管理功能
3. 添加事件通知机制

### Phase 2: 核心模块迁移
1. 迁移AuthManager使用统一实例
2. 迁移AcfunApiProxy使用统一实例
3. 测试认证流程

### Phase 3: 其他模块迁移
1. 迁移AcfunDanmuModule
2. 迁移AcfunAdapter
3. 迁移ApiBridge

### Phase 4: 清理和优化
1. 移除废弃代码
2. 优化性能
3. 更新文档

### Rollback Plan
如果出现问题，可以通过以下步骤回滚：
1. 恢复各模块的独立API实例创建
2. 禁用TokenManager服务
3. 恢复原有的token管理逻辑

## Open Questions

- 是否需要支持多用户同时登录的场景？
- 如何处理token过期时的自动刷新策略？
- 是否需要持久化token状态到磁盘？