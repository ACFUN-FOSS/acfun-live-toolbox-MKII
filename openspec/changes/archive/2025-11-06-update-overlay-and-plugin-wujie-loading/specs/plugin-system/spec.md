## ADDED Requirements

### Requirement: Wujie UI Manifest Fields
The plugin manifest SHALL declare Wujie micro-frontend entry for plugin UI with optional SPA routing support.

#### Scenario: Plugin UI Wujie entry declared
- **WHEN** a plugin manifest includes `ui.wujie.url` (string) and optionally `ui.wujie.spa` (boolean) and `ui.wujie.route` (string)
- **THEN** the plugin manager reads and validates these fields
- **AND** the renderer loads the plugin UI via Wujie using `ui.wujie.url`
- **AND** if `ui.wujie.spa` is true, the renderer applies `ui.wujie.route` as the initial internal route (default `/` when unset)
- **AND** the plugin UI runs in an isolated environment with controlled API access

#### Scenario: Fallback when no Wujie fields
- **WHEN** the manifest does not include `ui.wujie.*`
- **THEN** plugin UI falls back to current supported rendering paths
- **AND** existing behavior remains unchanged

### Requirement: Wujie Overlay Manifest Fields
The plugin manifest SHALL declare Wujie micro-frontend entry for overlays with optional SPA routing support.

#### Scenario: Overlay Wujie entry declared
- **WHEN** a plugin manifest includes `overlay.wujie.url` (string) and optionally `overlay.wujie.spa` (boolean) and `overlay.wujie.route` (string)
- **THEN** the plugin manager exposes these fields to the renderer overlay system
- **AND** overlay pages for the plugin load via a Wujie container using `overlay.wujie.url`
- **AND** if `overlay.wujie.spa` is true, the renderer applies `overlay.wujie.route` as the initial internal route (default `/` when unset)
- **AND** overlay content preserves isolation and controlled API access

#### Scenario: Overlay fallback
- **WHEN** the manifest does not include `overlay.wujie.*`
- **THEN** overlay rendering uses existing text/HTML/component modes
- **AND** OverlayManager capabilities (z-index, visibility, animations) remain available

### Requirement: 主进程统一加载并提供 HTTP 静态托管（新增/替换）
为插件的三类页面统一由主进程加载并通过本地 HTTP 服务器托管静态资源。三类页面：
- 客户端嵌入的插件页面（UI）
- 弹出新主进程 window 的插件页面（Window）
- Overlay 插件页面（Overlay）

统一原则：
- 所有插件前端页面均通过主进程的 HTTP 服务器提供（如 `http://127.0.0.1:<port>/plugins/:id/...`），不再依赖渲染端 dev 服务器或外部 URL。
- 插件 manifest 需要为每一类页面声明“单页面应用（SPA）路由或多页面 HTML 文件”的入口信息。
- 当声明为 SPA 时，主进程静态托管目录下采用路由回退策略（history/SPA fallback），并按 manifest 提供的 `route` 进入。
- 当声明为多页面 HTML 时，主进程直接返回指定 HTML 文件。

Manifest 字段规范：
- `ui`: 客户端嵌入的插件页面
  - `spa: boolean`（是否为单页面应用）
  - `route: string`（当 `spa=true` 时必须；示例：`"/"` 或 `"/dashboard"`）
  - `html: string`（当 `spa=false` 时必须；示例：`"ui.html"`，相对插件根目录）
- `window`: 弹出新主进程 window 的插件页面
  - `spa: boolean`
  - `route: string`（`spa=true` 必填）
  - `html: string`（`spa=false` 必填）
- `overlay`: Overlay 插件页面
  - `spa: boolean`
  - `route: string`（`spa=true` 必填；建议最终访问形如 `GET /plugins/:id/overlay[/*]`，由页面内部通过 query `?overlayId=...` 或初始化参数读取 `overlayId`）
  - `html: string`（`spa=false` 必填；用于直接返回 overlay 页面 HTML）

