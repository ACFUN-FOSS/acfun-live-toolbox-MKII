
# ACLiveFrame

<div align="center">
  <img src="./assets/logo.png" alt="ACLiveFrame Logo" width="128" height="128">
  <h3>适用于ACFUN的开放式直播框架工具</h3>
  <p>一个功能强大、可扩展的 AcFun 直播工具框架，提供弹幕收集、数据分析、插件系统等功能</p>
  
  [![Version](https://img.shields.io/badge/version-3.1.0-blue.svg)](https://github.com/your-org/ACLiveFrame)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/your-org/ACLiveFrame)
</div>

## ✨ 特性

### 🎯 直播工具集成
- **实时弹幕捕获**: 高性能弹幕消息实时获取和处理
- **礼物统计分析**: 自动统计礼物数据，支持多维度分析
- **观众互动管理**: 智能自动回复和互动功能
- **多格式数据导出**: 支持 JSON、CSV、Excel 等格式导出

### 🔌 开放式插件生态
- **模块化架构**: 支持插件动态加载、卸载和热更新
- **丰富API接口**: 完整的插件开发 API 和事件系统
- **插件市场**: 开放的插件分享和下载平台
- **开发工具**: 内置插件开发调试工具

### 🛡️ 安全与稳定
- **安全认证**: 加密存储用户凭据，支持二维码登录
- **智能重连**: 自动检测连接状态，智能故障转移
- **连接池管理**: 优化的连接池，支持多房间并发
- **错误恢复**: 分级错误处理和自动恢复机制

### 🚀 高性能设计
- **异步架构**: 全异步处理，支持高并发
- **智能缓存**: 减少 API 调用，提升响应速度
- **资源优化**: 内存池和连接池优化，防止资源泄漏
- **性能监控**: 实时性能分析和诊断工具

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0 (推荐包管理器)
- **操作系统**: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)

### 安装和运行

1. **克隆项目**
   ```bash
   git clone https://github.com/your-org/ACLiveFrame.git
   cd ACLiveFrame
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **启动开发环境**
   ```bash
   pnpm start
   ```

4. **构建生产版本**
   ```bash
   pnpm build
   ```

### 首次使用

1. **启动应用**: 运行 `pnpm start` 启动开发环境
2. **账号登录**: 使用 AcFun 手机客户端扫描二维码登录
3. **连接直播间**: 输入房间号或主播ID开始监听
4. **配置功能**: 根据需要启用相应的功能模块

## 🔐 认证设置

### API 合规性保证

本项目已完成与 `acfunlive-http-api` 库的完全合规性验证：
- ✅ QR登录实现完全符合标准接口规范
- ✅ Token管理机制与官方API保持一致
- ✅ 错误处理和类型定义完全兼容

### 二维码登录（推荐）

1. 启动应用后，点击"登录"按钮
2. 使用 AcFun 手机客户端扫描二维码
3. 确认登录后，系统会自动保存认证信息

### 手动配置

如果二维码登录失败，可以手动配置认证信息：

1. **获取认证令牌**:
   - 登录 AcFun 网页版
   - 打开浏览器开发者工具 (F12)
   - 在网络请求中找到包含认证信息的请求
   - 复制相关的认证参数

2. **配置认证信息**:
   ```json
   {
     "userID": "你的用户ID",
     "securityKey": "安全密钥",
     "serviceToken": "服务令牌",
     "deviceID": "设备ID"
   }
   ```

详细的认证设置请参考 [集成指南](docs/integration-guide.md)。

## 🔌 插件开发

ACLiveFrame 提供了强大的插件系统，支持开发者创建自定义功能。

### 快速创建插件

```bash
# 使用插件模板创建新插件
pnpm create-plugin my-awesome-plugin

# 进入插件目录
cd plugins/my-awesome-plugin

# 安装依赖
pnpm install

# 开发模式
pnpm dev
```

### 插件示例

```typescript
import { Plugin, PluginContext } from '@acliveframe/plugin-api';

export default class MyPlugin extends Plugin {
  async onLoad(context: PluginContext) {
    // 监听弹幕消息
    context.on('danmaku', (message) => {
      console.log('收到弹幕:', message.content);
    });
    
    // 监听礼物消息
    context.on('gift', (gift) => {
      console.log('收到礼物:', gift.name, gift.count);
    });
  }
  
  async onUnload() {
    // 清理资源
  }
}
```

更多插件开发信息请参考 [插件开发指南](docs/plugin-development.md)。

#### 内置示例插件：base-example
- 首次运行时自动安装到 `userData/plugins` 并在启动后自动启用。
- 统一静态托管（仅使用 `spa/route/html`）：
  - 路由示例：
    - `http://127.0.0.1:<port>/plugins/base-example/ui.html`
    - `http://127.0.0.1:<port>/plugins/base-example/window.html`
    - `http://127.0.0.1:<port>/plugins/base-example/overlay.html?overlayId=<id>`
  - 清单示例：`ui/window/overlay` 声明 `spa` 与入口 `html`，示例：`{"ui":{"spa":false,"html":"ui/index.html"}}`。

## 📁 项目架构

### 技术栈

- **前端框架**: Vue 3 + TypeScript + Vite
- **桌面框架**: Electron
- **API集成**: acfunlive-http-api
- **UI组件**: TDesign Vue Next
- **测试框架**: Vitest + Playwright
- **包管理**: pnpm workspaces

### 目录结构

```
ACLiveFrame/
├── packages/
│   ├── main/                 # Electron 主进程
│   │   ├── src/
│   │   │   ├── adapter/      # AcFun API 适配器
│   │   │   ├── services/     # 核心服务
│   │   │   ├── plugins/      # 插件管理
│   │   │   ├── server/       # API 服务器
│   │   │   └── utils/        # 工具函数
│   │   └── package.json
│   ├── preload/              # 预加载脚本
│   │   └── src/
│   │       └── index.ts      # IPC 桥接
│   └── renderer/             # 渲染进程 (Vue 应用)
│       ├── src/
│       │   ├── components/   # Vue 组件
│       │   ├── pages/        # 页面组件
│       │   ├── stores/       # Pinia 状态管理
│       │   ├── router/       # Vue Router
│       │   └── utils/        # 前端工具
│       └── package.json
├── plugins/                  # 插件目录
│   └── example-plugin/       # 示例插件
├── docs/                     # 文档
│   ├── api-reference.md      # API 参考
│   ├── plugin-development.md # 插件开发指南
│   └── integration-guide.md  # 集成指南
├── test/                     # 测试文件
├── openspec/                 # OpenSpec 规范
└── assets/                   # 静态资源
```

## 🛠️ 故障排除

### 常见问题

#### 连接问题
- **无法连接到直播间**
  1. 检查网络连接状态
  2. 验证房间ID是否正确
  3. 确认认证状态是否有效
  4. 查看控制台错误日志

#### 认证失败
- **登录失败或令牌过期**
  1. 重新进行二维码登录
  2. 清除旧的认证信息
  3. 检查 AcFun 账号状态
  4. 确认网络可以访问 AcFun 服务

#### 性能问题
- **应用运行缓慢或内存占用过高**
  1. 减少同时连接的房间数量
  2. 调整事件处理批次大小
  3. 清理过期的缓存数据
  4. 重启应用释放资源

### 日志和诊断

- **应用日志**: `%APPDATA%/ACLiveFrame/logs/`
- **插件日志**: 应用内插件管理页面查看
- **控制台日志**: 按 F12 打开开发者工具
- **诊断报告**: 菜单 → 帮助 → 生成诊断报告

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 开发环境设置

1. Fork 本仓库
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 安装依赖: `pnpm install`
4. 进行开发和测试
5. 提交更改: `git commit -m 'Add amazing feature'`
6. 推送分支: `git push origin feature/amazing-feature`
7. 创建 Pull Request

### 代码规范

- 使用 TypeScript 进行开发
- 遵循 ESLint 和 Prettier 配置
- 编写单元测试和集成测试
- 更新相关文档

### 测试

```bash
# 运行单元测试
pnpm test

# 运行集成测试
pnpm test:e2e

# 测试覆盖率
pnpm test:coverage
```

## 📦 数据持久化与查询 API

### SQLite 事件存档

- 存储位置：默认在 `app.getPath('userData')/events.db`；若无法获取用户目录，则回退到临时目录 `os.tmpdir()/acfun-events.db`。
- 表结构：`events(id, event_id, type, room_id, source, user_id, username, payload, timestamp, received_at, raw_data, created_at)`。
- 索引：
  - `idx_events_room_ts (room_id, timestamp)`
  - `idx_events_type_ts (type, timestamp)`
  - `idx_events_source (source)`
  - `idx_events_received_at (received_at)`
- 写入策略：批量事务化写入，默认刷新窗口 `1s`，批次大小约 `100`（可根据负载调整）。

### 房间元数据（主播名映射）

- 表结构：`rooms_meta(room_id PRIMARY KEY, streamer_name, streamer_user_id, updated_at)`。
- 索引：`idx_rooms_meta_streamer_name (streamer_name)`。
- 用途：`room_kw`（主播用户名关键词）会先在 `rooms_meta` 匹配；若缺失，将遍历已知房间并从 AcFun API 拉取主播信息补全后再匹配。

### 查询端点 `/api/events`

- 默认监听地址：`http://127.0.0.1:1299`（主进程 API Server）。
- 支持的查询参数：
  - `room_kw` (string) — 主播用户名关键词（模糊匹配）
  - `from_ts` / `to_ts` (number) — 时间范围（毫秒）
  - `type` (`NormalizedEventType`) — 事件类型；支持集合：
    - 逗号分隔：`?type=danmaku,gift`
    - 多参数：`?type=danmaku&type=gift`
  - `user_kw` (string) — 中文用户名关键词（模糊匹配）
  - `q` (string) — 关键字（在 `username`/`payload`/`raw_data` 中模糊匹配）
  - `page` (number, 默认 `1`, 最小 `1`)
  - `pageSize` (number, 默认 `200`, 范围 `1..1000`)

### 示例

```bash
# 查询最近 200 条弹幕
curl "http://127.0.0.1:1299/api/events?type=danmaku&page=1&pageSize=200"

# 查询多类型（弹幕+礼物）且包含关键字“火箭”
curl "http://127.0.0.1:1299/api/events?type=danmaku,gift&q=火箭&from_ts=1730800000000&to_ts=1730890000000"

# 按主播用户名关键词匹配房间，并按中文用户名关键词过滤
curl "http://127.0.0.1:1299/api/events?room_kw=某主播&user_kw=某用户&page=1&pageSize=200"
```

### 类型检查（推荐）

- 进行静态类型检查：

```bash
pnpm run typecheck:all
```

- 说明：本项目支持类型检查与静态代码走查；如需详细的 API 入参约束与返回结构，请参阅 `openspec/changes/archive/2025-11-05-add-danmu-sqlite-archiving-and-query/api-reference.md`。

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 🙏 致谢

- [AcFun](https://www.acfun.cn/) - 提供直播平台
- [acfunlive-http-api](https://github.com/wpscott/acfunlive-http-api) - AcFun 直播 API
- [Vue.js](https://vuejs.org/) - 前端框架
- [Electron](https://www.electronjs.org/) - 桌面应用框架
- [TDesign](https://tdesign.tencent.com/) - UI 组件库

## 📞 支持

- **问题反馈**: [GitHub Issues](https://github.com/your-org/ACLiveFrame/issues)
- **功能建议**: [GitHub Discussions](https://github.com/your-org/ACLiveFrame/discussions)
- **社区论坛**: [ACLiveFrame 社区](https://community.ACLiveFrame.com)
- **开发文档**: [docs.ACLiveFrame.com](https://docs.ACLiveFrame.com)

---

<div align="center">
  <p>如果这个项目对你有帮助，请给我们一个 ⭐️</p>
  <p>Made with ❤️ by ACLiveFrame Team</p>
</div>
