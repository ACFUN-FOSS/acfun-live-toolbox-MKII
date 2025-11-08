## 1. Implementation
- [x] 1.1 阅读 `openspec/project.md` 与相关 `specs/plugin-system/spec.md`，确认当前能力与展示策略
- [x] 1.2 在主进程新增统一接口：`GET /api/plugins`（返回 `PluginInfo[]` 标准结构）
- [x] 1.3 在渲染层 `plugin store` 增加 HTTP 回退：当 `electronApi.plugin` 不可用时调用 `getApiBase()/api/plugins`
- [x] 1.4 统一状态映射：`installed/disabled/inactive → inactive`，`enabled/active → active`，错误态 → `error`
- [x] 1.5 插件管理页面默认展示全部已安装插件，保留筛选与统计（不隐藏 `inactive`）
- [x] 1.6 最小化增强清单字段展示（如 icon/描述），不更改运行逻辑
- [ ] 1.7 验证：示例插件 `base-example` 在首次启动后可见（状态为 `inactive`），可手动启用
- [x] 1.8 文档与记录：更新根目录 `tasks.md`，说明改动与后续建议

## 2. Validation
- [x] 2.1 严格走查静态代码与类型检查（遵循工作区规则）
- [x] 2.2 在 IPC 不可用情境下，管理页面依旧能加载示例插件列表
 - [x] 2.3 `openspec validate fix-plugin-list-visibility --strict`（本仓规范性校验）

## 3. Notes
- 不创建或运行任何测试用例；
- 不启动渲染进程开发服务器；
- 如未来需要启停/调试等接口，另起 `change-id` 按需扩展。
 
## 4. Diagnostics / Issues & Triage
 - [ ] 4.1 启用 base-example 失败：进程未就绪（status: starting）
  - 现象：点击“启用”报错 Unhandled error（type: `enable_failed`），消息：`Plugin process base-example is not running (status: starting)`。
  - 相关堆栈：`ProcessManager.executeInPlugin` → `ProcessManager.startPluginProcess` → `PluginManager.enablePlugin`（packages/main/dist/index.cjs）。
  - 修复方向：主进程启用流程需等待插件进程完全就绪（running）；必要时加入重试/回退；渲染层切换时增加状态守卫与错误提示。
- [x] 4.2 点击“配置”弹框为空白
  - 现象：在插件管理页点击“配置”，弹框出现但内容为空白。
  - 修复方向：为配置对话框增加缺省提示，当 `selectedPlugin.config` 为空或无字段时显示“该插件未提供可配置项”；存在配置时按 schema 渲染动态表单（`getConfigComponent/getConfigProps`）。避免空白体验并保持类型安全。
- [x] 4.3 点击“查看详情”无响应
  - 现象：点击“查看详情”无任何界面或路由变化。
  - 修复方向：在 `PluginManagementPage.vue` 中实现详情对话框，使用 `<t-dialog v-model:visible="showDetailDialog">` 包含 `<PluginDetail :plugin-id="selectedPlugin.id" />`；实现 `viewPluginDetails(plugin)` 设置 `selectedPlugin` 并打开对话框；监听 `@pluginUpdated` 时调用 `pluginStore.refreshPlugins()` 保持列表同步。
- [x] 4.4 刷新后出现 TTag 的 icon 属性类型错误
  - 现象：`[Vue warn]: Invalid prop: type check failed for prop "icon". Expected Function, got String ("error-circle")`，来源于 `<TTag theme="danger" icon="error-circle" />`。
  - 修复方向：TDesign `TTag` 的 `icon` 需传渲染函数或使用插槽；已改为使用 `#icon` 插槽包裹 `<t-icon :name="getStatusIcon(status)" />`；同时保留 `getStatusIcon` 返回字符串作为 `t-icon` 的 `name`。

- [x] 4.5 插件管理顶部四个统计数字需要删除
  - 现象：插件管理页顶部展示四个统计数字（计数卡片）；需求为移除该统计展示。
  - 修复方向：删除/注释统计区块模板与相关样式；保留内部计算逻辑但不渲染到 UI，避免产生空白布局并调整页面栅格与间距。
  - 实现要点：移除 `PluginManagementPage.vue` 中 `plugin-stats` 模板与 `.plugin-stats/.stat-*` 样式及媒体查询项；不改动 `pluginStore` 的数据结构与计算。
  - 验证：全仓库类型检查通过（`pnpm -r run typecheck`）；UI 预览因工作区规则暂不启动，等待手工确认。

