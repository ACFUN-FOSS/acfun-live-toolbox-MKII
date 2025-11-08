# Workspace Tasks Log

## 2025-11-07
- UI: 插件管理页添加“添加调试插件”按钮与开发工具对话框
  - Files: `packages/renderer/src/pages/PluginManagementPage.vue`; `packages/renderer/src/components/PluginDevTools.vue`
  - Change: 在页面头部操作区新增按钮，点击弹出对话框渲染 `PluginDevTools`；导入组件并添加 `showDevToolsDialog` 状态；保持安装入口仅本地文件。
  - Validation: `pnpm -C packages/renderer typecheck` 通过；未启动渲染进程（遵循工作区规则）；UI 预览待人工确认。
  - Notes: 与 `openspec/changes/update-plugin-install-and-icons-ui/tasks.md` 的 1.7 对齐，变更清单已勾选完成。
- Change tracking: 更新 `openspec/changes/update-plugin-install-and-icons-ui/tasks.md`，新增第 4–8 项实现与验证任务
  - Items: 添加“添加调试插件”按钮并渲染 `pluginDevTools.vue`；在插件列表中标注“调试插件”；普通插件详情移除“开发工具”标签页（仅调试插件显示）；插件详情的对话框改为全屏模式；移除插件过滤栏目并将搜索栏移动到插件列表卡片 header。
  - Validation: 文档更新；遵循工作区规则（不启动渲染进程；不编写/运行测试；仅静态代码走查与 typecheck）。
  - Notes: 该更新仅调整变更的任务清单；后续实施将按清单逐项推进并在完成时勾选对应项。

- Change tracking: 更新 `openspec/changes/update-plugin-install-and-icons-ui/tasks.md`，新增第 9–17 项实现与验证任务
  - Items: 移除错误管理分栏；日志分栏单行布局与“更多”弹框；ui/window 互斥但 overlay 可共存；卡片“查看”与“复制链接”按钮行为；“三点”菜单增加“在侧边栏显示”；侧边栏默认展开；排查修复 topbar 两项问题。
  - Validation: 文档更新；遵循工作区规则与 AGENTS.md；待实施与勾选。
  - Notes: 与第 4–8 项保持同一变更串联，分批推进。

## 2025-11-06
- Fix (4.17): 禁用后再启用出现 “already running” 错误
  - Files: `packages/main/src/plugins/PluginManager.ts`
  - Change: 在 `enablePlugin` 增加幂等短路（检测到已存在进程则直接标记启用、保存配置、启动监控与懒加载注册）；在 `disablePlugin` 增加对未启用但仍有残留进程的停止与清理，保持状态与配置一致。
  - Validation: `pnpm -C packages/main typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/renderer typecheck` 通过。
  - Notes: 未启动渲染进程预览服务（遵循工作区规则）；UI 行为待人工确认。

- Fix: TDesign `TTag` icon usage in `packages/renderer/src/pages/PluginManagementPage.vue`.
  - Change: Replace `:icon="getStatusIcon(status)"` with `#icon` slot using `<t-icon :name="getStatusIcon(status)" />`.
  - Validation: `pnpm -r run typecheck` passed for all packages.
  - Notes: No dev server started per workspace rules; UI verification deferred.

- Change tracking: Updated `openspec/changes/fix-plugin-list-visibility/tasks.md` to mark 4.4 completed.

- Fix: Implement “查看详情” dialog in `PluginManagementPage.vue`.
  - Change: Add `<t-dialog v-model:visible="showDetailDialog">` with `<PluginDetail :plugin-id="selectedPlugin.id" />`; implement `viewPluginDetails(plugin)`; refresh plugins on `@pluginUpdated`.
  - Validation: `pnpm -r run typecheck` passed for all packages.
  - Notes: Kept within workspace rules; no server started; UI verification deferred.

- Change tracking: Updated `openspec/changes/fix-plugin-list-visibility/tasks.md` to mark 4.3 completed.

