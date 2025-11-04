# Token Management Architecture Refactor

## Why

当前项目中存在多个acfunlive-http-api实例，每个实例都独立管理token，导致以下问题：
1. Token状态不一致：不同模块的API实例可能有不同的认证状态
2. 重复认证：多个实例需要分别设置token，增加了复杂性
3. 内存浪费：多个API实例占用不必要的内存资源
4. 维护困难：token更新需要同步到多个实例

## What Changes

- **BREAKING**: 重构token管理架构，在主进程中统一管理单一的acfunlive-http-api实例
- 移除各模块中独立的API实例创建逻辑
- 创建统一的TokenManager服务，负责token的存储、更新和分发
- 修改所有API调用通过统一的实例进行
- 更新插件系统的API桥接机制，使用统一的认证状态

## Impact

- Affected specs: plugin-system（插件API调用机制变更）
- Affected code: 
  - `packages/main/src/adapter/AcfunDanmuModule.ts`
  - `packages/main/src/server/AcfunApiProxy.ts`
  - `packages/main/src/services/AuthManager.ts`
  - `packages/main/src/adapter/ConnectionPoolManager.ts`
  - `packages/main/src/plugins/ApiBridge.ts`
  - `packages/main/src/adapter/AcfunAdapter.ts`