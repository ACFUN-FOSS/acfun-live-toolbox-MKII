# AcFun Live Toolbox 插件开发指南

## 概述

AcFun Live Toolbox 提供了一个强大的插件系统，允许开发者扩展应用的功能。本文档将指导您如何开发、测试和发布插件。

## 插件结构

### 基本目录结构

```
your-plugin/
├── manifest.json      # 插件清单文件（必需）
├── index.js          # 插件主文件（必需）
├── icon.svg          # 插件图标（推荐）
├── README.md         # 插件说明文档（推荐）
├── package.json      # Node.js 依赖管理（可选）
└── src/              # 源代码目录（可选）
    ├── components/   # 组件文件
    ├── utils/        # 工具函数
    └── styles/       # 样式文件
```

### manifest.json 清单文件

插件清单文件定义了插件的基本信息和配置：

```json
{
  "id": "your-plugin-id",
  "name": "插件名称",
  "version": "1.0.0",
  "description": "插件描述",
  "author": "作者名称",
  "main": "index.js",
  "permissions": ["api", "storage", "ui", "overlay"],
  "icon": "icon.svg",
  "homepage": "https://github.com/your-username/your-plugin",
  "repository": "https://github.com/your-username/your-plugin.git",
  "license": "MIT",
  "keywords": ["acfun", "live", "plugin"],
  "engines": {
    "ACLiveFrame": ">=2.0.0"
  }
}
```

#### 字段说明

- `id`: 插件唯一标识符，必须全局唯一
- `name`: 插件显示名称
- `version`: 插件版本号，遵循 SemVer 规范
- `description`: 插件功能描述
- `author`: 插件作者
- `main`: 插件入口文件路径
- `permissions`: 插件所需权限列表
- `dependencies`: 插件依赖的 npm 包
- `icon`: 插件图标文件路径
- `engines`: 支持的应用版本范围

#### 统一静态托管（UI/Window/Overlay）

为便于托管插件的前端页面和资源，支持在 `manifest.json` 中为 `ui`、`window`、`overlay` 声明统一的静态托管字段：

```json
{
  "id": "your-plugin-id",
  "name": "插件名称",
  "version": "1.0.0",
  "main": "index.js",
  "ui": {
    "spa": true,
    "route": "/",
    "html": "ui.html",
    "wujie": { "url": "/", "spa": true, "route": "/" }
  },
  "window": {
    "spa": true,
    "route": "/",
    "html": "window.html"
  },
  "overlay": {
    "spa": false,
    "html": "overlay.html",
    "wujie": { "url": "/overlay", "spa": false }
  }
}
```

- `spa`: 是否为单页应用（SPA）。当为 `true` 时，`/plugins/:id/<type>/*` 会回退到入口 `html` 文件。
- `route`: SPA 场景下的初始路由（未提供时默认 `/`）。
- `html`: 入口 HTML 文件（位于插件安装目录的相对路径）。不提供时默认使用 `<type>.html`。
- `wujie`: 兼容历史字段，用于声明 Wujie 微前端入口；`url` 可与上述 `route` 对齐。

托管后的访问路由：
- `GET /plugins/:id/ui[/*]`、`/plugins/:id/window[/*]`、`/plugins/:id/overlay[/*]`
- 直接入口：`GET /plugins/:id/ui.html`、`/plugins/:id/window.html`、`/plugins/:id/overlay.html`

若非 SPA（`spa:false`），`/plugins/:id/<type>/<path>` 将按静态资源路径映射到插件安装目录（带安全路径校验）。

#### 权限系统

插件可以请求以下权限：

- `api`: 访问应用 API
- `storage`: 访问本地存储
- `ui`: 创建用户界面
- `overlay`: 创建和管理浮层窗口
- `network`: 网络访问权限
- `filesystem`: 文件系统访问权限

## 插件 API

### 插件类结构

每个插件都应该导出一个插件类，实现以下生命周期方法：

