## Why
为开发者提供一个“完整功能”的插件示例，便于快速理解插件系统的生命周期、交互能力（弹窗提示、设置页面）、以及 Overlay 叠加层的集成方式，从而降低接入成本、统一最佳实践。

## What Changes
- 在 `plugins/` 下新增 `example-plugin-pro`（示例名称，最终以实际目录为准），展示以下能力：
  - 生命周期（加载/卸载、事件订阅与业务处理）
  - 弹窗提示（popup）能力示例
  - 插件设置页面（settings）能力示例
  - Overlay 叠加层能力示例（HTML/CSS/JS + 消息交互）
- 文档更新：补充 `docs/plugin-development.md` 与 `README.md`，指向该示例并说明关键清单字段与集成点。
- 保持向后兼容：不改动核心插件系统既有行为，仅新增示例与文档。

## Impact
- Affected specs: `plugin-system`
- Affected code: 新增 `plugins/example-plugin-pro/`（`manifest.json`、`index.js`、`overlay/`、`settings/` 等资源），如需将“设置页/Popup/Overlay”入口暴露到 UI，则在不改变既有行为前提下补充挂载点。
- Breaking Changes: 无

## Open Questions
- 插件系统对“设置页”的约定是否已有统一清单字段与加载方式？如未定义，将在示例中提供最小约定，并在文档中明确。
- Popup 能力是否通过主进程/渲染进程公开统一 API？示例将以当前已公开接口为准（若无则采用可插拔的消息总线/IPC 适配）。

## Validation
- 通过 OpenSpec 校验：`openspec validate add-plugin-example --strict`（作为开发流程的一部分，不影响运行时行为）