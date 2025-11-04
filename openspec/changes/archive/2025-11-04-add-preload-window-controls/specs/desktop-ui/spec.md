# Desktop UI Spec (Delta)

## MODIFIED: Topbar Interface Components

### Scenario: Window Controls Bridging

- Given main process provides `ipcMain.handle('window.minimize'|'window.close'|'window.maximize'|'window.restore')`
- And preload exposes `window.electronApi.window.{minimizeWindow, closeWindow, maximizeWindow, restoreWindow}` via `contextBridge`
- When Topbar buttons trigger `window.electronApi.window.*`
- Then the main window should minimize/close/maximize/restore accordingly without renderer-to-main direct imports

### Notes
- This delta augments the Topbar specification to require preload bridging for window controls.
- Renderer `Topbar.vue` already calls these methods; bridging ensures functionality.