```javascript
class YourPlugin {
  constructor(api) {
    this.api = api;
    this.name = '插件名称';
    this.version = '1.0.0';
  }

  // 插件初始化
  async initialize() {
    // 初始化逻辑
  }

  // 启动插件
  async start() {
    // 启动逻辑
  }

  // 停止插件
  async stop() {
    // 停止逻辑
  }

  // 销毁插件
  async destroy() {
    // 清理逻辑
  }
}

module.exports = YourPlugin;
```

### 认证与统一 API 实例

插件不应自行创建或管理 AcFun API 实例与令牌。宿主应用通过统一的 `TokenManager` 管理认证状态和 API 实例，并在 `api.auth` 接口中向插件暴露必要能力：

- 使用统一认证状态：`this.api.auth.isAuthenticated()`、`this.api.auth.getTokenInfo()`
- 响应认证事件：`tokenExpiring`、`authenticationFailed` 等
- 令牌刷新：`await this.api.auth.refreshToken()`（由宿主协调，兼容 acfunlive-http-api）

示例：
```javascript
class YourPlugin {
  async start() {
    if (!this.api.auth.isAuthenticated()) {
      this.api.logger.warn('未认证，部分功能不可用');
      return;
    }

    const tokenInfo = await this.api.auth.getTokenInfo();
    this.api.logger.info('当前用户', { userId: tokenInfo?.userID });

    this.api.auth.on('tokenExpiring', () => {
      this.api.logger.warn('令牌即将过期');
    });
  }
}
```

### API 对象

插件构造函数会接收一个 `api` 对象，提供以下功能：

#### 日志记录 (api.logger)

```javascript
// 记录不同级别的日志
this.api.logger.debug('调试信息', { data: 'debug data' });
this.api.logger.info('普通信息', { data: 'info data' });
this.api.logger.warn('警告信息', { data: 'warning data' });
this.api.logger.error('错误信息', { error: error.message });
```

#### 事件系统 (api.events)

```javascript
// 监听事件
this.api.events.on('room.enter', this.onRoomEnter.bind(this));
this.api.events.on('comment.receive', this.onCommentReceive.bind(this));

// 发送事件
this.api.events.emit('custom.event', { data: 'event data' });

// 移除监听器
this.api.events.off('room.enter', this.onRoomEnter.bind(this));
```

#### 存储系统 (api.storage)

```javascript
// 保存数据
await this.api.storage.set('key', { data: 'value' });

// 读取数据
const data = await this.api.storage.get('key', defaultValue);

// 删除数据
await this.api.storage.remove('key');

// 清空所有数据
await this.api.storage.clear();
```

#### 配置管理 (api.config)

```javascript
// 获取插件配置
const config = await this.api.config.get();

// 更新插件配置
await this.api.config.set({ key: 'value' });

// 监听配置变化
this.api.config.onChange((newConfig) => {
  console.log('配置已更新:', newConfig);
});
```

#### 用户界面 (api.ui)

```javascript
// 显示通知
this.api.ui.showNotification({
  title: '通知标题',
  message: '通知内容',
  type: 'info' // 'info', 'success', 'warning', 'error'
});

// 显示对话框
const result = await this.api.ui.showDialog({
  title: '确认操作',
  message: '是否继续执行此操作？',
  buttons: ['取消', '确认']
});

// 创建设置面板
this.api.ui.createSettingsPanel({
  title: '插件设置',
  component: SettingsComponent
});
```

#### Overlay 系统 (api.overlay)

Overlay 系统允许插件创建浮层窗口，支持文本、HTML 和 Vue 组件内容：

