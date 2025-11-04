## TODO

- [x] 在 `packages/preload/src/index.ts` 增加 `window` API 分组并暴露四个方法
- [x] 复核 `packages/main/src/ipc/ipcHandlers.ts` 的 `window.*` 频道与方法签名一致
- [x] 通过类型检查，确保 `packages/renderer/src/global.d.ts` 与实际暴露一致
- [x] 在 `desktop-ui` 规格中记录窗口控制桥接的验证场景

## Notes

- 渲染端 `Topbar.vue` 已调用 `window.electronApi.window.*`，无需改动 UI。
- 主进程 handler 已存在，无需改动，仅需核验频道名一致。