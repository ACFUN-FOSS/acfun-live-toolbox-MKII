# 开发者笔记：固定主窗口尺寸（1024×768）

目标：落实 `ui2.json` 中对主窗口固定尺寸的要求，避免用户调整窗口导致布局错位或首屏渲染不一致。

变更摘要：
- 在 `packages/main/src/bootstrap/WindowManager.ts` 的 `createWindow()` 中：
  - 设置 `width: 1024`, `height: 768`。
  - 设定 `minWidth/minHeight` 为 `1024/768`。
  - 设定 `maxWidth/maxHeight` 为 `1024/768`。
  - 设置 `resizable: false` 禁止用户调整窗口大小。

验证方式：
- 运行 `pnpm --filter @app/main run typecheck` 进行静态类型检查（通过）。
- 启动渲染进程开发服务器并打开预览：`pnpm --filter @app/renderer run dev`，通过浏览器预览 UI。（在非 Electron 环境下会有 `window.electronApi` 相关报错，属预期，不影响此项变更的有效性。）

注意事项：
- 该变更影响所有平台的窗口行为，若未来需要在 macOS 上保留原生行为或支持全屏，需要在创建窗口后依据平台条件调整。
- 与布局相关组件（如 `LayoutShell`、`Topbar`、`Sidebar`）需确保在 1024×768 下内容不溢出；当前实现已满足基本要求。

后续改进建议：
- 根据 `ui2.json` 的拖拽区域约束，统一在顶部栏使用 `-webkit-app-region: drag`，并确保可点击控件使用 `no-drag`。
- 为不同 DPI/缩放场景提供自适应策略，但维持基准设计尺寸为 1024×768。