```javascript
// 创建文本 overlay
const textOverlay = await this.api.overlay.create({
  type: 'text',
  content: '这是一个文本 overlay',
  position: { x: 100, y: 100 },
  size: { width: 300, height: 100 },
  style: {
    backgroundColor: 'rgba(0, 123, 255, 0.9)',
    color: 'white',
    fontSize: '16px',
    padding: '10px',
    borderRadius: '8px'
  },
  pluginId: this.id
});

// 创建 HTML overlay
const htmlOverlay = await this.api.overlay.create({
  type: 'html',
  content: `
    <div style="padding: 20px; background: linear-gradient(45deg, #ff6b6b, #4ecdc4); color: white;">
      <h3>HTML Overlay</h3>
      <p>这是一个 HTML 内容的 overlay</p>
      <button onclick="window.overlayApi.action('test', {message: 'Hello!'})">
        点击测试
      </button>
    </div>
  `,
  position: { x: 200, y: 150 },
  size: { width: 350, height: 200 },
  pluginId: this.id
});

// 创建组件 overlay
const componentOverlay = await this.api.overlay.create({
  type: 'component',
  content: 'MyOverlayComponent', // 组件名称
  props: {
    title: '组件 Overlay',
    message: '这是一个 Vue 组件 overlay',
    data: { key: 'value' }
  },
  position: { x: 300, y: 200 },
  size: { width: 400, height: 250 },
  style: {
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
  },
  pluginId: this.id
});

// 更新 overlay
await this.api.overlay.update(overlayId, {
  content: '更新后的内容',
  position: { x: 150, y: 150 },
  props: { title: '新标题' }
});

// 显示/隐藏 overlay
await this.api.overlay.show(overlayId);
await this.api.overlay.hide(overlayId);

// 将 overlay 置于最前
await this.api.overlay.bringToFront(overlayId);

// 关闭 overlay
await this.api.overlay.close(overlayId);

// 获取所有 overlay 列表
const overlays = await this.api.overlay.list();

// 监听 overlay 动作事件
this.api.events.on('overlay.action', (overlayId, action, data) => {
  console.log('Overlay 动作:', overlayId, action, data);
});
```

##### Overlay 配置选项

```javascript
const overlayOptions = {
  // 基本配置
  type: 'text' | 'html' | 'component',  // overlay 类型
  content: 'string',                     // 内容（文本/HTML/组件名）
  
  // 位置配置
  position: {
    x: 100,           // X 坐标
    y: 100,           // Y 坐标
    // 或使用 CSS 定位
    top: '10px',
    left: '10px',
    right: '10px',
    bottom: '10px'
  },
  
  // 尺寸配置
  size: {
    width: 300,       // 宽度
    height: 200,      // 高度
    maxWidth: 500,    // 最大宽度
    maxHeight: 400,   // 最大高度
    minWidth: 200,    // 最小宽度
    minHeight: 100    // 最小高度
  },
  
  // 样式配置
  style: {
    backgroundColor: '#ffffff',
    opacity: 0.9,
    borderRadius: '8px',
    border: '1px solid #ccc',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 1000
  },
  
  // 行为配置
  closable: true,           // 是否显示关闭按钮
  modal: false,             // 是否为模态窗口
  clickThrough: false,      // 是否允许点击穿透
  autoClose: 5000,          // 自动关闭时间（毫秒）
  animation: 'fade',        // 动画效果：'fade', 'slide', 'scale', 'none'
  
  // 组件特定配置
  props: {                  // 传递给 Vue 组件的 props
    title: 'Overlay Title',
    data: { key: 'value' }
  },
  
  // 元数据
  pluginId: 'your-plugin-id',  // 插件 ID（必需）
  className: 'custom-overlay'   // 自定义 CSS 类名
};
```

##### Overlay 内部 API

在 HTML 和组件 overlay 中，可以使用 `window.overlayApi` 对象：

```javascript
// 在 HTML overlay 中
window.overlayApi.close();                    // 关闭当前 overlay
window.overlayApi.action('test', data);       // 发送动作到插件
window.overlayApi.update({ content: '...' }); // 更新 overlay

// 在 Vue 组件中
export default {
  methods: {
    closeOverlay() {
      window.overlayApi.close();
    },
    
    sendAction() {
      window.overlayApi.action('button-click', {
        timestamp: Date.now(),
        data: this.componentData
      });
    },
    
    updateOverlay() {
      window.overlayApi.update({
        props: { ...this.$props, updated: true }
      });
    }
  }
}
```

