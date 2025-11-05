## Why

当前插件页面与 Overlay 的前端承载方式不完全一致：插件内容页已使用 Wujie 微前端隔离运行，但 Overlay 页面仍以内嵌组件/HTML 渲染为主。为统一技术路径、提升隔离性与可维护性、并满足单页面应用（SPA）在主客户端中的正确路由加载需求，需要：
- 统一在客户端内为“插件页面”和“Overlay 页面”使用 Wujie 进行承载与隔离；
- 当插件为单页面应用时，在 manifest 中显式声明默认加载路由，确保首次挂载与后续导航正确；
- 规范化清单（manifest）字段，让插件开发者以声明式方式配置微前端入口与路由。

## What Changes

- Renderer/UI（客户端）：
  - 为 Overlay 页面新增 Wujie 承载（新增 `OverlayFramePage` 或等价容器），与现有 `PluginFramePage`/`CentralPluginContainer` 保持一致的加载流程（统一 `fetch`/headers、安全白名单交互、生命周期事件）。
  - 保留现有 OverlayManager 叠加层能力（z-index、置顶、显示/隐藏、关闭、自动关闭、动画等），但其内容渲染由 Wujie 容器托管（默认支持文本/HTML/组件 Overlay 的兼容模式；若提供微前端 URL，则优先通过 Wujie 加载）。
  - 路由与页面：确保插件页面（`/plugins/frame/:id` 或等价）与 Overlay 路由（如 `/overlay/:overlayId`）都能以 Wujie 方式加载前端资源。

- Manifest（插件清单）扩展：
  - 新增声明式字段以支持 Wujie 前端入口与 SPA 路由：
    - `ui.wujie.url: string`（微前端入口 URL，如 `http://localhost:3000/plugins/<id>` 或静态资源路径）
    - `ui.wujie.spa: boolean`（是否为单页面应用）
    - `ui.wujie.route: string`（当为 SPA 时，首次加载使用的内部路由，例如 `/dashboard`）
    - Overlay 对应字段：`overlay.wujie.url`, `overlay.wujie.spa`, `overlay.wujie.route`
  - 兼容性约束：若未提供 `*.wujie.url`，则回退至原有内容类型（text/html/component）渲染；若提供 `url` 但未声明 `spa`，默认按非 SPA 处理（直接加载入口页面）。

- Main/Preload（主进程与预加载桥）：
  - PluginManager 校验并读取新的 manifest 字段，传递至渲染进程以便 Wujie 容器正确初始化（包括自定义 `fetch`、`X-Plugin-Token`、事件白名单、安全限制）。
  - ApiServer 保持 `/plugins/:id/*` 作用域路由与 Overlay 的 `/api/overlay/:overlayId` 数据接口兼容；当 Overlay 指定了 `overlay.wujie.url` 则由渲染端通过 Wujie 加载，不改变现有后端鉴权与事件流转。

- 文档与示例：
  - 更新 `docs/plugin-development.md`，加入 Wujie 清单字段示例与 SPA 路由声明规范（包含插件 UI 与 Overlay 两类示例）。
  - 在 `plugins/example-plugin/manifest.json` 与 `plugins/overlay-test-plugin/manifest.json` 中补充示例字段，演示 SPA/非 SPA 两种写法。

- 安全与交互：
  - 保持微前端与主应用通信走受控 API（白名单事件），不暴露敏感 token；
  - 维持弹窗（Popup）与 Overlay 的交互 API 一致性（`window.electronApi.plugin.popup.*`、`window.electronApi.overlay.*`），Wujie 子应用内部通过桥接访问受控接口。

- 兼容策略：
  - 插件未声明 Wujie 字段时，现有行为不变；仅当插件提供 `ui.wujie.*` 或 `overlay.wujie.*` 时改走微前端承载。

- BREAKING（轻度约束）：
  - 对于希望以 SPA 载入的插件/Overlay，要求在 manifest 中显式声明 `*.wujie.route`，否则首屏挂载可能不符合预期。为降低影响，默认回退为 `/`。

## Impact

- 受影响规格（specs）：
  - `openspec/specs/plugin-system/spec.md`：补充“插件 UI 与 Overlay 使用 Wujie 承载”的能力要求，定义 manifest 新字段与 SPA 路由声明的规范与场景；
  - `openspec/specs/desktop-ui/spec.md`：在“Plugin frame routing”与“Overlay UI”处明确两者均经 Wujie 隔离加载，且弹窗与叠加层功能保持可用；

- 受影响代码：
  - Renderer：`pages/PluginFramePage.vue`（确认与统一 Wujie 初始化）、`components/CentralPluginContainer.vue`（Wujie props/fetch 与事件桥接统一）、`pages/Overlay.vue`（改为/增加 Wujie 承载路径，如 `OverlayFramePage`）、`components/OverlayManager.vue` & `components/OverlayRenderer.vue`（对 Wujie 渲染模式的兼容）
  - Router：`src/router/index.ts` 与/或 `src/router.ts`（确保插件与 Overlay 页面均支持 Wujie 承载的路由进入）
  - Main/Preload：`packages/main/src/plugins/PluginManager.ts` 与 `packages/preload/src/index.ts`（读取清单新字段并桥接给渲染端容器）
  - Docs/Examples：`docs/plugin-development.md`、`plugins/example-plugin/manifest.json`、`plugins/overlay-test-plugin/manifest.json`

以上为变更提案，后续将在 tasks.md 与 delta specs 中细化实现步骤与验收场景（包括 SPA 与非 SPA 的回归用例）。