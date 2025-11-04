## Why
当前渲染进程的 `Topbar` 使用 `window.electronApi.window.minimizeWindow()` 与 `closeWindow()` 等接口，但 `preload/src/index.ts` 尚未暴露 `window` 控制 API。主进程已提供 `ipcMain.handle('window.minimize'|'window.close'|'window.maximize'|'window.restore')`，桥接缺失导致窗口按钮无法工作。

## What Changes
- 在 `packages/preload/src/index.ts` 的 `api` 对象中新增 `window` 分组，暴露：
  - `minimizeWindow: () => ipcRenderer.invoke('window.minimize')`
  - `closeWindow: () => ipcRenderer.invoke('window.close')`
  - `maximizeWindow: () => ipcRenderer.invoke('window.maximize')`
  - `restoreWindow: () => ipcRenderer.invoke('window.restore')`
- 校验 `packages/main/src/ipc/ipcHandlers.ts` 的窗口控制 handler 已存在并与约定频道一致（已存在）。
- 保持 `Topbar.vue` 现有调用方式，无需改动 UI。
- 在 `openspec/specs/desktop-ui/spec.md` 增量中明确“窗口控制桥接”场景，确保规范可验证。

## Impact
- 受影响规格：`desktop-ui`（Topbar Interface Components）
- 受影响代码：
  - `packages/preload/src/index.ts`（新增 `window` API 暴露）
  - `packages/renderer/src/components/Topbar.vue`（无需改动，调用将生效）
  - `packages/main/src/ipc/ipcHandlers.ts`（已有实现，保持不变）

## Risks / Mitigations
- 风险：在未开启 `contextIsolation` 的环境下暴露 API 与预期不一致。
  - 规避：仅使用 `contextBridge.exposeInMainWorld('electronApi', api)`，不改变隔离策略。
- 风险：类型声明缺失导致编译告警。
  - 规避：`packages/renderer/src/global.d.ts` 已包含 `window` 分组签名，无需改动；如未来签名变更需同步。

## Validation
- 运行 TypeScript 类型检查，确保 `renderer` 与 `preload` 无类型错误。
- 手动验证点击 Topbar 的“最小化/关闭”按钮会触发主窗口行为。