## ADDED Requirements
### Requirement: Bundled Example Plugin Visibility in Management List
系统 SHALL 在插件管理页面展示所有已安装插件，包括默认随包示例插件，即使其初始状态为禁用（inactive）。

#### Scenario: Example plugin listed when installed but disabled
- WHEN 应用启动后自动安装示例插件（如 `base-example`），且其配置为 `enabled: false`
- THEN 插件管理页面的列表 SHALL 显示该插件，状态为 `inactive`

#### Scenario: HTTP fallback lists plugins when IPC is unavailable
- WHEN 渲染层无法访问 `window.electronApi.plugin`
- THEN 渲染层 SHALL 使用 `GET /api/plugins` 回退接口获取插件列表并正确映射状态

#### Scenario: Consistent field mapping for UI rendering
- WHEN 插件列表包含 `id/name/version/description/author/enabled/status/installedAt/manifest`
- THEN 渲染层 SHALL 将 `enabled/active` 映射为 `active`，`installed/disabled/inactive` 映射为 `inactive`，错误态映射为 `error`

