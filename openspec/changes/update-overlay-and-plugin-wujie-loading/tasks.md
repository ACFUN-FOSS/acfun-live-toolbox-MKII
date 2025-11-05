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

## 2. Unified Static Hosting (Main HTTP)

 - [x] 2.1 Implement main HTTP static routes: `GET /plugins/:id/ui[/*]`, `GET /plugins/:id/window[/*]`, `GET /plugins/:id/overlay[/*]`, with SPA fallback; add `ui.html/window.html/overlay.html` direct routes for multi-page（`overlayId` 通过 query 传递）。
- [ ] 2.2 Validate manifest fields `ui/window/overlay` with `spa/route/html` and surface to renderer where needed.
- [ ] 2.3 Update example manifests to use `spa/route/html` and remove direct `*.wujie.url` usage.
- [ ] 2.4 Update docs (`docs/plugin-development.md`) with unified hosting guidance and OBS URL examples.
- [ ] 2.5 Migration notes: deprecate `ui.wujie.url` / `overlay.wujie.url`, recommend packaging resources into plugin static dir and declaring `route/html`.

## 3. Lifecycle & Activity Hooks

- [ ] 3.1 Define and expose plugin lifecycle hooks in API（别名与页面动作：`plugin.*`, `before*/after*`, `*Closed`）。
- [ ] 3.2 Bridge toolbox activity events to plugins（`auth.*`, `room.*`, `live.*`, `danmu.*`）via preload, with payload sanitization.
- [ ] 3.3 Implement throttling/batching for `danmu.*` to prevent UI stalls.
- [ ] 3.4 Update `docs/plugin-development.md` with hook names, payload examples, and best practices.
- [ ] 3.5 Validate PluginManager/Preload export shapes align with spec; add minimal telemetry/logging for hook execution.

## 4. Data Access & Store Injection

- [ ] 4.1 Implement main-process proxy APIs for `acfunlive-http-api` and expose controlled `this.api.acfun/*` to plugins.
- [ ] 4.2 Inject read-only store slices to Wujie child apps (UI/Window) via props/shared; freeze or proxy to enforce immutability.
 - [ ] 4.3 Provide Overlay store updates via SSE channel `GET /sse/overlay/:overlayId`（单向下行）；不使用 WS。
- [ ] 4.4 Add throttling/merge strategy for store updates（默认 250ms，最多 20 次/秒；关键键优先）。
- [ ] 4.5 Implement UI/Window → Overlay messaging：`this.api.overlay.send(overlayId, event, payload)`；overlay 接收 `window.overlayApi.on('message', ...)`。
 - [ ] 4.6 Implement Overlay → UI/Window messaging：POST 上行；主进程分发与可靠重连。
- [ ] 4.7 Security：不传token；记录基本遥测与错误日志。
 - [ ] 4.8 Docs：更新 `docs/plugin-development.md` 与示例，说明双通道（HTTP代理与Wujie注入）、SSE 与消息 API 用法。

## 5. Overlay Container Browser Compatibility

- [ ] 5.1 Build overlay container as browser-safe bundle（ESM 输出，target: browser；无 Node/Electron 全局）。
- [ ] 5.2 Remove/guard Node/Electron usage（不使用 `require`/`process`/`__dirname`/Electron API）。
- [ ] 5.3 Expose web-only `window.overlayApi`（on/off、action、getParams）；仅用 `fetch` 与 `EventSource`。
- [ ] 5.4 Pass `overlayId` and token via query to Wujie props/shared；注入只读 store 快照与事件接口。
- [ ] 5.5 Verify in standalone browser: Wujie mount works, SSE downlink updates apply, POST upstream messages dispatch.
- [ ] 5.6 Update docs: browser-safe overlay guidelines, Wujie props shape, SSE/POST flows.

## 6. 基础示例插件（全特性、打包与自加载）

- [ ] 6.1 在 `plugins/base-example` 脚手架示例插件，包含 `ui`/`window`/`overlay` 三类页面与 `manifest.json`（声明 `spa/route/html`）。
- [ ] 6.2 覆盖所有生命周期与页面动作钩子（安装/启用/禁用/卸载/更新；`before*/after*`；`beforeUiOpen/afterUiOpen/uiClosed`、`beforeWindowOpen/afterWindowOpen/windowClosed`、`beforeOverlayOpen/afterOverlayOpen/overlayClosed`），并在页面中展示调用与说明。
- [ ] 6.3 展示注入的只读同步数据（“快照 + 增量事件”），说明字段来源与更新策略：UI/Window 经 Wujie `props/shared` 注入；Overlay 经 SSE 下行桥接；统一只读。
- [ ] 6.4 提供插件配置设置页面与持久化（示例：开关项、数值、令牌），演示读写配置与热更新效果，遵循安全与去敏约束。
- [ ] 6.5 演示事件订阅与跨页面交互（UI/Window ↔ Overlay 消息），统一通过 Wujie 事件总线；Overlay 上行使用 `POST /api/overlay/:overlayId/message`，下行通过 SSE 接收并转发到子应用。
- [ ] 6.6 配置打包：将示例插件静态资源纳入发行包（如 `resources/plugins/base-example`），由主进程统一静态托管；暴露 `GET /plugins/:id/ui[/*]`、`/window[/*]`、`/overlay[/*]` 与 `*.html` 入口（`overlayId` 通过 query）。
- [ ] 6.7 主进程实现默认自加载逻辑：安装完成后自动加载示例插件；测试环境亦自动加载（环境检测与容器为 Web-only，不依赖 Node/Electron 全局）。
- [ ] 6.8 页面内嵌文档：示例插件的 UI/Window/Overlay 页面直接展示说明与引导，无需另外编写外部文档。
- [ ] 6.9 验证示例插件在浏览器、开发模式与打包产物中均可运行（无 `require is not defined` 等错误）；验证 SSE 下行与 POST 上行的稳定性与节流策略。

## 7. Validation

- [x] 7.1 执行 `openspec validate update-overlay-and-plugin-wujie-loading --strict`，当前通过。
