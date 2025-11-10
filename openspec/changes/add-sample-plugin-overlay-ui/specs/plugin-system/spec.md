## ADDED Requirements

### Requirement: Sample Plugin UI and Overlay
系统 SHALL 在 `buildResources/plugins/<id>` 下提供一个示例插件，声明 UI 与 Overlay 页面并使用统一静态托管字段（`ui.html`、`overlay.html` 或对应 `ui/overlay` 路由）。

#### Scenario: UI page content centered
- **WHEN** 用户打开 `/plugins/:id/ui` 或 `/plugins/:id/ui.html`
- **THEN** 页面显示居中的文本 `这个是ui页面`

#### Scenario: Overlay page content centered
- **WHEN** 用户打开 `/plugins/:id/overlay` 或 `/plugins/:id/overlay.html`
- **THEN** 页面显示居中的文本 `这个是overlay页面`

### Requirement: UI Background Color Configuration
系统 SHALL 为该示例插件提供配置项名为 `ui页面背景色`，用于控制 UI 页背景色；值为合法 CSS 颜色（例如 `#RRGGBB`、`rgb(...)`）。

#### Scenario: UI background reflects config
- **WHEN** 配置项 `ui页面背景色` 被设置为合法颜色值
- **THEN** UI 页面背景色使用该配置值

#### Scenario: UI background default
- **WHEN** 配置项未设置或非法
- **THEN** UI 页面背景色采用约定默认色

### Requirement: Overlay Background Color Follows Config
系统 SHALL 使 Overlay 页背景色读取并应用 `ui页面背景色` 配置，与 UI 页保持一致；未设置时采用默认色。

#### Scenario: Overlay background reflects UI config
- **WHEN** 配置项 `ui页面背景色` 被设置为合法颜色值
- **THEN** Overlay 页面背景色使用该配置值

#### Scenario: Overlay default color
- **WHEN** 配置项未设置或非法
- **THEN** Overlay 页面背景色采用约定默认色