HTTP 路由约定（由主进程实现）：
- UI：`GET /plugins/:id/ui[/*]`（SPA 路由回退）或 `GET /plugins/:id/ui.html`
- Window：`GET /plugins/:id/window[/*]` 或 `GET /plugins/:id/window.html`
 - Overlay：`GET /plugins/:id/overlay[/*]` 或 `GET /plugins/:id/overlay.html`（`overlayId` 通过 query 传递）
 - 数据接口保持：`GET /api/overlay/:overlayId` 返回 JSON 数据与 SSE 下行端点，用于 Overlay 页面内加载动态内容。

兼容与替换说明：
- 现有 `ui.wujie.url` / `overlay.wujie.url` 字段使用外部 URL 的做法，迁移为由主进程静态托管与路由声明（SPA 的 `route` 或多页面的 `html`）。
- 若仍需微前端隔离（Wujie），其资源也应打包到插件静态目录，由主进程托管；manifest 用 `spa/route` 或 `html` 来指示入口，替代直接 URL。
- 未声明新字段时，保留现有文本/HTML/组件的 Overlay 兼容渲染能力，但推荐迁移以统一加载路径与安全边界。

示例（单页面应用 + 多页面混合）：
```json
{
  "id": "overlay-test-plugin",
  "ui": { "spa": true, "route": "/" },
  "window": { "spa": false, "html": "window.html" },
  "overlay": { "spa": true, "route": "/" }
}
```

## ADDED Requirements

### Requirement: 插件生命周期钩子（Plugin Lifecycle Hooks）
插件系统 SHALL 支持插件级生命周期钩子，以事件方式让插件与系统在关键阶段进行交互与清理。除既有钩子外，增加与“打开页面”相关的钩子。

- 既有钩子（对齐主进程实现）：
  - `beforeInstall` / `afterInstall`
  - `beforeEnable` / `afterEnable`
  - `beforeDisable` / `afterDisable`
  - `beforeUninstall` / `afterUninstall`
  - `beforeUpdate` / `afterUpdate`
  - `onError` / `onRecover`

- 新增别名钩子（语义别名，便于插件开发者理解）：
  - `plugin.beforeLoad` ≈ `beforeInstall`
  - `plugin.afterLoad` ≈ `afterInstall`
  - `plugin.beforeStart` ≈ `beforeEnable`
  - `plugin.afterStart` ≈ `afterEnable`
  - `plugin.beforeClose` ≈ `beforeDisable`
  - `plugin.afterClose` ≈ `afterDisable`

- 页面动作钩子（统一对 UI / Window / Overlay 三类页面）：
  - `beforeUiOpen` / `afterUiOpen` / `uiClosed`
  - `beforeWindowOpen` / `afterWindowOpen` / `windowClosed`
  - `beforeOverlayOpen` / `afterOverlayOpen` / `overlayClosed`

钩子数据（最小要求）：
- 通用字段：`{ pluginId: string, manifest?: object, error?: Error, context?: Record<string, any>, timestamp: number }`
- 页面相关：`context` 包含 `{ pageType: 'ui'|'window'|'overlay', overlayId?: string, route?: string, html?: string }`

行为规范：
- 钩子注册通过插件 API（示例：`this.api.lifecycle.on(hookName, handler, { priority })`）或事件总线（`this.api.events.on(...)`）提供；
- 钩子执行顺序按优先级从高到低；任何钩子抛错不会阻塞系统，错误将通过 `onError` 事件与日志记录；
- 钩子处理器支持异步；禁止长时间阻塞主线程；
- 当页面由主进程统一托管时，`before*Open` 在路由解析前触发，`after*Open` 在页面已成功可见后触发，`*Closed` 在关闭动作完成后触发。

#### Scenario: 插件启动时触发钩子
- **WHEN** 插件被启用
- **THEN** 触发 `beforeEnable` → 业务处理 → `afterEnable`，并同步触发别名 `plugin.beforeStart` / `plugin.afterStart`

#### Scenario: 打开 Overlay 触发钩子
- **WHEN** 插件调用 `this.api.overlay.create(...)`
- **THEN** 在创建流程前触发 `beforeOverlayOpen`；
- **AND** Overlay 成功创建并可见后触发 `afterOverlayOpen`；
- **AND** 当 Overlay 关闭时触发 `overlayClosed`（包含 `overlayId`）。

