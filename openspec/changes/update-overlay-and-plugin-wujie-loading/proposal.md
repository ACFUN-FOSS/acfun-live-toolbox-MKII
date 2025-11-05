## Why

当前插件页面与 Overlay 的前端承载方式不完全一致：插件内容页已使用 Wujie 微前端隔离运行，但 Overlay 页面仍以内嵌组件/HTML 渲染为主。为统一技术路径、提升隔离性与可维护性、并满足单页面应用（SPA）在主客户端中的正确路由加载需求，需要：
- 统一在客户端内为“插件页面”和“Overlay 页面”使用 Wujie 进行承载与隔离；
- 当插件为单页面应用时，在 manifest 中显式声明默认加载路由，确保首次挂载与后续导航正确；
- 规范化清单（manifest）字段，让插件开发者以声明式方式配置微前端入口与路由。

## What Changes
 
- 主进程统一加载与 HTTP 静态托管：
  - 所有插件页面（UI/Window/Overlay）均由主进程通过本地 HTTP 服务器托管并返回静态资源，不依赖渲染进程 dev server 或外部 URL。
  - 页面访问路径统一在 `/plugins/:id/...` 作用域下，支持 SPA 回退与多页面直达。

- Manifest（插件清单）入口声明：
  - `ui`: `spa: boolean` + `route: string`（当 `spa=true`）或 `html: string`（当 `spa=false`）。
  - `window`: 同上（`spa/route` 或 `html`）。
  - `overlay`: 同上（`spa/route` 或 `html`）。

- HTTP 路由约定（主进程实现）：
  - UI：`GET /plugins/:id/ui[/*]`（SPA 路由回退）或 `GET /plugins/:id/ui.html`
  - Window：`GET /plugins/:id/window[/*]` 或 `GET /plugins/:id/window.html`
  - Overlay：`GET /plugins/:id/overlay[/*]` 或 `GET /plugins/:id/overlay.html`（`overlayId` 通过 query 传递）
  - 数据接口保持：`GET /api/overlay/:overlayId`（JSON）与 SSE 下行用于动态渲染。

- Wujie（可选微前端隔离）兼容：
  - 若插件选择使用 Wujie 隔离，其前端资源亦需打包到插件静态目录，由主进程托管；manifest 使用 `spa/route` 或 `html` 指示入口，替代直接 `*.wujie.url`。

- 文档与示例：
  - 更新 `docs/plugin-development.md` 展示 SPA/多页面两种写法的清单示例。
  - 更新示例清单：`plugins/example-plugin/manifest.json` 与 `plugins/overlay-test-plugin/manifest.json`。

- 兼容策略：
  - 未声明新字段时，保留现有文本/HTML/组件 Overlay 的兼容渲染能力；但推荐迁移至统一托管以提升一致性与安全边界。

- BREAKING：
  - 迁移旧的 `ui.wujie.url` / `overlay.wujie.url` 至统一托管与入口声明（`spa/route` 或 `html`）。
  - 对于希望以 SPA 载入的页面，要求在 manifest 中显式声明对应 `route`，否则首屏挂载与导航可能不符合预期（默认回退为 `/`）。

## Impact

- 受影响规格（specs）：
  - `openspec/specs/plugin-system/spec.md`：新增“主进程统一加载与 HTTP 静态托管”与 `ui/window/overlay` 的入口声明规范。
  - `openspec/specs/desktop-ui/spec.md`：更新“Plugin frame routing”与“Overlay UI”以反映统一托管与路由约定（保留 OverlayManager 能力）。

- 受影响代码：
  - Main/Server：`packages/main/src/server/ApiServer.ts`（实现 `/plugins/:id/ui|window|overlay/...` 静态托管与 SPA 回退，保留 `/api/overlay/:overlayId`）。
  - PluginManager：`packages/main/src/plugins/PluginManager.ts`（manifest 校验：`spa/route/html` 字段）。
  - Renderer：如仍在客户端内嵌打开页面，需指向统一托管的路由；Overlay 场景在 OBS 中直接使用主进程托管 URL。
  - Docs/Examples：`docs/plugin-development.md`、示例 manifests。

以上为变更提案，后续将在 tasks.md 与 delta specs 中细化实现步骤与验收场景（包括 SPA 与非 SPA 的回归用例）。

## Lifecycle & Activity Hooks（新增）

