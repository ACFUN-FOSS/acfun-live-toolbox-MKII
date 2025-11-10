# 示例插件：Overlay+UI

该示例插件用于演示插件静态托管与与宿主之间的桥接通信：

- UI 页面：`ui.html`，通过 `bridge-request` 获取/设置配置（字段：`uiBgColor`），并在 `config-updated` 生命周期事件触发后重新读取并应用背景色。
- Overlay 页面：`overlay.html`，从 Wujie 共享只读存储中读取初始背景色，并通过监听 `overlay-event` 的 `readonly-store-init` 与 `overlay-updated` 事件动态更新背景色。

## 清单字段

- `ui.spa=false` + `ui.html="ui.html"`：声明非 SPA 的直接入口页面。
- `overlay.spa=false` + `overlay.html="overlay.html"`：声明非 SPA 的直接入口页面。
- `config.uiBgColor`：文本类型，用于演示配置管理的读写。

## 使用说明

安装到用户数据目录后，在应用的插件管理页面中：

- 打开示例 UI 页面可看到背景色输入并保存（走宿主桥接）。
- 添加 Overlay（外部浏览器或应用内）时背景色会根据只读存储与事件进行更新。

