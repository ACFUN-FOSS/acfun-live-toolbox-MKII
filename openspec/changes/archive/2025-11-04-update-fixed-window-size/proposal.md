## Why
`ui2.json` 在全局约束中明确要求主窗口为固定 1024x768，但当前 `WindowManager` 仅设置了初始 `width/height`，未禁用窗口缩放（缺少 `resizable: false`）。这会导致渲染层在 1024x768 优化的布局（Topbar 40px / Sidebar 208px / Content 816x728）在非固定尺寸下出现不一致体验。

## What Changes
- 设置主窗口为固定尺寸：`width: 1024`, `height: 768`, `resizable: false`
- 明确最小/最大尺寸：`minWidth/minHeight = 1024/768`，`maxWidth/maxHeight = 1024/768`
- 文档化全局 UI 约束到规范增量（desktop-ui capability），便于归档与验证

## Impact
- Affected specs: `specs/desktop-ui/spec.md`（新增「Fixed Window Size」需求）
- Affected code: `packages/main/src/bootstrap/WindowManager.ts`（创建窗口配置）
- Risk: 极少（仅窗口尺寸行为），提供开发模式 `DevTools` 不受影响