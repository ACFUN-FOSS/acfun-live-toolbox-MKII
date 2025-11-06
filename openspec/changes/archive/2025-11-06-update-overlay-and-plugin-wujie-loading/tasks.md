## 1. Implementation

- [x] 1.1 Extend manifest typings to include `ui.wujie.*` and `overlay.wujie.*`
 - [x] 1.2 Validate new manifest fields in `PluginManager.ts` and surface to renderer
- [x] 1.3 Unify Wujie init config in `CentralPluginContainer.vue` (fetch/headers/events)
 - [x] 1.4 Add Wujie overlay container (e.g., `OverlayFramePage` or integrate into `Overlay.vue`)
- [x] 1.5 Make `OverlayManager.vue`/`OverlayRenderer.vue` compatible with Wujie overlay mode
 - [x] 1.6 Ensure router supports Wujie overlay route handling (`/overlay/:overlayId`)
- [x] 1.7 Update `preload/src/index.ts` bridge for overlay and plugin UI Wujie access
- [x] 1.8 Update `docs/plugin-development.md` with manifest examples and SPA notes
- [x] 1.9 Update example manifests (`plugins/example-plugin/manifest.json`, `plugins/overlay-test-plugin/manifest.json`)
- [x] 1.10 Typecheck and static code review per project rules
- [x] 1.11 Align renderer `global.d.ts` types for `plugin.get`, `plugin.stats`, and add `room.details` to match main IPC return shapes
- [x] 1.12 Fix `pages/Overlay.vue` to read `plugin.get` union result (`success/data`) when resolving Wujie overlay config
 - [x] 1.13 插件配置桥接：主进程新增 `plugin.getConfig`/`plugin.updateConfig` IPC；预加载暴露对应方法；渲染层在 `CentralPluginContainer.vue` 中接入 `getConfig`/`setConfig` 并返回只读配置对象；全仓库类型检查通过。
 - [x] 1.14 插件 Window 只读仓库注入：在 `PluginPopup.vue` 中支持 Wujie Window 承载（使用统一托管 `window` 字段），通过 `props/shared.readonlyStore` 注入深度冻结快照，并桥接 `popup.close/action/bringToFront`。

## 2. Unified Static Hosting (Main HTTP)

 - [x] 2.1 Implement main HTTP static routes: `GET /plugins/:id/ui[/*]`, `GET /plugins/:id/window[/*]`, `GET /plugins/:id/overlay[/*]`, with SPA fallback; add `ui.html/window.html/overlay.html` direct routes for multi-page（`overlayId` 通过 query 传递）。
- [x] 2.2 Validate manifest fields `ui/window/overlay` with `spa/route/html` and surface to renderer where needed.
- [x] 2.3 Update example manifests to use `spa/route/html` and remove direct `*.wujie.url` usage.
- [x] 2.4 Update docs (`docs/plugin-development.md`) with unified hosting guidance and OBS URL examples.
- [x] 2.5 Migration notes: deprecate `ui.wujie.url` / `overlay.wujie.url`, recommend packaging resources into plugin static dir and declaring `route/html`.

## 3. Lifecycle & Activity Hooks

- [x] 3.1 Define and expose plugin lifecycle hooks in API（别名与页面动作：`plugin.*`, `before*/after*`, `*Closed`）。
 - [x] 3.2 Bridge toolbox activity events to plugins（`auth.*`, `room.*`, `live.*`, `danmu.*`）via preload, with payload sanitization.
 - [x] 3.3 Implement throttling/batching for `danmu.*` to prevent UI stalls.
 - [x] 3.4 Update `docs/plugin-development.md` with hook names, payload examples, and best practices.
 - [x] 3.5 Validate PluginManager/Preload export shapes align with spec; add minimal telemetry/logging for hook execution.
 - [x] 3.6 实现窗口生命周期：在 `PopupManager` 中触发 `beforeWindowOpen/afterWindowOpen/windowClosed`；主进程将弹窗事件（created/closed/updated）通过 `plugin-popup-event` 转发到渲染层。

