## Why

当前实现中存在与架构不一致的问题：
- Overlay 的生命周期应当由“浏览器源加载/关闭链接”自然驱动，而非手动创建/关闭/更新。
- 主进程已存在消息中心（`packages/main/src/persistence/DataManager.ts`），但未统一承载 store 状态、生命周期事件与跨端消息的发布/订阅。
- Overlay 的消息传递应通过 SSE 单向流式下发（UI/window → 主进程 → SSE → Overlay），并具备离线缓冲与无感重连能力；而现状存在冗余的手动 overlay 操作与不一致的链接/订阅来源。

结果是：UI 内出现与“手动创建 overlay”相关的逻辑与按钮、回退基址误判导致链接/SSE 无效、消息的时序一致性与主进程重启场景下的恢复能力不足。

## What Changes

以“消息为中心”的模型重构 Overlay 通道，落实你的架构：

1) 主进程统一消息中心
- 启用并扩展 `DataManager` 为中心消息总线（store 更新、生命周期事件、overlay 消息）。
- 增设轻量消息队列：按 `pluginId` 维护待下发的 overlay 消息，支持至少一次投递（at-least-once）与 TTL/容量上限，主进程重启后从持久化文件恢复近期队列。
- SSE 桥接：为每个插件暴露 `GET /sse/plugins/:pluginId/overlay`，统一下发事件（包含 `id`、`timestamp`、`type`、`payload`），支持 `Last-Event-ID` 无感重连与重放。

2) API 对齐与简化
- 移除（或兼容性置空）overlay 手动操作 API（create/update/close/show/hide/bringToFront/list），仅保留“发送消息”（send）与“上报动作”（action）。
- 统一 UI/window → overlay 消息入口：`POST /api/plugins/:pluginId/overlay/messages`（主进程入队）。
- 统一 overlay → 主进程动作上报：`POST /api/plugins/:pluginId/overlay/action`（如 `overlay-loaded`/`overlay-unloaded`），用于在消息中心维护在线状态与刷新投递策略。

3) 链接与订阅来源统一
- Overlay 链接为“静态”：`/overlay-wrapper?plugin=<pluginId>&type=overlay`（不再区分 overlayId，直接以 `pluginId` 作为通道标识）。
- 所有链接与 SSE 订阅均使用 ApiServer 基址（通过渲染层桥接 `get-api-base` 返回），避免 `location.origin` 在应用内误判。

4) 渲染层职责收敛（Wujie frame）
- 渲染进程 frame 仅负责：
  - 接收主进程通过 IPC 的 store 更新与生命周期事件，并用 Wujie eventBus（事件名带 `pluginId` 前缀）向内页 `$emit`；
  - 接收 UI/window 的“发送消息”请求并转发到主进程（HTTP 或 IPC），不承担 overlay 生命周期管理；
- 移除 UI 内与“创建/关闭/更新 overlay”相关的控件和代码路径，保留复制链接与消息发送；

5) 稳定性与重连
- Overlay 通过 SSE 自动重连并利用 `Last-Event-ID` 恢复流；主进程对离线 overlay 入队消息在上线后批量下发。
- 队列出站按 `pluginId` 限流，避免主进程重启后“洪泛”；提供心跳机制（如每 N 秒 `ping`），辅助在线状态判定。

## Impact

- 影响规范：`specs/plugin-system` 与 `specs/desktop-ui`（Overlay 生命周期语义改为“链接即创建”，通道改为“消息中心 + SSE”）。
- 影响代码：`packages/main/src/persistence/DataManager.ts`（升级消息中心）、`ApiServer.ts`（新增/对齐路由）、`packages/preload/src/index.ts`（移除/置空冗余 overlay API，仅保留 send/action）、渲染层 frame（仅透传，事件名加插件独立前缀）。
- 兼容策略：保留旧 overlay API 的方法签名，但内部置空并发出 deprecation 日志；`overlayId` 兼容为 `pluginId`。
- 不涉及测试执行：仅静态走查与 typecheck。

## Risks / Trade-offs
- 至少一次语义可能在极端网络下产生重复消息；以 `id` 与去重窗口缓解。
- 简化为“pluginId 即 overlayId”后，若未来同插件存在多 overlay 实例需求，需扩展通道键命名（本提案不覆盖）。
- SSE 单向下发如需 overlay 主动上报丰富状态，仍需 HTTP 动作上报（可保留最小集）。

## Migration Plan
- 第一阶段：增量引入消息中心队列与 SSE 路由；保持旧 API 兼容但置空；UI 清理手动 overlay 控件。
- 第二阶段：全量切换 UI/window 发送路径到 `POST /api/plugins/:pluginId/overlay/messages`；Overlay 只订阅 SSE 并上报 `overlay-loaded/unloaded`。
- 第三阶段：移除旧 overlay API 的调用点与文档；归档变更。