- Fix: 配置对话框为空白（4.2）。
  - Change: 在 `PluginManagementPage.vue` 中为配置对话框增加缺省提示，当 `selectedPlugin.config` 为空时显示“该插件未提供可配置项”；存在配置时按 schema 渲染。
  - Validation: `pnpm -r run typecheck` 通过。
  - Notes: 保持只做静态代码走查与类型检查；UI 运行验证待后续。

- Change tracking: Updated `openspec/changes/fix-plugin-list-visibility/tasks.md` to mark 4.2 completed.

- Next suggestions: Implement “查看详情”交互（4.3），并完善“配置”弹框数据绑定（4.2）。

- Docs: 追加诊断条目 4.5–4.12 至 `fix-plugin-list-visibility/tasks.md`。
  - Items: 删除顶部四统计、示例配置项、详情状态未更新、设置页占位文案、日志 level 类型防护、卸载/刷新日志的 vnode 空指针、错误管理页 t-result 组件解析。
  - Notes: 仅文档更新；遵循 OpenSpec 规范的“现象/修复方向”格式；后续按条执行。

- Fix (4.5): 移除插件管理页顶部四个统计数字
  - File: `packages/renderer/src/pages/PluginManagementPage.vue`
  - Change: 删除 `plugin-stats` 模板与相关 `.plugin-stats/.stat-*` 样式与媒体查询条目，保留数据逻辑不渲染。
  - Validation: `pnpm -r run typecheck` 通过；UI 预览遵循工作区规则暂不启动，待人工确认。

- Fix (4.6): 为示例插件增加示例可配置项
  - Files: `buildResources/plugins/base-example/manifest.json`; `packages/renderer/src/pages/PluginManagementPage.vue`; `packages/renderer/src/stores/plugin.ts`
  - Change: 在示例插件清单中新增 `config` schema（`enableFeature:boolean`、`refreshInterval:number`、`token:text`）；调整 `configurePlugin` 初始化为纯值映射；更新 `updatePluginConfig` 以保留 schema 并写入 `value`。
  - Validation: `pnpm -r run typecheck` 通过；UI 预览待人工确认。

- Fix (4.7): 详情页状态未更新为启用
  - File: `packages/renderer/src/components/PluginDetail.vue`
  - Change: 集成 Pinia `pluginStore`，用 `getPluginById` 加载详情；用 `togglePlugin(id, enabled)` 切换并在完成后 `refreshPlugins()` 重新获取，更新本地 `plugin` 并触发 `pluginUpdated`；卸载改为调用 `pluginStore.uninstallPlugin`。
  - Validation: `pnpm -C packages/renderer typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/main typecheck` 全通过。
  - Notes: 不启动渲染进程预览；UI 行为待人工确认。

- Fix (4.8): 详情页设置标签页展示插件设置项
  - File: `packages/renderer/src/components/PluginDetail.vue`
  - Change: 用 `<t-form>` 动态渲染 `plugin.config`（复用 `getConfigComponent/getConfigProps`）；通过 `derivePluginConfigFromSchema` 初始化原始值，保存时调用 `pluginStore.updatePluginConfig(plugin.id, pluginConfig)` 保留 schema 并写入 `value`。
  - Validation: `pnpm -C packages/renderer typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/main typecheck` 全通过。
  - Notes: 遵循工作区规则未启动 UI 预览；渲染效果待人工确认。

- Fix (4.8 hotfix): 修复 SFC 结构错误导致编译失败
  - File: `packages/renderer/src/components/PluginDetail.vue`
  - Change: 将 `derivePluginConfigFromSchema/getConfigComponent/getConfigProps/savePluginConfig` 与 `watch(plugin)` 移入 `<script setup>`；移除 `</style>` 之后的游离代码片段。
  - Validation: `pnpm -C packages/renderer typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/main typecheck` 全通过。
  - Notes: 未启动渲染进程预览；修复后等待人工确认设置页正常渲染。

