# Tasks — refactor-overlay-messaging-to-sse-message-center

基于 `openspec/AGENTS.md` 的三阶段流程，跟踪从提案到实现与归档的完整任务。

## Stage 1 — Proposal & Validation
- [x] 1.1 阅读 `openspec/project.md` 与相关 specs，明确现状与约束
- [x] 1.2 创建重构提案：`proposal.md`（已完成）
- [x] 1.3 编写规范增量：在 `changes/refactor-overlay-messaging-to-sse-message-center/specs/` 下为以下能力添加增量规范（含至少一个 `#### Scenario:`）
  - `plugin-system/spec.md`（消息中心 + SSE + 队列语义）
  - `desktop-ui/spec.md`（渲染 frame 透传职责与事件命名约束）
 - [x] 1.4 严格校验：运行 `openspec validate refactor-overlay-messaging-to-sse-message-center --strict`
 - [x] 1.5 审计主进程状态存储（PluginManager/ProcessManager/OverlayManager），结论：缺少页面级状态中心

## Stage 2 — Implementation
 - [x] 2.1 主进程：扩展 `DataManager` 为统一消息中心（发布/订阅接口、队列、TTL、持久化）
 - [x] 2.2 主进程：新增 SSE 路由 `GET /sse/plugins/:pluginId/overlay`，支持 `Last-Event-ID` 与心跳
 - [x] 2.3 主进程：新增 `POST /api/plugins/:pluginId/overlay/messages` 入队；保留 `action` 上报 `overlay-loaded/unloaded`
 - [x] 2.4 渲染层：frame 透传 store 更新、生命周期事件与跨端消息（UI/window→overlay）（事件名加 `pluginId` 前缀），通过 SSE 接收后以 eventBus `$emit('plugin:<pluginId>:overlay-message')` 转发到内页；移除手动 overlay 控件与调用
 - [x] 2.5 预加载层：`overlay.*` 仅保留 `send/action`；其他方法移除；
 - [x] 2.6 UI/window：统一通过 HTTP 发送消息到新入口（`POST /api/plugins/:pluginId/overlay/messages`）；复制链接改为 `/overlay-wrapper?plugin=<pluginId>&type=overlay`（Api 基址）
 - [x] 2.7 Overlay 页面：仅订阅 SSE；加载/卸载上报动作；实现无感重连与消息去重窗口
 - [x] 2.8 类型检查：`pnpm -r run typecheck`（不运行测试；测试仅限静态走查与 typecheck）
 - [x] 2.9 主进程：新增 PluginPageStatusManager，聚合 UI/Window/Overlay 页面状态与最后响应时间（online/offline、lastEventTs、lastHeartbeatTs、lastSseId）
 - [x] 2.10 主进程：补齐 OverlayManager/ApiServer 状态更新逻辑（消息/动作更新 updatedAt；SSE 心跳与 Last-Event-ID）
 - [x] 2.11 代码清理：识别并移除重构产生的废弃代码、冗余函数与注释（不保留历史兼容逻辑）
 - [x] 2.12 渲染层：暴露实时监控接口（通过预加载桥接只读访问；订阅页面在线/离线、心跳与最后事件；提供查询/订阅 API 供 UI/Window 使用）

## Stage 3 — Completion & Archive
 - [x] 3.1 更新任务清单：如实将已完成任务标记为 `[x]`
 - [x] 3.2 严格校验：`openspec validate refactor-overlay-messaging-to-sse-message-center --strict` 全绿
 - [x] 3.3 请求最终批准：确认符合验收标准与约束
 - [x] 3.4 归档（部署后）：`openspec archive refactor-overlay-messaging-to-sse-message-center --yes`
 - [x] 3.5 根据实际能力变更更新 `openspec/specs/`（如需要），再次校验全绿

## Notes & Constraints
- 不引入 mock；所有测试仅限静态走查与 typecheck。
- 不启动渲染进程开发服务器；视觉验证使用预览工具与现有打包/运行方式。
- 多条命令使用 `;` 连接（例如：`pnpm -r run typecheck; openspec validate refactor-overlay-messaging-to-sse-message-center --strict`）。
 - 无历史兼容要求：废弃与冗余代码可直接删除；不保留 `overlayId` 兼容逻辑。
 - 文档对齐：已更新 `docs/plugin-development.md` 与 `docs/integration-guide.md` 的 Overlay/SSE 章节（架构、端点、示例与约束）。
