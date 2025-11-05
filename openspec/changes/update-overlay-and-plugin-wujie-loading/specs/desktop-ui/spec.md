## ADDED Requirements

### Requirement: Overlay Wujie Integration
The desktop UI SHALL support rendering overlay pages via Wujie micro-frontend when declared by plugin manifest, while preserving existing overlay behaviors.

#### Scenario: Overlay route loads via Wujie
- **WHEN** user navigates to `/overlay/:overlayId` for an overlay whose plugin manifest declares `overlay.wujie.url`
- **THEN** the overlay is rendered in a Wujie container using the declared URL
- **AND** the overlay operates in an isolated environment with controlled API access
- **AND** OverlayManager manages visibility, z-index, layering, and animations as before

#### Scenario: SPA route initialization for overlay
- **WHEN** `overlay.wujie.spa` is true
- **THEN** the overlay container initializes the child app at `overlay.wujie.route`
- **AND** if `overlay.wujie.route` is missing, the initial route defaults to `/`

#### Scenario: Overlay fallback without Wujie
- **WHEN** the manifest does not declare `overlay.wujie.*`
- **THEN** overlay content renders via existing text/HTML/component modes
- **AND** all overlay behaviors (modal/blocking, click-through, closability) remain functional

### Requirement: SPA Route Declaration for Plugin UI
The desktop UI SHALL respect SPA route declarations from the plugin manifest for plugin UI rendering via Wujie.

#### Scenario: Plugin UI SPA initial route
- **WHEN** the plugin manifest sets `ui.wujie.spa: true` and provides `ui.wujie.route`
- **THEN** `PluginFramePage`/`CentralPluginContainer` initializes the Wujie child app at the declared route
- **AND** navigation within the child app does not affect main application routing

#### Scenario: Default route when unset
- **WHEN** `ui.wujie.spa` is true but `ui.wujie.route` is not provided
- **THEN** the initial child app route defaults to `/`
- **AND** plugin UI continues to operate with isolated DOM/JS context

### Requirement: 活动钩子桥接（Renderer/Preload）
The desktop UI and preload bridge SHALL forward toolbox activity hooks and page action hooks to plugins via a secure event bus.

- Toolbox activity events: `auth.login/logout`, `room.add/remove/enter/leave/update`, `live.start/stop`, `danmu.*`.
- Page action events: `beforeUiOpen/afterUiOpen/uiClosed`, `beforeWindowOpen/afterWindowOpen/windowClosed`, `beforeOverlayOpen/afterOverlayOpen/overlayClosed`.
- Event interface:
  - Expose via `this.api.events.on/off` with sanitized payloads (no secrets).
  - Apply throttling/batching to high-frequency events (e.g., `danmu.*`).

#### Scenario: Overlay open events bridging
- **WHEN** a plugin triggers opening an overlay from the UI
- **THEN** the preload bridge emits `beforeOverlayOpen` followed by `afterOverlayOpen` to subscribers
- **AND** when the overlay closes, it emits `overlayClosed` including `overlayId`

### Requirement: Store 同步到 Wujie 子应用（只读）
The desktop UI SHALL synchronize selected store slices to Wujie child apps (UI/Window) as read-only data, and provide HTTP/SSE channels for Overlay pages.

- UI/Window 注入：通过 Wujie `props/shared` 注入 `readonlyStore`（冻结或代理只读）。
- Overlay 注入：无法使用 IPC，采用 `GET /sse/overlay/:overlayId`（单向）接收只读 store 更新与下行消息。
- 性能策略：合并与节流（默认 250ms），仅推送变更键值。
- 安全策略：只读、去敏载荷、不含凭据，必要时使用短期只读 token。

#### Scenario: 高频 store 更新的节流
- **WHEN** `live.status` 或 `danmu.stats` 高频变更
- **THEN** 注入机制在节流窗口内合并更新并向子应用推送一次；
- **AND** Overlay 通过 SSE 接收更新且不会造成 UI 卡顿。

### Requirement: Overlay 容器的浏览器兼容（Renderer Page, Browser-Safe）
The overlay container page in the renderer MUST be browser-safe so that it can be opened in a standalone browser without Node/Electron globals.

- 禁止使用：`require`、`module.exports`、`process`、`__dirname`、`path`、Electron 专有 API。
- 构建目标：浏览器（ESM 输出），无 Node polyfills；仅依赖标准 Web API（`fetch`、`EventSource`、`URLSearchParams`、`localStorage`）。
- 初始化参数：支持从 `location.search` 读取 `overlayId` 与只读 token（若存在），并将其注入到 Wujie 子应用的 `props`。
- 事件桥：在 overlay 容器中暴露 `window.overlayApi`（web-only）：
  - `on(event, handler)` / `off(event, handlerId)`：订阅/取消订阅来自主进程下行的消息（经 SSE 转发）。
  - `action(event, payload)`：通过 `POST /api/overlay/:overlayId/message` 上行消息至主进程，由主进程分发至插件 UI/Window。
  - `getParams()`：返回 `{ overlayId, token? }`。
- Wujie 挂载：overlay 容器通过 Wujie 挂载主进程托管的插件页面（HTML 或 SPA），并以 `props/shared` 注入只读 store 快照与事件桥；后续增量更新与消息通过 SSE 下行、POST 上行。

#### Scenario: 在独立浏览器打开 Overlay 容器
- **WHEN** 用户在外部浏览器访问 `http://127.0.0.1:<port>/overlay/:overlayId` 或对应静态托管入口
- **THEN** 页面不依赖 Node/Electron，全功能运行：Wujie 子应用加载、只读 store 注入、SSE 接收更新、POST 上行消息。