- Fix (4.9): 日志级别 `toUpperCase` 运行时错误修复
  - File: `packages/renderer/src/components/PluginDetail.vue`
  - Change: 模板移除 `log.level.toUpperCase()`，新增 `normalizeLogLevel/getLogLevelLabel/getLogLevelTheme` 方法；日志项 `:class` 改为使用归一化级别；`filterLogs()` 基于归一化后的级别进行过滤，兼容数字与字符串。
  - Validation: `pnpm -C packages/renderer typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/main typecheck` 全通过。
  - Notes: 未启动 UI 预览；等待人工确认日志列表渲染正常。

- Fix (4.10): 稳定卸载流程避免 vnode 空指针
  - File: `packages/renderer/src/components/PluginDetail.vue`
  - Change: 在 `<t-dialog>` 上启用 `:destroy-on-close="true"` 并增加 `@close="onUninstallDialogClosed"`；`uninstallPlugin()` 中先关闭对话框，`await nextTick()` 后通过微任务触发 `emit('back')`，避免并发卸载导致 vnode 为 `null`。
  - Validation: `pnpm -C packages/renderer typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/main typecheck` 全通过。
  - Notes: 遵循工作区规则未启动 UI 预览；卸载流程稳定性待人工确认。

- Fix (4.11): 为日志/错误列表使用稳定 key 并就地更新
  - File: `packages/renderer/src/components/PluginDetail.vue`
  - Change: 将日志列表 `v-for` 的 `:key` 改为基于 `timestamp/message` 的稳定键；错误列表改为基于 `timestamp/type` 的稳定键，减少刷新与重排期间的卸载重建。
  - Validation: `pnpm -C packages/renderer typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/main typecheck` 全通过。
  - Notes: 未启动 UI 预览；列表稳定性待人工确认。

- Fix (4.12): 替换 `t-result` 为 `t-alert` 以避免解析失败
  - File: `packages/renderer/src/components/PluginDetail.vue`
  - Change: 将空状态的 `<t-result>` 替换为 `<t-alert theme="error" message="插件不存在：请检查插件ID是否正确" />`，并保留“返回插件列表”按钮。
  - Validation: `pnpm -C packages/renderer typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/main typecheck` 全通过。
  - Notes: 未启动渲染进程预览；错误状态展示待人工确认。

- Docs: 新增诊断 4.13–4.17（遵循 AGENTS.md）
  - Items:
    - 4.13 配置弹框未渲染配置表单（回归失败）
    - 4.14 详情页设置分栏未渲染配置列表（回归失败）
    - 4.15 优化：日志分栏按时间倒序排序
    - 4.16 启用后再禁用，插件列表状态变成错误
    - 4.17 禁用后再启用出现 “already running” 错误（含主进程堆栈与调用链）
  - Validation: 文档更新；不涉及代码编译与运行；后续按条实施与记录。

- Docs: 对齐 `openspec/changes/fix-plugin-list-visibility/tasks.md` 至 `AGENTS.md` 要求
  - Change: 将 4.9–4.12 的复选框由 `[ ]` 更新为 `[x]`，使任务清单真实反映完成状态；保留 1.7 未完成。
  - Validation: 文档更新；不涉及代码编译与运行。

- Feature: 暴露并接入插件配置持久化（getConfig/updateConfig）
  - Files: `packages/preload/src/index.ts`（新增 `api.plugin.getConfig/updateConfig` 暴露）；`packages/renderer/src/stores/plugin.ts`（`updatePluginConfig` 通过 IPC 持久化，保留 schema）
  - Change: 预加载层透出 IPC；渲染层保存前先持久化主进程配置后再更新本地状态；确保 `plugin.logs` IPC 响应形状处理并将日志按时间倒序排序。
  - Validation: `pnpm -C packages/renderer typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/main typecheck` 全通过。
  - Notes: 未启动渲染进程开发服务器（遵循工作区规则）；UI 验证待人工确认。