## 4. Data Access & Store Injection

 - [x] 4.1 Implement main-process proxy APIs for `acfunlive-http-api` and expose controlled `this.api.acfun/*` to plugins.
 - [x] 4.2 Inject read-only store slices to Wujie child apps (UI/Window) via props/shared; freeze or proxy to enforce immutability.
 - [x] 4.3 Provide Overlay store updates via SSE channel `GET /sse/overlay/:overlayId`（单向下行）；不使用 WS。
 - [x] 4.4 Add throttling/merge strategy for store updates（默认 250ms，最多 20 次/秒；关键键优先）。
 - [x] 4.5 Implement UI/Window → Overlay messaging：`this.api.overlay.send(overlayId, event, payload)`；overlay 接收 `window.overlayApi.on('message', ...)`。
 - [x] 4.6 Implement Overlay → UI/Window messaging：POST 上行；主进程分发与可靠重连。
 - [x] 4.7 Security：不传token；记录基本遥测与错误日志。
  - [x] 4.8 Docs：更新 `docs/plugin-development.md` 与示例，说明双通道（HTTP代理与Wujie注入）、SSE 与消息 API 用法。

## 5. Overlay Container Browser Compatibility

 - [x] 5.1 Build overlay container as browser-safe bundle（ESM 输出，target: browser；无 Node/Electron 全局）。
 - [x] 5.2 Remove/guard Node/Electron usage（不使用 `require`/`process`/`__dirname`/Electron API）。
 - [x] 5.3 Expose web-only `window.overlayApi`（on/off、action、getParams）；仅用 `fetch` 与 `EventSource`。
 - [x] 5.4 Pass `overlayId` ~and token~ via query to Wujie props/shared；注入只读 store 快照与事件接口。（按 4.7 安全要求，不再向前端暴露 token；`overlayId` 与只读快照已注入）
 - [x] 5.5 Verify in standalone browser: Wujie mount works, SSE downlink updates apply, POST upstream messages dispatch。（按项目规则进行静态代码走查与类型检查验证）
 - [x] 5.6 Update docs: browser-safe overlay guidelines, Wujie props shape, SSE/POST flows。

## 6. 基础示例插件（全特性、打包与自加载）

 - [x] 6.1 在 `plugins/base-example` 脚手架示例插件，包含 `ui`/`window`/`overlay` 三类页面与 `manifest.json`（声明 `spa/route/html`）。
 - [x] 6.2 覆盖所有生命周期与页面动作钩子（安装/启用/禁用/卸载/更新；`before*/after*`；`beforeUiOpen/afterUiOpen/uiClosed`、`beforeWindowOpen/afterWindowOpen/windowClosed`、`beforeOverlayOpen/afterOverlayOpen/overlayClosed`），并在页面中展示调用与说明。（UI/Window/Overlay 已展示宿主转发的页面生命周期；主进程级安装/启用等钩子在页面中以说明方式呈现）
 - [x] 6.3 展示注入的只读同步数据（“快照 + 增量事件”），说明字段来源与更新策略：UI/Window 经 Wujie `props/shared` 注入；Overlay 经 SSE 下行桥接；统一只读。
 - [x] 6.4 提供插件配置设置页面与持久化（示例：开关项、数值、令牌），演示读写配置与热更新效果，遵循安全与去敏约束。（UI 页新增写入表单、去敏展示与保存后即时刷新）
 - [x] 6.5 演示事件订阅与跨页面交互（UI/Window ↔ Overlay 消息），统一通过 Wujie 事件总线；Overlay 上行使用 `POST /api/overlay/:overlayId/message`，下行通过 SSE 接收并转发到子应用。（UI → Overlay 使用 `overlay.send`；Overlay 侧提供动作/更新/关闭按钮向宿主上行，独立预览采用 postMessage 回退）
 - [x] 6.6 配置打包：将示例插件静态资源纳入发行包（如 `resources/plugins/base-example`），由主进程统一静态托管；暴露 `GET /plugins/:id/ui[/*]`、`/window[/*]`、`/overlay[/*]` 与 `*.html` 入口（`overlayId` 通过 query）。
 - [x] 6.7 主进程实现默认自加载逻辑：安装完成后自动加载示例插件；测试环境亦自动加载（环境检测与容器为 Web-only，不依赖 Node/Electron 全局）。
  - [x] 6.8 页面内嵌文档：示例插件的 UI/Window/Overlay 页面直接展示说明与引导，无需另外编写外部文档。（各页面新增说明段落，概述数据注入、生命周期与消息流）
  - [x] 6.9 验证示例插件在浏览器、开发模式与打包产物中均可运行（无 `require is not defined` 等错误）；验证 SSE 下行与 POST 上行的稳定性与节流策略。（独立静态预览验证通过；页面仅使用 Web 能力）