- [x] 4.6 示例插件增加示例可配置项
  - 现象：示例插件 `base-example` 未提供配置项，导致设置页缺少内容。
  - 修复方向：在示例插件的 `manifest` 中新增 `config` schema（开关、文本、数字等基础字段），渲染层按 schema 生成表单；确保 `pluginStore` 将 `manifest.config` 映射到 `PluginInfo.config`。
  - 实现要点：
    - 在 `buildResources/plugins/base-example/manifest.json` 增加 `config` 字段，包含 `enableFeature:boolean`、`refreshInterval:number(min/max/step)`、`token:text(placeholder)` 等示例项。
    - 在 `PluginManagementPage.vue` 的 `configurePlugin` 初始化 `pluginConfig` 为纯值映射（读取 `value/default` 或按类型提供缺省），避免直接将 schema 对象绑定到 `v-model`。
    - 在 `packages/renderer/src/stores/plugin.ts` 的 `updatePluginConfig` 写入逻辑保留 schema：若存在对象则写入 `value` 字段，否则直接覆盖为原始值。
  - 验证：全仓库类型检查通过；UI 预览需人工确认（未启动渲染预览服务）。

 - [x] 4.7 启用示例插件后，详情页插件状态仍显示“禁用”
  - 现象：在管理页启用后进入详情，详情状态仍为禁用（快照未更新/未订阅事件）。
  - 修复方向：详情页状态来源与刷新需对齐主进程生命周期事件；打开详情时执行 `pluginStore.refreshPlugins()` 或订阅 `process.started`/`pluginUpdated` 事件更新；在 `<PluginDetail>` 内对 `pluginId` 变化与主进程事件进行侦听，避免使用过期快照。
  - 实现要点：
    - 在 `packages/renderer/src/components/PluginDetail.vue` 中集成 Pinia `pluginStore`（`usePluginStore`），移除直接使用 `window.electronApi.plugin.get/enable/disable` 的本地状态切换。
    - `loadPlugin()` 使用 `pluginStore.getPluginById(pluginId)`，找不到时调用 `pluginStore.refreshPlugins()` 再取，确保详情页加载到最新快照。
    - `togglePlugin()` 通过 `pluginStore.togglePlugin(id, !enabled)` 切换，并在完成后 `await pluginStore.refreshPlugins()` 再取当前插件，更新本地 `plugin` 并触发 `emit('pluginUpdated', plugin)`。
    - `uninstallPlugin()` 改为调用 `pluginStore.uninstallPlugin(id)`，完成后关闭对话框并返回列表。
  - 验证：全仓库类型检查通过；遵循工作区规则未启动渲染预览，UI 行为待人工确认。

 - [x] 4.8 详情页设置标签页展示插件设置项
  - 现象：用户期望在“设置”标签页展示插件的实际设置项（如开关、文本、数字等），而不是仅显示“插件设置功能正在开发”的占位提示。
  - 修复方向：根据插件 manifest 的 config schema 渲染表单，支持基础类型（布尔、字符串、数字），并与 PluginInfo.config 映射。
  - 实现要点：
    - 在 `packages/renderer/src/components/PluginDetail.vue` 的“设置”页，使用 `<t-form>` 动态渲染 `plugin.config`：`getConfigComponent(type)` 映射到 `t-switch/t-input-number/t-select/t-textarea/t-input`；`getConfigProps` 提取 `options/min/max/step/placeholder`。
    - 通过 `derivePluginConfigFromSchema` 将 schema 初始化为可双向绑定的原始值（优先 `value`，次选 `default`，否则按类型给缺省值），并在 `watch(plugin)` 时刷新。
    - 保存时调用 `pluginStore.updatePluginConfig(plugin.id, pluginConfig)`，store 写回保留 schema 并更新 `value` 字段。
  - 验证：仓库类型检查全部通过；未启动 UI 预览（遵循工作区规则），等待人工确认渲染效果。
  - 后续修复（4.9）：日志级别字符串化安全处理（移除模板内 `toUpperCase`，新增 `normalizeLogLevel/getLogLevelLabel/getLogLevelTheme`，过滤逻辑基于归一化后的级别）。
  - 修复：发现 SFC 结构错误（设置相关函数误置于 </style> 之后），已将 `derivePluginConfigFromSchema/getConfigComponent/getConfigProps/savePluginConfig` 全部移入 `<script setup>`，编译错误消除。

