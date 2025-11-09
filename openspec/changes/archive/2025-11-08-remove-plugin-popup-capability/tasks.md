## 1. Implementation
 - [x] 1.1 移除主进程弹窗管理：删除 `packages/main/src/plugins/PopupManager.ts`，从 `PluginManager.ts` 中移除集成与暴露；清理 `index.ts` 中的事件转发 wiring。
 - [x] 1.2 移除预加载层 `window.electronApi.plugin.popup.*` 暴露：删除 `packages/preload/src/index.ts` 中的 `plugin.popup` 方法与相关类型。
 - [x] 1.3 移除渲染层调用与类型：删除/改造 `Sidebar.vue` 与 `PluginManagementPage.vue` 中的 `electronApi.plugin.popup.create` 调用；移除 `packages/renderer/src/global.d.ts` 中的弹窗类型。
- [x] 1.4 文档与元数据清理：更新/移除 `openspec/project.md`、`ui.json`、`ui2.json`、`ddd*.json`、`srs.json`、`docs/plugin-development.md` 中的“插件弹窗”描述与示例。
- [x] 1.5 迁移指引：在 `docs/plugin-development.md` 增加迁移建议（使用 Overlay 或 UI 路由），并标注弹窗能力“不实现”。
 - [x] 1.6 代码静态走查与类型检查：执行 `pnpm -w run typecheck:all`；确保移除后类型通过、无引用残留。
 - [x] 1.7 清理主进程桥接：移除 `packages/main/src/plugins/ApiBridge.ts` 中的 `api.popup.*` 暴露与事件监听。
  - [x] 1.8 移除主进程 IPC handlers：删除 `packages/main/src/ipc/ipcHandlers.ts` 中的 `plugin.popup.*` 处理逻辑。
  - [x] 1.9 更新示例插件：清理 `buildResources/plugins/base-example/window` 中的 `popupId` 相关内容或迁移至 Overlay 示例。

## 2. Spec Deltas
 - [x] 2.1 在 `specs/plugin-system` 变更文件中新增要求：插件弹窗能力“不实现”，移除相关 API 暴露与 IPC 通道。
 - [x] 2.2 在 `specs/desktop-ui` 变更文件中新增要求：桌面端不提供插件弹窗；Overlay 能力不受影响。

## 3. Approval Gate
- 在本提案获批前，不进行代码删除与文档直接修改；仅提交变更提案与规范deltas。
