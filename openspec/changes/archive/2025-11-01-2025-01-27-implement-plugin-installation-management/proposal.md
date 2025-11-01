# 实现插件安装管理功能

## Why

当前插件系统虽然已有基础架构和UI框架，但缺少核心的插件安装管理功能。用户无法通过界面实际安装本地插件文件，现有的安装按钮只是模拟操作。这阻碍了插件生态的发展，用户无法体验完整的插件工作流程。为了实现真正可用的插件系统，需要完善插件安装、验证、依赖检查和生命周期管理功能。

## What Changes

- 实现本地插件文件导入功能，支持 .zip 和 .tar.gz 格式
- 添加插件清单文件（manifest.json）验证机制
- 实现插件依赖检查和冲突检测
- 添加插件安装进度反馈和错误处理
- 实现插件启用/禁用状态管理
- 添加插件卸载功能
- 扩展插件生命周期事件处理
- 完善插件存储和配置管理

## Impact

- Affected specs: 
  - `plugin-system` (扩展现有 capability)
- Affected code: 
  - `packages/renderer/src/components/LeftPluginNav.vue` - 完善安装UI逻辑
  - `packages/main/src/services/PluginManager.ts` - 扩展插件管理功能
  - `packages/main/src/ipc/` - 添加插件安装相关IPC处理
  - `packages/main/src/storage/` - 插件配置和状态存储
  - `packages/preload/src/` - 添加插件相关API暴露