### Requirement: 工具箱活动钩子（Toolbox Activity Hooks）
工具箱 SHALL 向插件广播关键活动事件，以便插件可订阅系统状态变化并执行相应逻辑。

- 认证相关：
  - `auth.login`（载荷建议：`{ userId, profile }`）
  - `auth.logout`

- 直播间与房间：
  - `room.add` / `room.remove`（载荷建议：`{ roomId, platform, meta? }`）
  - `room.enter` / `room.leave` / `room.update`（与现有文档事件对齐）

- 直播状态：
  - `live.start` / `live.stop`（载荷建议：`{ roomId, startedAt?, stoppedAt?, streamInfo? }`）

- 弹幕（Danmu）：
  - `danmu.comment`（`{ content, userInfo, timestamp, rawData }`）
  - `danmu.gift`（`{ giftName, count, value, userInfo, timestamp, rawData }`）
  - `danmu.like`（`{ count, userInfo, timestamp, rawData }`）
  - 可保留 `danmu.raw` 以便插件自行解析。

事件订阅接口：
- 通过 `this.api.events.on(eventName, handler)` 订阅；`this.api.events.off(eventName, handlerId?)` 取消订阅；
- 事件分发必须在主进程与预加载桥中保持安全边界，载荷不应包含敏感凭据；
- Danmu 事件应确保高吞吐且不会阻塞 UI；建议在插件侧做节流/批处理。

#### Scenario: 插件订阅登录与直播事件
- **WHEN** 用户登录
- **THEN** 触发 `auth.login`；插件可据此初始化资源或拉取配置。
- **WHEN** 开始直播
- **THEN** 触发 `live.start`；插件可据此开启统计、弹幕分析或 Overlay 呈现。

### Requirement: 数据访问与渲染端 Store 注入（Plugin Data Access & Store Injection）
插件系统 SHALL 提供两种数据访问路径：主进程受控 API 代理与渲染端只读 Store 注入，并保证 Overlay 通过 HTTP 通道（SSE 下行、POST 上行）进行数据同步与消息桥接。

#### Scenario: 只读 Store 注入到 Wujie 子应用（UI/Window）
- **WHEN** 插件 UI 或 Window 以 Wujie 子应用方式挂载
- **THEN** 渲染端通过 `props/shared` 注入只读的公共 store 快照（冻结或只读代理）
- **AND** 后续增量更新以节流/合并策略推送到子应用事件总线（保持只读语义，不允许写入）

#### Scenario: Overlay 通过 SSE 下行与 POST 上行进行同步
- **WHEN** Overlay 容器根据 query 中的 `overlayId` 初始化
- **THEN** 容器使用 SSE `GET /sse/overlay/:overlayId` 接收只读 store 增量与下行消息
- **AND** Overlay 向主进程发送上行消息采用 `POST /api/overlay/:overlayId/message`，由主进程分发到插件 UI/Window（插件侧仅消费 Wujie 事件接口，不直接操作 SSE/POST）
插件访问数据 SHALL 提供两种方式，并对 Overlay 的跨进程/跨应用场景给出统一通道：

- 方式 A：主进程中转调用 `acfunlive-http-api`
  - 插件通过受控 API（示例：`this.api.acfun.*` 或 `this.api.http.*`）请求业务数据，主进程代理实际请求并处理鉴权、限流与错误。
  - 保持声明文件与依赖已安装，不要求插件直接引入 `acfunlive-http-api`。

- 方式 B：Wujie 注入（渲染端主 window 的 store 数据）
  - 对 `ui/window/overlay` 的 Wujie 子应用注入只读的公共 store 切片（例如：`user/profile`、`room/details`、`live/status`）。
  - 注入方式：
    - UI/Window：通过 Wujie `props` 或共享上下文注入 `readonlyStore`（只读，不允许修改）。
    - Overlay（浏览器来源）：无法使用 IPC，需通过 HTTP 实时通道接收 store 更新（采用 SSE 单向下行）。
  - 性能与一致性：
    - 采用“快照 + 增量”策略：首次注入全量快照，后续仅推送变更键值。
    - 节流/合并更新：默认节流窗口 250ms（可配置），每秒最多 20 次更新，关键状态优先级更高（如 `live/status`）。
    - 只读保证：注入对象在子应用内被冻结（`Object.freeze`）或通过代理只读，禁止写入。

