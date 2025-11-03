# Update Layout to UI2 Specification

## Why

当前的主布局实现基于插件优先的设计，但与ui2.json中定义的LayoutShell规范存在显著差异。ui2.json规范要求使用标准的Vue Router + TDesign布局模式，包括固定的topbar、sidebar导航和RouterView内容区域，而当前实现使用的是自定义的插件容器布局。

此外，ui2.json规范明确定义了应用的目标分辨率为1024x768，这要求布局设计必须在此分辨率下提供最佳的用户体验，包括合理的空间分配、组件尺寸和响应式行为。当前布局未针对此特定分辨率进行优化。

需要调整布局框架以符合ui2.json的标准化设计规范和分辨率约束。

## What Changes

- **BREAKING**: 重构主布局从插件优先模式转换为标准Vue Router布局模式
- 实现LayoutShell组件，包含topbar、sidebar和RouterView结构，针对1024x768分辨率优化
- 添加标准的topbar组件，包含应用标题、账户区域、房间状态和窗口控制
- 重构sidebar导航，支持完整的路由导航结构：
  - 首页 (/home)
  - 直播功能 (/live, /live/room, /live/danmu)
  - 插件管理 (/plugins, /plugins/management, /plugins/:plugname)
  - 系统功能 (/system, /system/settings, /system/console, /system/develop)
- 更新路由配置以匹配ui2.json中定义的完整路由树结构
- 实现动态插件导航：插件管理页面勾选后在侧边栏显示插件入口
- 优化组件尺寸和布局以适配1024x768分辨率，确保界面元素合理分布
- 保持现有插件系统兼容性，但通过标准路由访问

## Impact

- 影响的规范: desktop-ui
- 影响的代码: 
  - `packages/renderer/src/layouts/MainLayout.vue` (重构)
  - `packages/renderer/src/App.vue` (路由集成)
  - `packages/renderer/src/router/` (新增路由配置)
  - `packages/renderer/src/components/` (新增topbar和sidebar组件)
  - `packages/renderer/src/pages/` (新增直播相关页面组件)
  - CSS样式文件 (新增1024x768分辨率适配样式)
- 新增页面组件需求:
  - LivePage (直播主页面)
  - LiveRoomPage (房间管理)
  - LiveDanmuPage (弹幕设置)
  - SystemDevelopPage (开发文档)
- 用户体验: 从插件优先界面转换为标准页面导航界面，在1024x768分辨率下提供最佳体验
- 兼容性: 现有插件需要通过新的路由系统访问，但功能保持不变
- 设计约束: 所有UI组件和布局必须在1024x768分辨率下正确显示和交互
- 导航增强: 支持动态插件导航和完整的功能分类结构