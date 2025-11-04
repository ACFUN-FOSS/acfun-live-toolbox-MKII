# Proposal: 实现 Ctrl/⌘+F 聚焦当前页搜索

## 背景与目标
- 根据 `ui2.json` 的 `navigation.keyboard_shortcuts` 规范，应用需支持 `Ctrl/⌘+F` 快捷键，用于“聚焦当前页搜索”。
- 当前渲染进程已实现 `Alt+1..5`（侧边栏分栏切换）与 `Esc`（关闭弹层/对话框），但未实现 `Ctrl/⌘+F` 搜索聚焦。
- 目标：为具备搜索能力的页面与工具栏统一接入快捷键，使用户无需鼠标即可快速定位搜索框。

## 范围
- 页面：`PluginsPage`（顶部工具栏 `SearchInput`）、`SystemPage`（日志页关键词搜索）、后续具备搜索栏的页面。
- 组件：通用 Topbar/Sidebar 不变；仅在页面级或全局键盘事件层新增处理。

## 设计方案
- 提供一个轻量的“搜索焦点注册机制”：
  - 在每个支持搜索的页面挂载时，调用 `registerSearchFocus(getSearchEl)` 将当前页面的搜索元素引用注册到全局。
  - 页面卸载时调用 `unregisterSearchFocus(getSearchEl)` 或自动清理。
  - 全局在 `packages/renderer/src/keyboard.ts` 监听 `keydown`，当 `ctrlKey/ metaKey` + `KeyF` 时，调用当前注册的 `getSearchEl()?.focus()`，并 `preventDefault()`。
- 关注 Vue/TDesign 输入组件：
  - 若为 `<t-input>`，通过 `ref` 获取原生 input（`ref.value?.focus()`）；
  - 若为复合组件，需在页面内封装一个 `getSearchEl()` 返回可聚焦的真实输入框。
- 可观测性：在控制台打印一次“SearchFocusTriggered”日志事件，便于后续诊断与埋点。

## 验收标准
- 在 `PluginsPage` 打开时按 `Ctrl/⌘+F`，焦点跳至搜索输入框，且默认选中现有内容以便覆盖输入。
- 在 `SystemPage` 的“日志”标签页打开时按 `Ctrl/⌘+F`，焦点跳至关键词搜索输入框。
- 当页面不包含搜索框或搜索框被禁用时，快捷键不抛出错误且不影响其他快捷键行为。

## 影响与兼容性
- 无 IPC/主进程改动，仅渲染进程增强。
- 不改变现有路由与页面结构；在 `ui2.json` 的实现状态中已标记 `Ctrl/⌘+F` 为【实现中】。
- 与既有 `Alt+1..5`、`Esc` 行为互不干扰。

## 开发步骤（建议）
1. 新增 `packages/renderer/src/utils/searchFocus.ts`：导出 `registerSearchFocus(fn) / unregisterSearchFocus(fn) / focusSearch()`。
2. 新增全局监听 `packages/renderer/src/keyboard.ts`：挂载一次 `window.addEventListener('keydown', ...)` 处理 `Ctrl/⌘+F`。
3. 在 `PluginsPage.vue` 与 `SystemPage.vue` 中：
   - 为搜索输入添加 `ref` 并在 `onMounted` 注册 `getSearchEl`，在 `onUnmounted` 注销。
4. 联调验证与记录一次控制台日志；不启动预览服务器，采用静态代码走查与类型检查。

## 风险与缓解
- TDesign 输入组件内部结构差异：通过页面级 `getSearchEl` 显式返回可聚焦元素，避免耦合库内部细节。
- 多页面同时注册：仅保留当前路由对应页面的注册引用（路由切换时清理旧注册）。

## 后续工作
- 若后续页面引入搜索能力（如插件列表过滤、事件流过滤），复用同一机制即可无侵入接入。