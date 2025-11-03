# Plugin System Spec Delta

## MODIFIED Requirements

### Requirement: Plugin API Bridge
插件系统MUST提供API桥接功能，允许插件通过IPC调用主进程的统一TokenManager管理的AcFun API服务

#### Scenario: Plugin API call through unified token manager
- **WHEN** 插件调用AcFun API服务
- **THEN** 系统必须通过TokenManager获取统一的API实例进行调用
- **AND** 确保所有插件使用相同的认证状态

### Requirement: Authentication State Access
插件MUST能够通过API桥接访问TokenManager管理的统一认证状态和用户信息

#### Scenario: Plugin access authentication state
- **WHEN** 插件请求当前认证状态
- **THEN** 系统必须返回TokenManager管理的统一认证状态
- **AND** 确保状态信息的一致性

## ADDED Requirements

### Requirement: Unified Token State
插件系统MUST确保所有插件API调用使用TokenManager提供的统一认证状态，不允许插件独立管理token

#### Scenario: Prevent independent token management
- **WHEN** 插件尝试独立管理token
- **THEN** 系统必须阻止此操作
- **AND** 强制插件使用统一的TokenManager服务

### Requirement: Token State Notification
插件系统MUST支持向插件通知token状态变更事件（登录、登出、token刷新），允许插件响应认证状态变化

#### Scenario: Token state change notification
- **WHEN** token状态发生变更（登录、登出、刷新）
- **THEN** 系统必须向所有相关插件发送状态变更通知
- **AND** 插件能够响应这些状态变化更新其功能