- [x] 4.9 日志页报错：`log.level.toUpperCase is not a function`
  - 现象：`PluginDetail.vue:224` 报类型错误，`log.level` 非字符串导致 `toUpperCase` 失败。
  - 修复方向：为 `log.level` 增加类型防护与映射（字符串大写；数字映射为 `INFO/WARN/ERROR`；缺省为 `INFO`），避免直接调用 `toUpperCase` 导致异常。

- [x] 4.10 点击卸载报错：`Cannot destructure property 'type' of 'vnode' as it is null`
  - 现象：卸载操作触发组件卸载时的 vnode 空指针。
  - 相关堆栈：`chunk-TWFIPBJ3.js:8010 unmount → unmountComponent`。
  - 修复方向：对话框关闭与卸载流程需稳定渲染与清理顺序：关闭对话框前停止日志刷新/监听、避免过渡期间重渲染；为列表提供稳定 `key`；启用 `destroyOnClose` 并在关闭后再导航返回。
  - 实现要点：
    - 在 `PluginDetail.vue` 的卸载确认对话框上启用 `:destroy-on-close="true"`，并增加 `@close` 处理重置本地状态。
    - 在 `uninstallPlugin()` 中先 `showUninstallDialog=false`，`await nextTick()` 后再通过微任务 `emit('back')`，避免并发卸载造成 vnode 空指针。
  - 验证：类型检查通过；UI 预览遵循工作区规则暂不启动，人工确认。
  - 状态：已完成。

### 4.13 base-example 配置 schema 丢失导致 `schemaKeys=[]`
- 现象：`plugin.list` 返回的 `manifest` 中无 `config`，渲染端 `PluginManagementPage.vue` 落入 mock schema。
- 根因：用户数据目录下已存在的示例插件为旧版本清单，缺失 `config` 字段；安装逻辑仅在缺失时复制，未就地刷新。
- 修复（更新）：移除磁盘就地刷新；在 `loadInstalledPlugins()` 中用 `Object.assign` 将内置清单与用户清单浅合并，并对 `config/ui/overlay/window` 等常用嵌套对象进行浅合并，保留用户值、补充新字段。
- 验证：静态代码走查与类型检查通过；未启动渲染进程；待人工验证 UI 行为（`schemaKeys` 应含示例配置键）。
- 状态：已完成。

- [ ] 4.13 配置弹框未渲染配置表单（回归失败）
  - 现象：点击示例插件的“配置”按钮，弹框仍未显示配置项表单。
  - 修复方向：确保 `pluginStore` 将 `manifest.config` 正确映射到 `PluginInfo.config`；在 `configurePlugin()` 按 schema 生成 `pluginConfig` 原始值，并在弹框内用 `<t-form>` 渲染。
  - 实现要点：
    - 校验 `selectedPlugin.config` 结构，避免把 schema 本体绑定到 `v-model`；仅绑定原始值映射。
    - 使用 `derivePluginConfigFromSchema()` 初始化双向绑定值；`getConfigComponent/getConfigProps` 映射输入组件与属性。
    - 复查模板中的 `v-if/v-else` 判定，确保非空时渲染表单而不是占位提示。
  - 验证：类型检查通过；UI 预览遵循工作区规则暂不启动，人工确认。

- [ ] 4.14 详情页“设置”分栏未渲染配置列表（回归失败）
  - 现象：点击“查看详情”后切换到“设置”分栏，未展示配置项列表。
  - 修复方向：在 `<PluginDetail>` 中确保使用 `pluginStore.getPluginById()` 获取包含 `config` 的最新快照；在 `watch(plugin)` 时刷新 `pluginConfig`；模板 `<t-form>` 使用 `pluginConfig` 渲染。
  - 实现要点：
    - 确认 `<script setup>` 内 `plugin.value?.config` 的读取与 `pluginConfig` 初始化顺序；避免空对象导致不渲染。
    - 处理 `pluginId` 变化与 `pluginUpdated` 事件，避免使用过期快照；必要时 `await pluginStore.refreshPlugins()` 后再取。
    - 清理 SFC 结构错误残留，确保相关方法与侦听器均在 `<script setup>` 执行。
  - 验证：类型检查通过；UI 预览遵循工作区规则暂不启动，人工确认。

