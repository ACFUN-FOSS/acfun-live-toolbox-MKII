## Why

当前示例插件的 Overlay 演示 UI 较为粗糙，缺少对“只读仓库快照”和“UI→Overlay 消息”的直观展示；同时 UI 侧的演示区没有覆盖“Overlay 是否已在浏览器源打开并完成注册”的状态反馈。为提升开发者上手体验与端到端通信的可观察性，需要对示例插件与 UI 演示栏目进行改造，形成一个清晰的演示样板。

## What Changes

1. 优化示例插件 Overlay 的 UI（base-example/overlay）：
   - 使用分栏布局与统一主题样式（CSS 变量），提升可读性与对比度。
   - 增加“只读仓库数据结构”窗口：实时展示从 SSE `init`/`update` 获取的只读快照（`readonly-store`/`overlay` 切片）。
   - 增加“消息接收窗口”：展示 UI/Window 通过 `overlay.send` 或 `POST /api/overlay/:overlayId/send` 推送的业务消息（SSE `message`）。

2. 更新 UI 的“Overlay 演示栏目”（renderer）：
   - 移除现有演示元素，改为专栏式演示区，聚焦 Overlay 创建、链接复制与通信演示。
   - 新增“状态显示栏”：实时显示 Overlay 是否已在浏览器源中打开并完成注册（通过 Overlay 页面上报 `overlay-registered`/`overlay-unregistered` 事件）。
   - 新增“input + button”交互：输入文本并点击发送，调用 `overlay.send(overlayId, 'demo-message', { text })`（或 HTTP `/api/overlay/:overlayId/send`），Overlay 消息窗口实时更新显示。

3. 事件与通道对齐（配合既有 SSE/POST 能力）：
   - UI/Window → Overlay：保持单向消息通道，统一使用 `overlay.send` 或 `POST /api/overlay/:overlayId/send`。
   - Overlay → 主进程：通过 `POST /api/overlay/:overlayId/action` 报告生命周期与注册状态（`overlay-registered`/`overlay-unregistered`）。
   - 规范建议：在 SSE 频道中扩展转发 Overlay 动作为统一信封（`eventType: 'action'`），便于 UI 侧订阅到注册状态；如不扩展 SSE，则 UI 通过预加载 IPC 订阅主进程的 `overlay.action` 广播。

## Impact

- Affected specs:
  - `openspec/specs/plugin-system/spec.md`（示例插件与 Overlay 集成演示）
  - `openspec/specs/desktop-ui/spec.md`（UI 演示区与状态反馈）
- Affected code:
  - 示例插件：`buildResources/plugins/base-example/overlay/index.html`、`overlay/styles.css`、`overlay/main.js`
  - 示例插件 UI：`buildResources/plugins/base-example/ui/index.html`（或改为渲染器内专用面板）
  - 预加载/渲染器：UI 演示区所在页面（如 `packages/renderer/src/pages/PluginManagementPage.vue` 或新增演示组件）
  - 主进程（若采用 SSE 扩展转发 `overlay-action`）：`packages/main/src/server/ApiServer.ts`

## Non-Goals / Constraints

- 不启动渲染进程开发服务器；不引入 mock，演示依赖真实 SSE/HTTP 与桥接能力。
- 测试限于静态走查与 typecheck；不新增网络依赖或外部服务。
- 仅改造示例插件与 UI 演示栏目，不更改核心桥接 API 的既有签名（`overlay.send`、`overlay.action` 保持）。

## Acceptance Criteria

- Overlay 页面：
  - 能清晰展示只读仓库快照，并在 SSE `init`/`update` 时即时刷新。
  - 能显示 UI 推送的消息（SSE `message`），含时间戳与原始 payload。
  - 在加载与卸载时上报 `overlay-registered`/`overlay-unregistered`（通过 `/api/overlay/:overlayId/action`）。

- UI 演示栏目：
  - 移除旧内容后，存在一栏“Overlay 状态”，能实时显示“未注册/已注册”并随事件变化更新。
  - 存在一栏“消息推送”，输入文本并点击“发送”，Overlay 页面消息窗口即时显示对应内容。
  - 能生成并复制 Overlay 链接（房间、令牌透传保持既有逻辑）。

## Risks / Mitigations

- 风险：SSE 与动作上报时序差异，可能导致 UI 状态短暂不一致。
  - 规避：以“最后一次接收的状态事件”为准；必要时为 UI 演示加上轻微节流与重试提示。
- 风险：OBS 浏览器源未正确加载导致“注册事件”缺失。
  - 规避：UI 显示“未注册”，并提供链接检查提示；在示例插件中增加“本地调试”说明。

## Migration

无对外部插件的迁移要求；仅影响示例插件与 UI 演示内容。现有 API 与路由保持不变（如扩展 SSE 动作转发，将以兼容方式添加，不破坏当前消费者）。

## Approval Gate

本提案获批前不进行实现或接口更改；获批后按任务清单推进，并使用 `pnpm -r run typecheck` 做类型检查（不运行测试）。