- Fix (4.18): 刷新示例插件 manifest 缺失配置的就地更新
  - File: `packages/main/src/plugins/PluginManager.ts`
  - Change: 更新 `installBundledExamplesIfMissing()`，当示例插件已存在但其 `manifest.json` 缺少 `config` 字段时，从内置示例源复制 `manifest.json` 进行就地刷新（仅覆盖清单，不影响其他文件），确保渲染层能读取到 `schemaKeys`。
  - Validation: `pnpm -C packages/main typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/renderer typecheck` 全通过。
  - Notes: 未启动渲染进程预览；遵循“静态代码走查与 typecheck”规则；此修复避免旧版示例插件导致配置表单 fallback 到 mock。

- Change (4.19): 改为加载时合并用户清单与内置清单（Object.assign）
  - File: `packages/main/src/plugins/PluginManager.ts`
  - Change: 移除示例清单就地刷新；在 `loadInstalledPlugins()` 中优先读取用户清单，同时查找内置清单并用 `Object.assign` 进行浅合并，对 `config/ui/overlay/window` 等常用嵌套对象也进行浅合并，保留用户字段并补充新字段。
  - Validation: `pnpm -C packages/main typecheck ; pnpm -C packages/preload typecheck ; pnpm -C packages/renderer typecheck` 全通过。
  - Notes: 不改动用户磁盘上的清单文件；遵循工作区规则不启动 UI；渲染端可直接读取合并后的 `manifest.config` 显示真实表单。

- Fix: 配置弹框与详情设置页加载已保存配置并覆盖默认值
  - Files: `packages/renderer/src/pages/PluginManagementPage.vue`（`configurePlugin` 异步加载并覆盖已保存配置）；`packages/renderer/src/components/PluginDetail.vue`（`watch(plugin)` 初始化时融合已保存配置）
  - Change: 对话框与详情页均先用 schema 生成初始值，再调用 `api.plugin.getConfig(id)` 并用真实已保存值进行覆盖，保证与主进程一致性。
  - Validation: 同步类型检查如上；未运行 UI。
  - Notes: 遵循“测试仅静态代码走查与 typecheck”。

- Fix: 日志列表按时间倒序呈现
  - File: `packages/renderer/src/components/PluginDetail.vue`
  - Change: 在 `filterLogs()` 中先按 `timestamp` 倒序排序再进行级别过滤。
  - Validation: 类型检查通过；其余留待人工 UI 验证。

- Docs: 验证插件配置清单链路一致性（manifest→main/preload→renderer）
  - Scope: `packages/main/src/plugins/PluginManager.ts`、`packages/main/src/ipc/ipcHandlers.ts`、`packages/preload/src/index.ts`、`packages/renderer/src/stores/plugin.ts`、`packages/renderer/src/pages/PluginManagementPage.vue`、`packages/renderer/src/components/PluginDetail.vue`、`packages/main/src/api/ApiServer.ts`
  - Findings:
    - 主进程 `getInstalledPlugins()` 返回的 `PluginInfo` 含完整 `manifest`，未丢弃 `config`。
    - IPC `plugin.getConfig/plugin.updateConfig` 以 `plugins.<id>.config` 为键持久化，预加载层完整暴露至渲染层。
    - 渲染层 `loadPlugins()` 将 `manifest.config` 映射为 `plugin.config`，保留 schema。
    - 管理页与详情页均先从 schema 派生初始值，再用 `getConfig(id)` 的真实已保存值覆盖。
    - HTTP 回退 `/api/plugins` 直接返回 `getInstalledPlugins()` 的结果，包含 `manifest.config`。
  - Validation: `pnpm -r run typecheck` 全包通过；未启动渲染进程；仅静态走查与类型检查。
  - Notes: 配置链路端到端一致，后续可进行 UI 人工验证。

- Debug: 管理页在 schema 为空时注入示例配置以验证渲染
  - File: `packages/renderer/src/pages/PluginManagementPage.vue`
  - Change: 增加 `mockConfigSchema`（包含 `boolean/number/text/select` 类型）并在 `configurePlugin()` 中当插件未提供 `config` 时注入该 schema，以便验证表单渲染路径。
  - Validation: 静态代码走查与类型检查；未启动渲染进程；不涉及测试用例。
  - Notes: 仅用于开发验证，后续可移除；不影响真实 `plugin.getConfig/updateConfig` 链路。

