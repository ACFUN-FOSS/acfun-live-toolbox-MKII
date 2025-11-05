## ADDED Requirements

### Requirement: Comprehensive Example Plugin
项目 SHALL 在 `plugins/` 下提供一个“完整能力”的示例插件，以演示：
- 生命周期钩子：加载、卸载、事件订阅与业务处理
- 弹窗提示（popup）：通过公开接口或 IPC 发起通知
- 插件设置页面（settings）：声明式清单字段与入口页面加载
- Overlay 叠加层：前端资源与消息交互（例如与主/渲染进程或插件宿主通信）

#### Scenario: Developer discovers example plugin
- **WHEN** 开发者在仓库中访问 `plugins/example-plugin-pro/`
- **THEN** 可找到 `manifest.json` 与 `index.js`、`overlay/`、`settings/` 资源，并清楚示例如何实现上述能力

#### Scenario: Manifest exposes settings and overlay entries
- **WHEN** 插件被插件管理器加载
- **THEN** 清单字段能被解析并打开设置页面，且 Overlay 可被启动与交互