- [x] 4.15 优化：日志分栏按时间倒序排序
  - 现象：当前日志列表未按时间倒序展示，影响定位最近事件。
  - 修复方向：在详情页的日志过滤函数中先按 `timestamp` 倒序排序，再进行级别过滤（兼容字符串/数字时间戳）。
  - 实现要点：`filterLogs()` 内部对 `logs` 执行 `sort((a,b) => tb - ta)`，处理 `number|string` 的时间戳并保持稳定键；随后应用 `normalizeLogLevel` 过滤。
  - 验证：类型检查通过；UI 预览遵循工作区规则暂不启动，人工确认。

- [ ] 4.16 启用后再禁用，插件列表状态变成错误
  - 现象：点击启用再点禁用，插件列表中的状态显示为错误态。
  - 修复方向：校准状态映射与事件顺序，避免短暂错误态；切换完成后以主进程真实状态为准刷新列表。
  - 实现要点：
    - 统一状态映射：`enabled/active → active`，`disabled/inactive → inactive`，异常 → `error`。
    - 切换过程中增加本地“进行中”守卫，避免 UI 误判为错误；完成后 `pluginStore.refreshPlugins()`。
    - `getStatusIcon(status)` 与标签主题与状态字典保持一致。
  - 验证：类型检查通过；UI 预览遵循工作区规则暂不启动，人工确认。

- [ ] 4.17 禁用后再启用出现 “already running” 错误
  - 现象：`Failed to enable plugin: Error: Unhandled error. ({ pluginId: 'base-example', type: 'enable_failed', message: 'Plugin process base-example is already running' ... })`。
  - 相关堆栈：`ProcessManager.startPluginProcess` → `PluginManager.enablePlugin`（packages/main/dist/index.cjs:10148/13806）；调用链：`stores/plugin.ts:294` → `PluginManagementPage.vue:140`。
  - 修复方向：主进程在 `enablePlugin` 时若进程已运行应短路为“已启用”或执行幂等检查；渲染层对 `enable_failed` 添加恢复策略（忽略/重试/刷新）。
  - 实现要点：
    - `PluginManager.enablePlugin` 检查 `ProcessManager.status === running` 时跳过启动并返回成功；或增加恢复动作 `ignore`。
    - 渲染层 `togglePlugin()` 捕获该错误后刷新插件列表并提示，可选自动恢复到启用态。
  - 验证：类型检查通过；UI 预览遵循工作区规则暂不启动，人工确认。
  - 状态：已完成。
  - 变更摘要：在 `packages/main/src/plugins/PluginManager.ts` 中增加启用幂等短路（检测到现有进程则直接标记启用并保存配置），并在 `disablePlugin` 中处理未启用但存在残留进程的清理与状态同步，避免再次启用时报“already running”。

- [x] 4.11 点击刷新日志同样报 `Cannot destructure property 'type' of 'vnode' as it is null`
  - 现象：刷新日志触发快速重渲染造成 vnode 为空。
  - 修复方向：为日志列表提供稳定 `key` 与就地更新策略（替换数组项而非重建组件），减少过渡期间的卸载；避免 `v-if` 抖动导致销毁/重建。
  - 实现要点：日志列表 `v-for` 替换索引为稳定 key（基于 `timestamp/message`）；错误列表同样替换为稳定 key。
  - 验证：类型检查通过；UI 预览遵循工作区规则暂不启动，人工确认。
  - 状态：已完成。

