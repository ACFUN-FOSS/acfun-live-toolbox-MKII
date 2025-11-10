## Why
为插件系统提供一个可用的示例插件，演示「统一静态托管」的 UI 与 Overlay 页面，以及通过配置项控制页面背景色，帮助后续插件开发者快速对齐约定并验证托管与配置读写流程。

## What Changes
- 新增一个示例插件的规范提案：在 `buildResources/plugins/<id>/` 下提供 UI 与 Overlay 页面（统一静态托管），页面内容居中显示指定中文文案。
- 在示例插件中提供配置项「ui页面背景色」，用于控制 UI 页面与 Overlay 页面的背景色。
- UI 页面显示居中文案「这个是ui页面」。
- Overlay 页面显示居中文案「这个是overlay页面」。
- Overlay 页面背景色根据读取到的配置项改变；若未设置则采用默认色。
- 不涉及运行时代码改动；后续按任务清单落地目录与 `manifest.json`、`ui.html`、`overlay.html` 文件。

## Impact
- 影响规格：`plugin-system` 能力（统一静态托管、插件配置读取）。
- 影响代码：示例插件的默认清单与页面预计位于 `buildResources/plugins/<sample-id>/manifest.json`、`ui.html`、`overlay.html`；由 `PluginManager` 在加载时与用户清单浅合并。
- 交互入口：渲染层可通过 `/plugins/:id/ui[/*]` 与 `/plugins/:id/overlay[/*]` 访问，非 SPA 则使用 `/plugins/:id/ui.html` 与 `/plugins/:id/overlay.html`。

## Notes
- 配置项展示名采用中文「ui页面背景色」，值为合法 CSS 颜色（如 `#RRGGBB`、`rgb(...)`）。
- UI 与 Overlay 均读取该配置项以统一背景色行为；未设置时采用约定默认色（实现阶段给出）。