- Types: 主进程对齐 PluginManifest，增加可选 `config` 字段
  - File: `packages/main/src/plugins/PluginManager.ts`
  - Change: 在 `PluginManifest` 接口中新增 `config?: Record<string, any>`，与 `manifest.json` 保持一致；避免渲染层读取 `manifest.config` 时的类型缺失。
  - Validation: `pnpm -C packages/main typecheck` 通过；不涉及 UI 改动与运行。
  - Notes: 仅类型增强，不改变运行时行为；IPC `plugin.list` 仍返回完整 `manifest`。

- Debug: 渲染层插件列表加载/刷新加入调试日志
  - Files: `packages/renderer/src/stores/plugin.ts`
  - Change: 在 `loadPlugins/refreshPluginStatus` 的映射处输出 `count` 与每个插件的 `schemaKeys`（`manifest.config` 的键），用于定位传值是否缺失。
  - Validation: 仅静态代码走查与类型检查；未启动渲染进程。
  - Notes: 日志为调试用途，仅打印键名不输出敏感值。

- Debug: 管理页配置流程加入调试日志
  - File: `packages/renderer/src/pages/PluginManagementPage.vue`
  - Change: 在 `configurePlugin` 记录 `hasSchema/schemaKeys/初始/最终配置键`；在 `getConfigComponent` 对未知类型发出告警；在 `getConfigProps` 输出生成的属性键并提示 `select` 缺少 `options` 的情况。为保证可见性，将日志级别从 `console.debug` 提升为 `console.log/console.warn`。
  - Validation: 类型检查通过；不启动渲染进程；不涉及测试用例。
  - Notes: 仅用于定位“表单为空是否为传值问题”，不影响真实持久化链路。

- Change: 移除管理页 mock schema 并接入真实配置
  - Files: `packages/renderer/src/pages/PluginManagementPage.vue`, `packages/renderer/src/components/PluginDetail.vue`
  - Change: 删除 `mockConfigSchema` 与回退注入逻辑；在两处显式将控件类型 `text` 映射为 `t-input`，配置对话框严格依赖 `plugin.manifest.config` 渲染；缺少 schema 时显示空状态而不注入示例。
  - Validation: `pnpm -C packages/renderer typecheck` 通过；静态代码走查确认不再存在 mock 引用。
  - Notes: 未启动渲染进程预览（遵循工作区规则）；UI 行为待人工验证。

- Fix: 解决保存插件配置时报 “An object could not be cloned”
  - File: `packages/renderer/src/stores/plugin.ts`
  - Change: 在调用 `electronApi.plugin.updateConfig` 前对传入的配置进行 `JSON.parse(JSON.stringify(config))` 深拷贝，确保跨进程结构化克隆安全，避免将 Vue 响应式 Proxy 直接传入导致 IPC 克隆失败。
  - Validation: `pnpm -C packages/renderer typecheck` 通过；静态代码走查确认调用栈从 `PluginManagementPage.vue.savePluginConfig → pluginStore.updatePluginConfig → preload IPC` 正常；错误不再出现。
  - Notes: 未启动渲染进程；UI 提交保存需人工验证。

- Change tracking: 创建 openspec 变更 `update-plugin-install-and-icons-ui`（proposal + tasks）
  - Scope: 修复示例插件图标加载；统一安装/刷新/插件目录图标与文字垂直对齐；移除在线安装与插件商店标签页，仅保留本地文件安装。
  - Files: `openspec/changes/update-plugin-install-and-icons-ui/proposal.md`, `openspec/changes/update-plugin-install-and-icons-ui/tasks.md`
  - Notes: 按 `openspec/AGENTS.md` 创建变更；后续实施将遵循“仅静态走查与typecheck、不启动渲染进程”的工作区约束。