## 事件系统

### 系统事件

应用会发送以下系统事件：

#### 直播间事件

```javascript
// 进入直播间
this.api.events.on('room.enter', (roomInfo) => {
  console.log('进入直播间:', roomInfo);
});

// 离开直播间
this.api.events.on('room.leave', (roomInfo) => {
  console.log('离开直播间:', roomInfo);
});

// 直播间信息更新
this.api.events.on('room.update', (roomInfo) => {
  console.log('直播间信息更新:', roomInfo);
});
```

#### 弹幕事件

```javascript
// 收到弹幕
this.api.events.on('comment.receive', (comment) => {
  console.log('收到弹幕:', comment);
});

// 收到礼物
this.api.events.on('gift.receive', (gift) => {
  console.log('收到礼物:', gift);
});

// 用户进入
this.api.events.on('user.enter', (user) => {
  console.log('用户进入:', user);
});
```

#### 应用事件

```javascript
// 应用启动
this.api.events.on('app.ready', () => {
  console.log('应用已就绪');
});

// 应用关闭
this.api.events.on('app.beforeQuit', () => {
  console.log('应用即将关闭');
});
```

### 自定义事件

插件可以发送和监听自定义事件：

```javascript
// 发送自定义事件
this.api.events.emit('plugin.custom.event', {
  pluginId: this.id,
  data: 'custom data'
});

// 监听其他插件的事件
this.api.events.on('other-plugin.event', (data) => {
  console.log('收到其他插件事件:', data);
});
```

## 错误处理

### 错误日志记录

```javascript
try {
  // 可能出错的代码
  await this.performOperation();
} catch (error) {
  // 记录错误
  this.api.logger.error('操作失败', {
    error: error.message,
    stack: error.stack,
    context: 'performOperation'
  });
  
  // 重新抛出错误或处理错误
  throw error;
}
```

### 错误恢复

插件系统提供自动错误恢复机制：

```javascript
class YourPlugin {
  async initialize() {
    try {
      await this.setup();
    } catch (error) {
      // 记录错误
      this.api.logger.error('初始化失败', { error: error.message });
      
      // 尝试恢复
      await this.recover();
    }
  }
  
  async recover() {
    // 实现恢复逻辑
    this.api.logger.info('尝试恢复插件...');
    
    // 重置状态
    this.reset();
    
    // 重新初始化
    await this.initialize();
  }
}
```

## 开发工具

### 调试模式

在开发模式下，可以启用详细的调试日志：

```javascript
// 设置日志级别
this.api.logger.setLevel('debug');

// 输出调试信息
this.api.logger.debug('调试信息', {
  variable: someVariable,
  state: this.currentState
});
```

### 热重载

开发模式支持插件热重载，修改代码后会自动重新加载插件。

### 测试工具

```javascript
// 模拟事件
this.api.events.emit('room.enter', {
  roomId: '12345',
  roomName: '测试直播间',
  streamer: '测试主播'
});

// 检查插件状态
const status = this.getStatus();
console.log('插件状态:', status);
```

## 最佳实践

### 1. 错误处理

- 始终使用 try-catch 包装可能出错的代码
- 记录详细的错误信息和上下文
- 实现优雅的错误恢复机制

### 2. 性能优化

- 避免在主线程执行耗时操作
- 使用防抖和节流优化频繁操作
- 及时清理事件监听器和定时器

### 3. 内存管理

- 在 destroy 方法中清理所有资源
- 避免内存泄漏
- 使用弱引用处理循环引用

### 4. 用户体验

- 提供清晰的错误提示
- 实现加载状态指示
- 支持用户配置和个性化设置

### 5. 安全性

- 验证所有外部输入
- 避免执行不安全的代码
- 遵循最小权限原则

## 示例插件

### 简单的弹幕统计插件