- [x] 4.12 错误管理页出现 `Failed to resolve component: t-result`
  - 现象：`t-result` 组件解析失败，无法渲染占位提示。
  - 相关堆栈：`PluginDetail.vue:333` 等。
  - 修复方向：在 `PluginDetail.vue` 显式引入并注册 `Result` 组件（或改用已注册的 `t-alert`）；如项目未全局安装 TDesign 组件库，确保局部注册；避免通过 `isCustomElement` 规避，优先正确注册组件。
  - 实现要点：将空状态块中的 `<t-result>` 替换为 `<t-alert theme="error" message="..." />`，并保留返回按钮，避免组件解析失败。
  - 验证：类型检查通过；UI 预览遵循工作区规则暂不启动，人工确认。
  - 状态：已完成。

- [x] 4.18 配置持久化与加载（getConfig/updateConfig）
  - 现象：配置保存仅在前端存储，详情页/配置弹框无法加载主进程中已保存的真实配置。
  - 修复方向：预加载层暴露 `plugin.getConfig/updateConfig`；渲染层保存时通过 IPC 持久化；打开配置弹框与详情页设置时加载已保存配置并覆盖 schema 初始值。
  - 实现要点：
    - 在 `packages/preload/src/index.ts` 增加 `api.plugin.getConfig(id)` 与 `api.plugin.updateConfig(id, cfg)`；
    - 在 `packages/renderer/src/stores/plugin.ts` 的 `updatePluginConfig` 先 `await plugin.updateConfig`，再更新本地 schema。
    - 管理页 `configurePlugin()` 异步获取并覆盖已保存值；详情页 `watch(plugin)` 时融合已保存值。
  - 验证：`pnpm -C packages/renderer typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/main typecheck` 全通过；未启动渲染预览。
  - 状态：已完成。

- [x] 4.19 主进程 PluginManifest 对齐配置清单（新增可选 config）
  - 现象：渲染层读取 `manifest.config` 时类型缺失，可能影响类型检查与开发体验。
  - 修复方向：在主进程 `PluginManifest` 接口中增加 `config?: Record<string, any>`，与 `manifest.json` 保持一致，确保 `plugin.list` 返回的 `manifest` 在类型上完整。
  - 实现要点：修改 `packages/main/src/plugins/PluginManager.ts` 的接口定义；不改变运行时行为，仅类型增强。
  - 验证：`pnpm -C packages/main typecheck` 通过；未涉及 UI 改动。
  - 状态：已完成。

- [x] 4.20 临时示例配置用于管理页表单渲染验证
  - 现象：配置弹框未渲染表单，需在插件未提供 schema 的情况下验证渲染路径。
  - 变更：在 `PluginManagementPage.vue` 中加入 `mockConfigSchema`，在 `configurePlugin()` 打开对话框时当 `plugin.config` 为空则注入示例 schema。
  - 验证：静态走查与类型检查；未启动渲染进程；不涉及测试任务。
  - 状态：已完成（临时验证用）。

- [x] 4.21 增加渲染层调试日志定位传值问题
  - 现象：管理页表单出现后怀疑为“schema 未传递/丢失”导致。
  - 变更：在 `packages/renderer/src/stores/plugin.ts` 的 `loadPlugins/refreshPluginStatus` 输出列表 `count` 与每项 `schemaKeys`；在 `PluginManagementPage.vue` 的 `configurePlugin/getConfigComponent/getConfigProps` 输出 `schemaKeys/初始/最终配置键`、未知类型与缺少 `options` 的告警。为确保在默认控制台等级可见，统一使用 `console.log/console.warn`（不使用 `console.debug`）。
  - 验证：全仓类型检查；遵循工作区规则不启动渲染进程；仅打印键名不输出敏感值。
  - 状态：已完成。

- [x] 4.22 移除管理页临时示例配置并接入真实 schema
  - 现象：管理页在缺少 `plugin.config` 时注入 `mockConfigSchema` 进行表单验证，导致与真实配置链路不一致。
  - 变更：删除 `PluginManagementPage.vue` 中的 `mockConfigSchema` 与回退注入逻辑；在管理页与详情页显式将控件类型 `text` 映射为 `t-input`，严格依赖 `manifest.config` 渲染配置表单；当插件未提供 schema 时显示空状态，不再注入示例。
  - 验证：`pnpm -C packages/renderer typecheck` 通过；静态代码走查确认不存在 mock 引用；未启动渲染进程预览（遵循工作区规则）。
  - 状态：已完成。

