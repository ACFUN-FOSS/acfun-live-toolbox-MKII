## Why

- 示例插件的图标未能加载，影响列表与详情页的视觉一致性与可辨识度。
- 安装插件、刷新、插件目录的图标与文字出现上下未对齐，交互元素排版不统一、可读性下降。
- 安装插件仅保留本地文件安装，去掉在线安装和插件商店标签页，简化流程、减少无效入口与逻辑复杂度。

## What Changes

- 修复示例插件图标加载
  - 统一 `manifest.icon` 的路径解析策略，确保在打包与开发模式下均能正确解析。
  - 为渲染层提供 icon 回退：`manifest.icon` 无效时使用默认图标资源，避免空白图标。
  - 受影响文件：`buildResources/plugins/base-example/manifest.json`、`packages/renderer/src/pages/PluginManagementPage.vue`（列表图标渲染）。

- 统一图标与文字的垂直对齐
  - 标准化行容器布局（`display:flex; align-items:center;`），统一 `t-icon` 尺寸与文本行高。
  - 调整安装、刷新、插件目录区域的条目样式，保证多处交互元素对齐一致。
  - 受影响文件：`packages/renderer/src/pages/PluginManagementPage.vue`、必要的局部样式片段/组件容器。

- 简化安装流程（移除在线安装与插件商店）
  - 保留“本地文件”安装；移除在线 URL 安装与插件商店标签页及相关操作逻辑。
  - 清理 `installPluginFromStore`、远程 URL 字段与相关的标签页模板/状态。
  - 受影响文件：`packages/renderer/src/pages/PluginManagementPage.vue`、`packages/renderer/src/stores/plugin.ts`（如存在商店相关方法则一并清理）。

- 非目标（Non-Goals）
  - 不更改插件启停/生命周期管理逻辑；不引入新的安装源。
  - 不更改主进程 IPC 与持久化逻辑；仅限 UI/清单与渲染层样式/布局。

- 验证与约束
  - 仅进行静态代码走查与类型检查（`pnpm -C packages/renderer typecheck ; pnpm -C packages/main typecheck ; pnpm -C packages/preload typecheck`）。
  - 不启动渲染进程开发服务器；UI 视觉与对齐效果由人工确认。

## Impact

- Affected specs: `desktop-ui`（页面布局与组件对齐），`plugin-system`（清单 icon 字段解析与渲染）。
- Affected code: `buildResources/plugins/base-example/manifest.json`、`packages/renderer/src/pages/PluginManagementPage.vue`、（可能）`packages/renderer/src/stores/plugin.ts`。
- BREAKING（用户体验层面）：移除“在线安装”和“插件商店”标签页与相关逻辑，安装入口只保留本地文件。
- Migration：不涉及数据迁移；如存在商店安装方法/入口，统一删除或注释，文档与 UI 文案同步更新。
