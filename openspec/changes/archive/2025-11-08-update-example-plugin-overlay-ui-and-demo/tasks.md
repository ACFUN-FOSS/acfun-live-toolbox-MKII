# Tasks — update-example-plugin-overlay-ui-and-demo

基于 `openspec/AGENTS.md` 的三阶段流程，跟踪从提案到实现与归档的完整任务。审批通过前不进入实现阶段。

## Stage 1 — Proposal & Validation
- [x] 1.1 创建提案：`proposal.md`（已完成）
- [x] 1.2 创建任务清单：`tasks.md`（已完成）
- [x] 1.3 编写规范增量：在 `changes/update-example-plugin-overlay-ui-and-demo/specs/` 下为以下能力添加增量规范（含至少一个 `#### Scenario:`）
  - `plugin-system/spec.md`（示例插件 Overlay 演示与集成）
  - `desktop-ui/spec.md`（UI 演示栏目与状态反馈）
- [x] 1.4 严格校验：运行 `openspec validate update-example-plugin-overlay-ui-and-demo --strict`
- [x] 1.5 请求审批：在提案获批前不进入 Stage 2（已发起审批请求）

## Stage 2 — Implementation
- [x] 2.1 研读：`proposal.md` 与相关 specs，确认实现细节与边界
- [x] 2.2 改造示例插件 Overlay 页面（位于 `buildResources/plugins/base-example/overlay/`）
  - 分栏与主题样式（统一 CSS 变量），提升可读性（已完成）
  - “只读仓库快照”窗口：实时渲染只读切片（通过宿主转发的 SSE 事件）（已完成）
  - “消息接收窗口”：实时显示 UI 通过 `overlay.send` 推送的消息（已完成）
  - 加载/卸载时上报注册状态：`POST /api/overlay/:overlayId/action`（已完成）
 - [x] 2.3 改造示例插件 UI 页面（位于 `buildResources/plugins/base-example/ui/`）
  - 移除旧演示元素，改为专栏式演示区（已完成）
 - “状态显示栏”：实时显示 Overlay 注册状态（SSE `action` 订阅）（已完成）
  - “输入框 + 发送按钮”：向 Overlay 推送文本消息（`overlay.send` 或 `POST /api/overlay/:overlayId/send`）（已完成）
  - 注：应用内基于原生注入（检测 `overlay.send`）启用发送；静态预览禁用
 - 注：链接生成使用绝对地址（基于 `location.origin`），静态预览回退到 `/overlay/overlay.html`
 - [x] 2.12 修复：UI 生成的 Overlay 链接改为 `/overlay-wrapper?plugin=...&type=overlay&overlayId=...`，避免访问 `/overlay/:id` 404（已完成）
 - [x] 2.4 事件与通道对齐
  - UI→Overlay：统一使用 `overlay.send` 或 `POST /api/overlay/:overlayId/send`（已完成）
  - Overlay→主进程：使用 `POST /api/overlay/:overlayId/action` 上报注册状态（已完成）
  - UI 订阅注册状态：优先 SSE `eventType: 'action'`（如未扩展则用 IPC 广播）（已完成）
 - 注：SSE 订阅 URL 使用绝对地址；静态预览环境显示断开属预期，应用内正常
- [x] 2.5 可选增强：扩展 ApiServer SSE 转发 `overlay-action` 为统一信封（兼容式，不破坏现有消费者）
 - [x] 2.6 类型检查：`pnpm -r run typecheck`（不运行测试；测试仅限静态走查与 typecheck）
- [x] 2.7 视觉验证：调用预览以检查 UI 改动（调用预览工具，遵循“UI 改动需预览”的要求；不启动渲染进程开发服务器）
 - [x] 2.8 文档增量（如需）：在 `docs/plugin-development.md` 或相关文档补充“分栏布局与消息演示”的说明
- [x] 2.9 修复：应用内桥接判定（iframe+overlay.send）、UI 初始化创建 Overlay 并以真实 overlayId 生成链接与订阅 SSE（避免无 overlayId 和 SSE closed）
 - [x] 2.10 修复：等待宿主 `plugin-init` 握手完成后再创建 Overlay，避免父窗口消息监听未就绪导致 `bridge-request` 丢失（链接卡“生成中”、SSE未连接、发送指向默认ID）
 - [x] 2.11 调试：在示例 UI 的桥接、创建、发送与 SSE 关键路径插入详细 console.log 日志，用于定位“链接生成中/发送失败/SSE未连接”等问题的真实原因
 - [x] 2.13 修复：将 `overlayBridgeAvailable` 提升到模块作用域，确保页面加载时能正确监听 `plugin-init` 并触发 `overlay.create`（解决不点击“发送”就一直“未连接/生成中”的问题）
 - [x] 2.14 增强：为“复制链接”增加剪贴板回退（`execCommand('copy')`），在 `navigator.clipboard` 不可用时仍能复制成功（解决“点击复制实际上没复制”问题）
 - [x] 2.15 增强：渲染器增加桥接命令 `get-api-base`，向插件 UI 返回 ApiServer 基址（用于生成链接与订阅 SSE）
 - [x] 2.16 修复：示例 UI 使用 ApiServer 基址生成 `/overlay-wrapper` 链接和 `/sse/overlay/:id` 订阅，避免 `location.origin` 在应用内误判导致“链接生成中/未连接”

## Stage 3 — Completion & Archive
- [x] 3.1 更新任务清单：如实将已完成任务标记为 `[x]`
- [x] 3.2 严格校验：`openspec validate update-example-plugin-overlay-ui-and-demo --strict` 全绿
- [x] 3.3 请求最终批准：确认符合验收标准与约束（已发起请求）
- [x] 3.4 归档（部署后）：`openspec archive update-example-plugin-overlay-ui-and-demo --yes`
- [x] 3.5 根据实际能力变更更新 `openspec/specs/`（如需要），再次校验全绿（本变更为示例与演示增强，无需更新全局 `openspec/specs/`；已复核无新增能力变更）

## Notes & Constraints
- 不引入 mock；所有测试仅限静态走查与 typecheck。
- 不启动渲染进程开发服务器；视觉验证使用预览工具与现有打包/运行方式。
- 多条命令使用 `;` 连接（例如：`pnpm -r run typecheck; openspec validate update-example-plugin-overlay-ui-and-demo --strict`）。
- 在实现阶段，保持现有桥接 API 的签名不变；如扩展 SSE 动作转发，务必兼容现有消费者。
 - 观察到：SSE `action: overlay-registered/overlay-unregistered` 事件仅在 Overlay 页面实际打开（例如通过生成的链接或在 OBS 浏览器源中加载）后产生；仅创建 Overlay 而未打开页面不会触发注册事件。