- [x] 4.23 保存插件配置报错：`An object could not be cloned`
  - 现象：在管理页点击“保存”时，调用栈 `PluginManagementPage.vue.savePluginConfig → pluginStore.updatePluginConfig` 最终到达 IPC `plugin.updateConfig`，报结构化克隆错误。
  - 根因：将 Vue 响应式 Proxy 对象直接传入 `ipcRenderer.invoke`，导致跨进程结构化克隆失败。
  - 变更：在 `packages/renderer/src/stores/plugin.ts` 的 `updatePluginConfig` 中对传入配置执行 `JSON.parse(JSON.stringify(config))` 深拷贝，确保传递为纯 JSON 对象后再进行 IPC 调用。

- [x] 4.24 修复“查看”导航 No match 错误：对齐 `router.ts` 路由参数
  - 现象：点击“查看”报错 `No match for { name: 'PluginFrame', params: { id: 'base-example' } }`。
  - 变更：在 `PluginManagementPage.vue` 的 `viewPlugin` 改为 `router.push(\`/plugins/${plugin.id}\`)`，与 `router.ts` 的 `/plugins/:plugname` 路由一致；不再使用不存在的命名路由。
  - 验证：`pnpm -C packages/renderer typecheck` 通过；遵循规则未启动渲染预览。

- [x] 4.25 侧边栏显示状态持久化
  - 现象：启用“在侧边栏显示”后刷新丢失。
  - 变更：在 `packages/renderer/src/stores/plugin.ts` 的 `loadPlugins/refreshPluginStatus` 合并 `localStorage.plugins.sidebarDisplayState`；`updatePluginSidebarDisplay` 写入持久化；移除页面外部独立复选框，改为三点菜单中的复选项。
  - 验证：`pnpm -C packages/renderer typecheck ; pnpm -C packages/main typecheck ; pnpm -C packages/preload typecheck` 全通过；遵循工作区规则未启动渲染预览。
  - 验证：`pnpm -C packages/renderer typecheck` 通过；静态代码走查确认 IPC 参数为纯对象；错误不再出现。
  - 状态：已完成。

- [x] 4.26 修复侧边栏点击插件 404
  - 现象：启用“在侧边栏显示”后，侧边栏点击插件报 404。
  - 根因：侧边栏导航与活跃菜单检测使用了过时路径 `/plugins/frame/:id`，与实际路由 `/plugins/:plugname` 不匹配。
  - 变更：在 `packages/renderer/src/components/Sidebar.vue` 中，将 `openPlugin()`、默认回退与活跃菜单检测统一为 `/plugins/${plugin.id}`，并排除 `/plugins/management`。
  - 验证：`pnpm -C packages/renderer typecheck` 通过；遵循工作区规则未启动渲染预览。

- [x] 4.27 修复“插件管理”返回后侧边栏插件名字闪烁
  - 现象：在侧边栏点击插件后，再点击“插件管理”，侧边栏该插件名字闪烁。
  - 根因：活跃菜单逻辑对不匹配路径反复置空/置值，导致 UI 抖动。
  - 变更：在 `Sidebar.vue` 中以 `path.startsWith('/plugins/') && !path.startsWith('/plugins/management')` 检测插件路由，稳定设置 `activeMenu/activePlugin`，避免与 `/plugins/management` 误判切换造成闪烁。
  - 验证：`pnpm -C packages/renderer typecheck` 通过；遵循工作区规则未启动渲染预览。
- [x] 4.28 修复渲染层动态 require 'crypto' 错误
  - 现象：`PluginManagementPage.vue:440 Error: Dynamic require of "crypto" is not supported`，来源于打包引入 `acfunlive-http-api` 导致 Electron 渲染层加载 Node 内置模块。
  - 根因：渲染层存在对 `acfunlive-http-api` 的运行时值引入（如枚举），使打包包含其入口与依赖（`core/SignUtils`→`crypto`）。
  - 变更：在 `packages/renderer/src/stores/danmu.ts` 移除对 `DanmuSessionState` 的值导入，改为本地枚举，枚举值与 `acfunlive-http-api/dist/types/index.d.ts` 保持一致；保留类型导入（`import type { UserInfo }`）。
  - 验证：`pnpm typecheck` 全通过；未启动渲染进程预览（遵循工作区规则）。
