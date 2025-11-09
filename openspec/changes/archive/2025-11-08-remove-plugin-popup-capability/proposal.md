## Why

插件弹窗（BrowserWindow）机制在当前架构中带来较高的复杂度与维护成本：
- 与 Overlay、Wujie 子应用的承载模式存在重复与混淆，增加事件转发与安全边界管理成本。
- 主进程的弹窗生命周期、IPC 以及渲染层的桥接逻辑使得调试与问题定位困难。

为简化系统、统一插件承载路径，决定移除“插件弹窗（Popup）”能力，并在规范中明确该能力“不实现”。

## What Changes
- 移除主进程弹窗管理与事件转发（`PopupManager` 及其在 `PluginManager`、`index.ts` 的集成）。
- 移除预加载层暴露的 `window.electronApi.plugin.popup.*`（`create/close/action/bringToFront`）。
- 移除渲染层的调用点与类型定义（`Sidebar.vue`、`PluginManagementPage.vue`、`global.d.ts`）。
- 清理文档与元数据中对“插件弹窗”的描述（`project.md`、`ui.json`、`ui2.json`、`ddd*.json`、`srs.json`、`docs/plugin-development.md`）。
- 在 `specs/desktop-ui` 与 `specs/plugin-system` 的变更文件中新增/修改要求：明确“插件弹窗不实现”。

**BREAKING**：移除 API 与能力（`window.electronApi.plugin.popup.*` 以及对应 IPC 通道）。

## Impact
- 受影响规范：
  - `specs/plugin-system`（插件运行时能力与API暴露）
  - `specs/desktop-ui`（桌面界面交互能力）
- 受影响代码：
  - 主进程：`packages/main/src/plugins/PopupManager.ts`、`packages/main/src/plugins/PluginManager.ts`、`packages/main/src/index.ts`（事件转发）、`packages/main/src/ipc/ipcHandlers.ts`（`plugin.popup.*` handlers）
  - 预加载层：`packages/preload/src/index.ts`（`window.electronApi.plugin.popup.*`）
  - 渲染层：`packages/renderer/src/components/Sidebar.vue`、`packages/renderer/src/pages/PluginManagementPage.vue`（创建弹窗入口）、`packages/renderer/src/global.d.ts`（类型）
  - 文档/元数据：`openspec/project.md`、`ui.json`、`ui2.json`、`ddd*.json`、`srs.json`、`docs/plugin-development.md`

## Rationale & Migration
- 统一插件承载：优先通过 UI 路由与 Overlay 机制承载插件内容；不再提供独立 BrowserWindow 弹窗模式。
- 插件如需“浮层/窗口”体验，建议迁移到 Overlay（具备 bringToFront 等能力），或在 UI 路由中实现相应交互。

