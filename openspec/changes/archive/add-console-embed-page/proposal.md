## Why
当前渲染进程的 `/system/console` 使用本地 `Console.vue` 展示数据，未按 `ui2.json` 规范在渲染端内嵌远程控制台（`http://localhost:{port}/console`）。需要统一为嵌入式实现并提供风险提示与故障应对。

## What Changes
- 在渲染进程新增/改造 `ConsoleEmbedPage`，通过 `WujieVue` 或 `<iframe>` 内嵌控制台。
- 在页面顶部添加无鉴权风险 `Alert`，指向设置页端口配置与说明。
- 绑定端口配置变化自动重载嵌入视图，提供不可达重试交互。
- 路由统一：确保 `/system/console` 映射到新嵌入页。

## Impact
- UI：新增/改造 `ConsoleEmbedPage`，在 `LayoutShell` 内容区渲染嵌入视图。
- 路由：保持现有 `/system/console` 路径不变；移除/替换本地 `Console.vue` 的直接渲染入口。
- 设置：读取端口配置以构造嵌入 URL，监听端口更改。

## Acceptance Criteria
- 访问 `/system/console` 时：
  - 顶部显示 `Alert`，提示 `/console` 无鉴权仅限局域网使用。
  - 主视图使用 `WujieVue` 或 `<iframe>` 指向 `http://localhost:{port}/console`。
  - 当端口设置更新时，嵌入视图自动重载。
  - 控制台不可达时，显示错误态与“重试/打开设置修正端口”入口。
- 与 `ui2.json` 对齐：`pages.ConsoleEmbedPage` 行为与结构一致。

## Non-Goals
- 不实现远程鉴权机制变更；仍保持局域网无鉴权。
- 不改动主进程 HTTP 服务端点设计，仅消费其现有 `/console`。

## Risks & Mitigations
- 风险：跨域/嵌入限制导致页面加载失败 → 通过 `iframe` 降级与错误态提示。
- 风险：端口不一致/不可达 → 统一从设置读取端口、提供快速跳转到设置修正。

## Development Steps
1. 新建 `ConsoleEmbedPage.vue`，实现 Alert 与嵌入容器（WujieVue/iframe）。
2. 读取设置中的端口配置，构造嵌入 URL 并监听变化重载。
3. 路由绑定 `/system/console` 到嵌入页；保留或移除旧 `Console.vue` 的本地数据展示（按需要迁移到系统页的日志标签）。
4. 错误态与重试交互：网络失败时展示提示与重试按钮；提供跳转设置入口。
5. 同步 `ui2.json`：`ConsoleEmbedPage` 从“实现中”切换为“已实现”（完成后）。

## Next Steps
- 评审通过后按上述步骤实现，并更新 `ui2.json` 与变更归档。