# A3插件优先版桌面界面技术设计

## Context

当前应用使用Vue Router进行多页面导航，包括Dashboard、LiveManagement、Statistics等独立页面。插件系统已实现但缺乏统一的UI入口。需要重构为插件优先的单页面应用架构，同时保持现有功能的可用性。

## Goals / Non-Goals

### Goals
- 实现插件优先的用户界面，插件成为主要交互入口
- 提供实时弹幕展示，增强用户的直播互动体验
- 保持现有功能的完整性和稳定性
- 支持插件的动态加载和热切换

### Non-Goals
- 不改变现有的插件API和数据模型
- 不影响后端服务和数据持久化逻辑
- 不实现插件的在线市场功能

## Decisions

### 界面架构决策
- **决策**: 采用单页面应用+微前端容器的架构
- **原因**: 
  - 支持插件的动态加载和隔离
  - 减少页面切换的性能开销
  - 便于实现统一的状态管理
- **替代方案**: 保持多页面架构但添加插件页面 - 被拒绝，因为不符合插件优先理念

### 微前端集成决策
- **决策**: 继续使用Wujie作为微前端容器
- **原因**: 
  - 已有技术栈，减少学习成本
  - 支持Vue3和良好的隔离性
  - 符合现有的技术架构
- **替代方案**: qiankun或single-spa - 被拒绝，因为迁移成本高

### 弹幕展示决策
- **决策**: 使用顶部滚动条展示最新弹幕
- **原因**: 
  - 不占用主要工作区域
  - 提供持续的直播状态感知
  - 易于实现和维护
- **替代方案**: 侧边栏弹幕 - 被拒绝，因为占用过多空间

## Component Architecture

```
MainLayout
├── TopDanmuBar (新增)
│   ├── DanmuScroller
│   └── RoomStatusIndicator
├── LeftPluginNav (新增)
│   ├── PluginList
│   ├── SystemShortcuts
│   └── PluginInstaller
└── CentralPluginContainer (新增)
    ├── WujieContainer
    ├── PluginRouter
    └── FallbackContent
```

## Data Flow

```
WebSocket Events → EventBus → TopDanmuBar
PluginManager → PluginList → PluginRouter → WujieContainer
IPC Handlers → PluginActions → PluginManager
```

## Risks / Trade-offs

### 风险: 性能影响
- **风险**: 单页面架构可能导致内存占用增加
- **缓解**: 实现插件的懒加载和卸载机制

### 风险: 兼容性问题
- **风险**: 现有功能在新架构下可能出现问题
- **缓解**: 保留原有组件，通过路由适配器进行兼容

### 风险: 用户体验变化
- **风险**: 用户需要适应新的界面布局
- **缓解**: 提供平滑的过渡动画和用户引导

## Migration Plan

### 阶段1: 基础架构
1. 创建新的主布局组件
2. 实现插件容器和导航
3. 保持现有路由作为后备

### 阶段2: 功能迁移
1. 逐步将现有功能适配到新布局
2. 实现弹幕展示功能
3. 添加插件管理界面

### 阶段3: 优化和测试
1. 性能优化和内存管理
2. 用户体验测试和调整
3. 移除旧的路由和组件

### 回滚计划
- 保留原有路由配置作为feature flag
- 可通过配置快速切换回原有界面
- 数据层不受影响，确保数据安全

## Open Questions

- 插件容器的内存管理策略需要进一步细化
- 弹幕显示的性能优化方案需要实际测试验证
- 用户自定义布局的支持程度需要确定