```javascript
class CommentStatsPlugin {
  constructor(api) {
    this.api = api;
    this.name = '弹幕统计';
    this.version = '1.0.0';
    this.stats = {
      totalComments: 0,
      uniqueUsers: new Set(),
      topUsers: new Map()
    };
  }

  async initialize() {
    this.api.logger.info('弹幕统计插件初始化');
    
    // 监听弹幕事件
    this.api.events.on('comment.receive', this.onCommentReceive.bind(this));
    
    // 加载历史统计数据
    const savedStats = await this.api.storage.get('stats', {});
    if (savedStats.totalComments) {
      this.stats.totalComments = savedStats.totalComments;
      this.stats.topUsers = new Map(savedStats.topUsers || []);
    }
  }

  async start() {
    this.api.logger.info('弹幕统计插件启动');
    this.isRunning = true;
  }

  async stop() {
    this.api.logger.info('弹幕统计插件停止');
    this.isRunning = false;
    
    // 保存统计数据
    await this.saveStats();
  }

  async destroy() {
    this.api.logger.info('弹幕统计插件销毁');
    
    // 移除事件监听器
    this.api.events.off('comment.receive', this.onCommentReceive.bind(this));
    
    // 保存数据
    await this.saveStats();
  }

  onCommentReceive(comment) {
    if (!this.isRunning) return;
    
    try {
      // 更新统计数据
      this.stats.totalComments++;
      this.stats.uniqueUsers.add(comment.userId);
      
      const userCount = this.stats.topUsers.get(comment.userId) || 0;
      this.stats.topUsers.set(comment.userId, userCount + 1);
      
      this.api.logger.debug('弹幕统计更新', {
        totalComments: this.stats.totalComments,
        uniqueUsers: this.stats.uniqueUsers.size,
        user: comment.username
      });
      
      // 每100条弹幕保存一次数据
      if (this.stats.totalComments % 100 === 0) {
        this.saveStats();
      }
      
    } catch (error) {
      this.api.logger.error('处理弹幕统计失败', {
        error: error.message,
        comment: comment
      });
    }
  }

  async saveStats() {
    try {
      await this.api.storage.set('stats', {
        totalComments: this.stats.totalComments,
        topUsers: Array.from(this.stats.topUsers.entries())
      });
      
      this.api.logger.debug('统计数据已保存');
    } catch (error) {
      this.api.logger.error('保存统计数据失败', { error: error.message });
    }
  }

  getStats() {
    return {
      totalComments: this.stats.totalComments,
      uniqueUsers: this.stats.uniqueUsers.size,
      topUsers: Array.from(this.stats.topUsers.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
  }
}

module.exports = CommentStatsPlugin;
```

## 发布插件

### 1. 准备发布

- 确保所有功能正常工作
- 编写完整的 README.md
- 添加适当的许可证文件
- 更新版本号

### 2. 打包插件

```bash
# 创建插件压缩包
zip -r your-plugin-v1.0.0.zip your-plugin/
```

### 3. 测试安装

在应用中测试插件安装和运行：

1. 打开插件管理器
2. 选择"安装本地插件"
3. 选择插件压缩包
4. 验证安装和功能

### 4. 发布到插件市场

（待插件市场功能完成后补充）

## 故障排除

### 常见问题

1. **插件无法加载**
   - 检查 manifest.json 格式是否正确
   - 确认入口文件路径是否正确
   - 查看控制台错误信息

2. **权限错误**
   - 确认 manifest.json 中声明了所需权限
   - 检查 API 调用是否正确

3. **事件监听器不工作**
   - 确认事件名称拼写正确
   - 检查监听器绑定的 this 上下文

4. **内存泄漏**
   - 确保在 destroy 方法中清理所有资源
   - 检查是否有未清理的定时器或事件监听器

### 调试技巧

1. 使用详细的日志记录
2. 利用浏览器开发者工具
3. 检查插件状态和配置
4. 使用断点调试

## 更多资源

- [API 参考文档](./api-reference.md)
- [插件示例集合](./examples/)
- [常见问题解答](./faq.md)
- [社区论坛](https://github.com/your-org/ACLiveFrame/discussions)

---

如有问题或建议，请在 GitHub 上提交 Issue 或 Pull Request。