- 插件生命周期钩子：在既有安装/启用/禁用/卸载/更新/onError/onRecover 的基础上，增加语义别名（`plugin.beforeLoad/afterLoad/beforeStart/afterStart/beforeClose/afterClose`）与页面动作钩子（`beforeUiOpen/afterUiOpen/uiClosed`、`beforeWindowOpen/afterWindowOpen/windowClosed`、`beforeOverlayOpen/afterOverlayOpen/overlayClosed`）。
- 工具箱活动钩子：向插件广播 `auth.login/logout`、`room.add/remove/enter/leave/update`、`live.start/stop`、`danmu.*` 等事件，便于插件响应系统状态与弹幕高频事件。
- 桥接与安全：通过预加载桥暴露 `this.api.events.on/off`，载荷去敏，`danmu.*` 进行节流/批处理，避免 UI 卡顿。
- 典型场景：插件订阅登录与开播事件初始化资源；在 `afterOverlayOpen` 时绑定 Overlay 交互；在 `overlayClosed` 时做清理回收。

## Data Access & Store Injection（新增）

- 两种数据访问方式：
  - 主进程中转调用 `acfunlive-http-api`（受控 API，统一鉴权与错误处理）。

## Bundled Example Plugin（基础示例插件，自带打包与自加载）

- 目标：工具箱自带并默认加载一个具备所有特性的基础示例插件，包含 `ui`/`window`/`overlay` 三类页面，覆盖所有生命周期与页面动作钩子，展示只读数据注入与事件订阅，提供配置设置与跨页面交互示例。
- 位置：源代码位于 `plugins/base-example`，随发行包打入静态资源（如 `resources/plugins/base-example`）。
- 静态托管：由主进程统一托管并暴露 `GET /plugins/:id/ui[/*]`、`/window[/*]`、`/overlay[/*]` 与 `*.html` 入口；`overlayId` 通过 query 传递；OBS/浏览器可直接访问。
- 容器与通信：渲染端 overlay 容器为 Web-only（ESM、无 Node/Electron 全局），通过 Wujie 挂载插件页面；只读 store 快照与事件通过 `props/shared` 注入；Overlay 下行采用 SSE， 上行通过 `POST /api/overlay/:overlayId/message`，插件前端仅关注 Wujie 事件接口。
- 自加载：安装完成后主进程自动加载该示例插件；测试环境亦自动加载，确保开发与 CI 验证一致（不创建测试用例，仅实现环境下的默认启用逻辑）。
- 文档：在 `docs/plugin-development.md` 增加示例插件章节，说明如何查看生命周期调用、数据注入、事件订阅、跨页面消息与 OBS/浏览器打开 Overlay 的方法。
- 文档：示例插件各页面内直接展示自解释说明与引导，无需额外撰写外部文档（UI/Window/Overlay 页面包含特性概览、生命周期调用示例、数据注入与事件订阅说明、跨页面交互演示、在浏览器/OBS 打开的指引）。
  - Wujie 注入渲染端主 window 的只读 store 切片（UI/Window 直接 props 注入；Overlay 通过 SSE 订阅）。
- 只读与性能：采用“快照 + 增量”推送，默认节流 250ms，最多 20 次/秒，关键键优先。
- Overlay 注入：统一通过 `GET /sse/overlay/:overlayId`（单向），不使用 IPC；上行消息使用 `POST /api/overlay/:overlayId/message`。

## Overlay Messaging（新增）

- UI/Window → Overlay：`this.api.overlay.send(overlayId, event, payload)` 主进程路由到 overlay；overlay 通过 `window.overlayApi.on('message', ...)` 或 SSE 事件接收。
- Overlay → UI/Window：`window.overlayApi.action(event, payload)` 由主进程分发；采用 POST 上行通道。
- 安全与可靠性：载荷去敏、令牌校验、断线重连与消息缓冲。

## Browser-Safe Overlay Container（新增）

- 容器页面以浏览器为目标构建（ESM 输出），不包含 Node/Electron 全局与 API。
- 统一桥接：容器使用 Wujie 挂载主进程托管的插件页面；通过 `props/shared` 注入只读 store 快照与事件；SSE 下行增量与消息、POST 上行事件分发。
- 页面参数：通过 `location.search` 读取 `overlayId` 与只读 token（如有），以供容器与插件子应用初始化。
- 开发模型：插件仅面向 Wujie 注入与事件，不关心底层 SSE/POST；保证在 Electron 渲染器与独立浏览器均可运行。