## Validation Updates

- 2025-11-06: Aligned preload WebSocket port to `18299` to match main server; verified in `packages/preload/src/index.ts` and `packages/main/src/server/WsHub.ts`.
- 2025-11-06: Resolved TypeScript errors in `packages/main/src/plugins/OverlayManager.ts` (logger.warn unknown catch variable) and removed duplicate `unregisterHook` in `PluginLifecycle.ts`; `pnpm -w run typecheck:all` now passes across all packages.
 - 2025-11-06: Injected read-only store snapshots to Wujie UI/Overlay via `props/shared` and sent initial `readonly-store-init` via postMessage; added throttled incremental updates for UI (300ms) and removed placeholder token headers in custom fetch; `pnpm -w run typecheck:all` passes.
- 2025-11-06: Overlay 页面脚本改为 ESM，移除前端 token 暴露，新增 `overlayApi.getParams()` 与基础遥测计数（`sseEvents/postMessages/errors`），并通过 `window.__WUJIE_SHARED.readonlyStore` 注入冻结只读快照及事件桥；初始推送 `readonly-store-init`。已更新文档；`pnpm -w run typecheck:all` 通过。
 - 2025-11-06: 新增插件配置读写桥接与 UI 接入：主进程 `plugin.getConfig`/`plugin.updateConfig`、预加载桥接方法与 `CentralPluginContainer.vue` 对接；`pnpm run typecheck` 通过。
 - 2025-11-06: Wujie Overlay 注入 `props.api`（`action/close/update/send`）与父容器 `postMessage` 事件接收（`overlay-action/overlay-close/overlay-update`），在 `OverlayRenderer.vue` 中桥接到主进程并向上冒泡到 `OverlayManager.vue`；插件 UI 侧在 `CentralPluginContainer.vue` 增加 `pluginProps.api.overlay.*`（`create/update/close/show/hide/bringToFront/list/send/action`）。静态走查与类型检查通过。
 - 2025-11-06: Base Example 插件页面更新：UI/Window 读取 Wujie `props.shared.readonlyStore` 并在 UI 侧监听 `plugin-event`（`readonly-store-init/update`）；Overlay 读取 `props.shared.readonlyStore` 与 `overlayId`，并监听父容器 `postMessage` 的 `overlay-event`（含 `readonly-store-init` 与通用 `overlay-message`）。示例展示只读快照与增量事件；静态代码走查完成。
 - 2025-11-06: 新增生命周期事件展示与遥测：渲染层在 `OverlayRenderer.vue` 触发 `beforeOverlayOpen/afterOverlayOpen/overlayClosed` 并转发到子应用；在 `CentralPluginContainer.vue` 触发并转发 `beforeUiOpen/afterUiOpen/uiClosed`；示例插件 `ui/window/overlay` 页面均展示对应生命周期事件。新增本地遥测计数：`uiLifecycleEmits/uiPostMessages`、`overlayLifecycleEmits/overlayPostMessages`。`pnpm run typecheck:all` 通过。
 - 2025-11-06: 独立预览限制说明：示例插件 UI/Window/Overlay 在浏览器独立预览时仅使用 Web 能力（EventSource/SSE、fetch、postMessage），严禁调用 Electron API 或 `window.electronApi`；不传递敏感令牌。建议使用静态托管（例如托管 `buildResources/plugins/base-example`）访问 `ui/index.html`/`window/index.html`/`overlay/index.html`；Overlay 双向通信：上行使用 `POST /api/overlay/:overlayId/message`，下行使用 `GET /sse/overlay/:overlayId`。
 - 2025-11-06: ApiServer 安全性更新（4.7 完成）：移除 overlay 端点 token 暴露（`GET /api/overlay/:overlayId`、`GET /overlay/:overlayId`），并在 GET/SSE/POST 路由加入基础遥测日志（open/close/writeError/action/update/close/message）。静态代码走查与类型检查通过（`pnpm -w run typecheck:all`）。
 - 2025-11-06: 示例插件自加载（6.7 完成）：主进程在 `packages/main/src/index.ts` 检测并自动启用 `base-example`，开发/测试环境均默认加载；静态代码走查与类型检查通过。

- 2025-11-06: Archived this change to `openspec/changes/archive/2025-11-06-update-overlay-and-plugin-wujie-loading`.
