## Why
默认随包提供并自动安装的示例插件（如 `base-example`）在应用启动后已被检测并写入插件目录，但在渲染层的插件管理页面不可见。这造成“已安装但不可见”的体验问题，阻碍用户发现与启用示例插件。

主要成因（推测与现状验证）：
- 渲染层在纯预览或 IPC 不可用情境下读取插件列表失败或字段不一致，导致列表为空；
- 列表仅展示“active/已启用”插件，默认禁用的示例插件（状态 `disabled`/`inactive`）未纳入显示；
- 字段映射不一致（如 `status`、`enabled`）或缺少必要 UI 字段（icon、入口URL），影响渲染层展示。

## What Changes
- 提供统一的主进程 HTTP 接口 `GET /api/plugins` 返回已安装插件的标准化列表（含 `id/name/version/description/author/enabled/status/installedAt/manifest`）。
- 在渲染层插件 store 增加 HTTP 回退逻辑：当 `window.electronApi?.plugin` 不可用时，使用 `getApiBase()/api/plugins` 拉取并映射状态到 UI 可识别的 `'active'|'inactive'|'error'|'loading'`。
- 明确插件管理页面的展示策略：默认显示所有已安装插件（包含 `inactive/disabled`），并保留筛选/统计用于区分状态。
- 对示例插件的清单字段进行最小化增强（如 icon 路径统一）以提升列表可读性（不改变运行逻辑）。

非目标（本次不做）：
- 不改动插件启停/调试等行为，仅保障“可见性”与列表一致性；
- 不引入新的存储/缓存方案，沿用现有 `localStorage` 轻度持久化；
- 不变更既有热重载与托管路径规则。

## Impact
- 受影响模块：`packages/main/src/server/ApiServer.ts`、`packages/renderer/src/stores/plugin.ts`、`packages/renderer/src/utils/hosting.ts`、插件管理页面。
- 用户体验：首次启动即可在管理页面看到默认示例插件（状态为 `inactive`），可手动启用；
- 风险与回滚：均为增量与容错改动；如需回滚，可移除 HTTP 回退与路由，渲染层退回 IPC-only 模式；

## References
- Spec-driven 开发流程与档案结构：`openspec/AGENTS.md`
- 历史变更（托管与加载逻辑）：`openspec/changes/archive/2025-11-06-update-overlay-and-plugin-wujie-loading`

