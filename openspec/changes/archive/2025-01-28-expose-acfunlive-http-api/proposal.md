# Expose AcFunLive HTTP API Proposal

## Why

当前后端已经集成了 `acfunlive-http-api`，但该API的功能没有通过HTTP接口暴露给插件和渲染进程使用。插件只能通过 `ApiBridge.callAcfun()` 方法间接调用，渲染进程则完全无法直接访问这些API。这限制了插件和前端的功能扩展能力，特别是在需要直接调用AcFun直播API时。

## What Changes

- **新增HTTP API端点**：在现有的 `ApiServer` 中添加 `/api/acfun/*` 路由，暴露 `acfunlive-http-api` 的核心功能
- **统一接口格式**：提供标准化的请求/响应格式，包含认证、错误处理和速率限制
- **权限控制**：实现基于token的访问控制，确保只有授权的插件和渲染进程可以访问
- **API代理层**：创建代理层来处理认证、参数验证和响应格式化
- **文档和类型定义**：提供完整的API文档和TypeScript类型定义

## Impact

- **受影响的规范**: plugin-system（新增HTTP API访问能力）
- **受影响的代码**: 
  - `packages/main/src/server/ApiServer.ts` - 添加新的路由处理
  - `packages/main/src/plugins/ApiBridge.ts` - 可选：添加HTTP客户端方法
  - `packages/preload/src/index.ts` - 可选：暴露HTTP API访问方法
  - 新增：`packages/main/src/server/AcfunApiProxy.ts` - API代理实现
- **兼容性**: 完全向后兼容，现有的 `callAcfun` 方法继续工作
- **安全考虑**: 需要实现适当的认证和授权机制，防止未授权访问