- Overlay 跨进程数据通道（统一方案）：
  - SSE：`GET /sse/overlay/:overlayId` 用于单向下行推送（只读 store 更新与下行消息）。
  - 上行消息：overlay 向主进程发送消息使用 `POST /api/overlay/:overlayId/message`，主进程再分发至插件 UI/Window。
  - CORS：保持 `origin: true` 与 `credentials: true`，对消息与更新通道进行令牌校验（建议在 overlay URL 中携带只读 token）。

### Requirement: 页面间消息通道（UI/Window → Overlay）
插件系统 SHALL 提供 UI/Window 与 Overlay 之间的消息通道，统一通过 Wujie 事件总线与主进程桥接（SSE 下行、POST 上行），确保页面间通信一致与可靠。

#### Scenario: UI/Window 发送消息到 Overlay
- **WHEN** 插件 UI/Window 调用 `this.api.overlay.send(overlayId, event, payload)`
- **THEN** 主进程接收并分发到对应 Overlay 容器
- **AND** Overlay 通过 `window.overlayApi.on('message', ...)` 接收消息并转发到其 Wujie 子应用事件总线
插件需支持从 `window/ui` 向 `overlay` 发送消息的能力，统一通过主进程 HTTP/SSE 通道路由：
- API 约定：`this.api.overlay.send(overlayId, event, payload)` 在主进程转发；overlay 通过 `window.overlayApi.on('message', handler)` 或 SSE 事件接收。
- Overlay → 插件：overlay 可通过 `window.overlayApi.action(event, payload)` 或 POST 上行消息；主进程再分发至插件 UI/Window。
- 可靠性：消息通道需支持重连与缓冲（在 SSE 断流时以队列暂存，恢复后批量发送）。

#### Scenario: UI 向 Overlay 发送消息
- **WHEN** 插件 UI 调用 `this.api.overlay.send(overlayId, 'update-config', { a: 1 })`
- **THEN** 主进程通过 WS/HTTP 将消息路由到目标 overlay 页面；
- **AND** overlay 在 `window.overlayApi.on('message', ...)` 中收到事件并应用只读 store 与传入配置渲染。

### Requirement: Overlay 容器（渲染进程）浏览器兼容与 Wujie 挂载
Overlay 容器 SHALL 在 Electron 渲染进程与独立浏览器中兼容运行，仅使用 Web API（无 Node/Electron 全局），并通过 Wujie 挂载主进程托管的插件页面，参数从 `location.search` 读取。

#### Scenario: 在独立浏览器打开 Overlay 容器并完成挂载
- **WHEN** 用户在外部浏览器访问 `http://127.0.0.1:<port>/overlay/:overlayId` 或统一静态托管入口（`GET /plugins/:id/overlay[/*]`，`overlayId` 通过 query）
- **THEN** 页面不依赖 Node/Electron，全功能运行：Wujie 子应用加载、只读 store 注入、SSE 接收增量更新、POST 上行消息
- **AND** 插件前端仅使用 Wujie 注入的只读数据与事件接口，忽略底层 SSE/POST 细节；容器负责桥接与可靠性（自动重连、缓冲与节流）
Overlay 页面在渲染进程中实现为一个通用的“容器页面”，需在 Electron 渲染器和独立浏览器均可运行，并通过 Wujie 挂载主进程托管的插件页面。

- 浏览器兼容：容器页面不得使用 Node/Electron 特有 API（如 `require`、`process`、`__dirname`）。
- 参数获取：从 `location.search` 中读取 `overlayId` 与只读 token（若有）；通过 Wujie `props/shared` 注入给插件子应用。
- 事件与数据桥接：
  - 下行（主进程 → Overlay 容器 → 插件）：SSE `GET /sse/overlay/:overlayId` 接收只读 store 增量与消息，转发到 Wujie 子应用（`props`/事件总线）。
  - 上行（Overlay 容器/插件 → 主进程）：`POST /api/overlay/:overlayId/message`；主进程分发到对应 UI/Window。
- 开发约定：插件前端仅关注 Wujie 注入的只读数据与事件接口，忽略底层 SSE/POST 细节；容器负责统一桥接。
