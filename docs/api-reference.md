# AcFun Live Toolbox 插件 API 参考

## 概述

本文档详细描述了 AcFun Live Toolbox 插件系统提供的所有 API 接口。

说明：`auth` 与 `connection` 能力由宿主应用的统一 `TokenManager` 驱动，所有认证相关状态与 `AcFunLiveApi` 实例均通过单例管理，插件无需自行创建或维护 API/令牌。

## API 对象结构

插件通过构造函数接收的 `api` 对象提供以下模块：

```javascript
{
  logger: LoggerAPI,      // 日志记录
  events: EventsAPI,      // 事件系统
  storage: StorageAPI,    // 数据存储
  config: ConfigAPI,      // 配置管理
  ui: UIAPI,             // 用户界面
  http: HttpAPI,         // HTTP 请求
  utils: UtilsAPI,       // 工具函数
  auth: AuthAPI,         // 认证管理 (新增)
  connection: ConnectionAPI // 连接管理 (新增)
}
```

## AuthAPI - 认证管理

### 方法

#### `isAuthenticated()`

检查当前是否已认证。

**返回值:**
- `boolean`: 是否已认证

**示例:**
```javascript
if (this.api.auth.isAuthenticated()) {
  // 执行需要认证的操作
}
```

#### `getTokenInfo()`

获取当前令牌信息。

**返回值:**
- `TokenInfo | null`: 令牌信息对象或 null

**示例:**
```javascript
const tokenInfo = this.api.auth.getTokenInfo();
if (tokenInfo) {
  console.log('令牌过期时间:', tokenInfo.expiresAt);
}
```

#### `refreshToken()`

刷新认证令牌。

**返回值:**
- `Promise<AuthResult>`: 刷新结果

**示例:**
```javascript
try {
  const result = await this.api.auth.refreshToken();
  if (result.success) {
    console.log('令牌刷新成功');
  }
} catch (error) {
  console.error('令牌刷新失败:', error);
}
```

### 事件

#### `tokenExpiring`

令牌即将过期时触发。

```javascript
this.api.auth.on('tokenExpiring', () => {
  console.log('令牌即将过期');
});
```

#### `authenticationFailed`

认证失败时触发。

```javascript
this.api.auth.on('authenticationFailed', (error) => {
  console.error('认证失败:', error);
});
```

## ConnectionAPI - 连接管理

### 方法

#### `getConnectionStats()`

获取连接池统计信息。

**返回值:**
- `ConnectionStats`: 连接统计信息

**示例:**
```javascript
const stats = this.api.connection.getConnectionStats();
console.log('活跃连接数:', stats.activeConnections);
console.log('总连接数:', stats.totalConnections);
```

#### `isConnected(roomId)`

检查指定房间是否已连接。

**参数:**
- `roomId` (string): 房间ID

**返回值:**
- `boolean`: 是否已连接

**示例:**
```javascript
if (this.api.connection.isConnected('12345')) {
  console.log('房间已连接');
}
```

#### `getConnectionHealth()`

获取连接健康状态。

**返回值:**
- `HealthStatus`: 健康状态信息

**示例:**
```javascript
const health = this.api.connection.getConnectionHealth();
console.log('健康连接数:', health.healthyConnections);
console.log('不健康连接数:', health.unhealthyConnections);
```

### 事件

#### `connectionEstablished`

连接建立时触发。

```javascript
this.api.connection.on('connectionEstablished', (roomId) => {
  console.log('连接已建立:', roomId);
});
```

#### `connectionLost`

连接丢失时触发。

```javascript
this.api.connection.on('connectionLost', (roomId, error) => {
  console.error('连接丢失:', roomId, error);
});
```

#### `connectionRecovered`

连接恢复时触发。

```javascript
this.api.connection.on('connectionRecovered', (roomId) => {
  console.log('连接已恢复:', roomId);
});
```

## LoggerAPI - 日志记录

### 方法

#### `debug(message, context?)`

记录调试级别的日志。

**参数:**
- `message` (string): 日志消息
- `context` (object, 可选): 附加上下文信息

**示例:**
```javascript
this.api.logger.debug('调试信息', { userId: 123, action: 'login' });
```

#### `info(message, context?)`

记录信息级别的日志。

**参数:**
- `message` (string): 日志消息
- `context` (object, 可选): 附加上下文信息

**示例:**
```javascript
this.api.logger.info('用户登录成功', { username: 'user123' });
```

#### `warn(message, context?)`

记录警告级别的日志。

**参数:**
- `message` (string): 日志消息
- `context` (object, 可选): 附加上下文信息

**示例:**
```javascript
this.api.logger.warn('API 调用频率过高', { endpoint: '/api/data', count: 100 });
```

#### `error(message, context?)`

记录错误级别的日志。

**参数:**
- `message` (string): 日志消息
- `context` (object, 可选): 附加上下文信息

**示例:**
```javascript
this.api.logger.error('数据库连接失败', { 
  error: error.message, 
  stack: error.stack 
});
```

#### `setLevel(level)`

设置日志级别。

**参数:**
- `level` (string): 日志级别 ('debug', 'info', 'warn', 'error')

**示例:**
```javascript
this.api.logger.setLevel('debug');
```

## EventsAPI - 事件系统

### 方法

#### `on(eventName, listener)`

添加事件监听器。

**参数:**
- `eventName` (string): 事件名称
- `listener` (function): 事件处理函数

**返回值:**
- `EventsAPI`: 返回自身，支持链式调用

**示例:**
```javascript
this.api.events.on('room.enter', (roomInfo) => {
  console.log('进入直播间:', roomInfo);
});
```

#### `off(eventName, listener)`

移除事件监听器。

**参数:**
- `eventName` (string): 事件名称
- `listener` (function): 要移除的事件处理函数

**返回值:**
- `EventsAPI`: 返回自身，支持链式调用

**示例:**
```javascript
this.api.events.off('room.enter', this.onRoomEnter);
```

#### `once(eventName, listener)`

添加一次性事件监听器。

**参数:**
- `eventName` (string): 事件名称
- `listener` (function): 事件处理函数

**返回值:**
- `EventsAPI`: 返回自身，支持链式调用

**示例:**
```javascript
this.api.events.once('app.ready', () => {
  console.log('应用已就绪');
});
```

#### `emit(eventName, ...args)`

发送事件。

**参数:**
- `eventName` (string): 事件名称
- `...args` (any): 事件参数

**返回值:**
- `boolean`: 是否有监听器处理了该事件

**示例:**
```javascript
this.api.events.emit('plugin.custom.event', { data: 'custom data' });
```

#### `removeAllListeners(eventName?)`

移除所有监听器。

**参数:**
- `eventName` (string, 可选): 事件名称，如果不提供则移除所有事件的监听器

**返回值:**
- `EventsAPI`: 返回自身，支持链式调用

**示例:**
```javascript
// 移除特定事件的所有监听器
this.api.events.removeAllListeners('room.enter');

// 移除所有监听器
this.api.events.removeAllListeners();
```

### 系统事件

#### 直播间事件

##### `room.enter`
进入直播间时触发。

**事件数据:**
```javascript
{
  roomId: string,        // 直播间ID
  roomName: string,      // 直播间名称
  streamer: string,      // 主播名称
  streamerId: string,    // 主播ID
  coverUrl: string,      // 封面图片URL
  category: string,      // 直播分类
  tags: string[],        // 标签列表
  viewerCount: number,   // 观看人数
  timestamp: number      // 时间戳
}
```

##### `room.leave`
离开直播间时触发。

**事件数据:**
```javascript
{
  roomId: string,        // 直播间ID
  duration: number,      // 观看时长（毫秒）
  timestamp: number      // 时间戳
}
```

##### `room.update`
直播间信息更新时触发。

**事件数据:**
```javascript
{
  roomId: string,        // 直播间ID
  changes: object,       // 变更的字段
  timestamp: number      // 时间戳
}
```

#### 弹幕事件

##### `comment.receive`
收到弹幕时触发。

**事件数据:**
```javascript
{
  id: string,            // 弹幕ID
  userId: string,        // 用户ID
  username: string,      // 用户名
  content: string,       // 弹幕内容
  timestamp: number,     // 时间戳
  userLevel: number,     // 用户等级
  userBadges: string[],  // 用户徽章
  isVip: boolean,        // 是否VIP
  isManager: boolean     // 是否房管
}
```

##### `gift.receive`
收到礼物时触发。

**事件数据:**
```javascript
{
  id: string,            // 礼物ID
  userId: string,        // 用户ID
  username: string,      // 用户名
  giftId: string,        // 礼物类型ID
  giftName: string,      // 礼物名称
  giftCount: number,     // 礼物数量
  giftValue: number,     // 礼物价值
  timestamp: number      // 时间戳
}
```

##### `user.enter`
用户进入直播间时触发。

**事件数据:**
```javascript
{
  userId: string,        // 用户ID
  username: string,      // 用户名
  userLevel: number,     // 用户等级
  isVip: boolean,        // 是否VIP
  timestamp: number      // 时间戳
}
```

#### 应用事件

##### `app.ready`
应用启动完成时触发。

##### `app.beforeQuit`
应用即将退出时触发。

##### `plugin.loaded`
插件加载完成时触发。

**事件数据:**
```javascript
{
  pluginId: string,      // 插件ID
  pluginName: string,    // 插件名称
  version: string        // 插件版本
}
```

## StorageAPI - 数据存储

### 方法

#### `get(key, defaultValue?)`

获取存储的数据。

**参数:**
- `key` (string): 存储键名
- `defaultValue` (any, 可选): 默认值

**返回值:**
- `Promise<any>`: 存储的数据

**示例:**
```javascript
const config = await this.api.storage.get('config', { enabled: true });
```

#### `set(key, value)`

设置存储数据。

**参数:**
- `key` (string): 存储键名
- `value` (any): 要存储的数据

**返回值:**
- `Promise<void>`

**示例:**
```javascript
await this.api.storage.set('config', { enabled: false, theme: 'dark' });
```

#### `remove(key)`

删除存储数据。

**参数:**
- `key` (string): 存储键名

**返回值:**
- `Promise<void>`

**示例:**
```javascript
await this.api.storage.remove('temp-data');
```

#### `clear()`

清空所有存储数据。

**返回值:**
- `Promise<void>`

**示例:**
```javascript
await this.api.storage.clear();
```

#### `keys()`

获取所有存储键名。

**返回值:**
- `Promise<string[]>`: 键名数组

**示例:**
```javascript
const keys = await this.api.storage.keys();
console.log('存储的键名:', keys);
```

#### `has(key)`

检查是否存在指定键名的数据。

**参数:**
- `key` (string): 存储键名

**返回值:**
- `Promise<boolean>`: 是否存在

**示例:**
```javascript
const hasConfig = await this.api.storage.has('config');
```

## ConfigAPI - 配置管理

### 方法

#### `get(key?, defaultValue?)`

获取配置项。

**参数:**
- `key` (string, 可选): 配置键名，如果不提供则返回所有配置
- `defaultValue` (any, 可选): 默认值

**返回值:**
- `Promise<any>`: 配置值

**示例:**
```javascript
// 获取所有配置
const allConfig = await this.api.config.get();

// 获取特定配置
const theme = await this.api.config.get('theme', 'light');
```

#### `set(key, value)` 或 `set(config)`

设置配置项。

**参数:**
- `key` (string): 配置键名
- `value` (any): 配置值
- 或者 `config` (object): 配置对象

**返回值:**
- `Promise<void>`

**示例:**
```javascript
// 设置单个配置
await this.api.config.set('theme', 'dark');

// 设置多个配置
await this.api.config.set({
  theme: 'dark',
  autoStart: true,
  notifications: false
});
```

#### `remove(key)`

删除配置项。

**参数:**
- `key` (string): 配置键名

**返回值:**
- `Promise<void>`

**示例:**
```javascript
await this.api.config.remove('temp-setting');
```

#### `onChange(listener)`

监听配置变化。

**参数:**
- `listener` (function): 变化监听器

**返回值:**
- `function`: 取消监听的函数

**示例:**
```javascript
const unsubscribe = this.api.config.onChange((newConfig, oldConfig) => {
  console.log('配置已更新:', newConfig);
});

// 取消监听
unsubscribe();
```

## UIAPI - 用户界面

### 方法

#### `showNotification(options)`

显示通知。

**参数:**
- `options` (object): 通知选项
  - `title` (string): 通知标题
  - `message` (string): 通知内容
  - `type` (string): 通知类型 ('info', 'success', 'warning', 'error')
  - `duration` (number, 可选): 显示时长（毫秒），默认 3000
  - `actions` (array, 可选): 操作按钮

**返回值:**
- `Promise<string>`: 用户选择的操作

**示例:**
```javascript
await this.api.ui.showNotification({
  title: '操作成功',
  message: '数据已保存',
  type: 'success',
  duration: 5000
});
```

#### `showDialog(options)`

显示对话框。

**参数:**
- `options` (object): 对话框选项
  - `title` (string): 对话框标题
  - `message` (string): 对话框内容
  - `type` (string): 对话框类型 ('info', 'warning', 'error', 'question')
  - `buttons` (array): 按钮列表
  - `defaultButton` (number, 可选): 默认按钮索引

**返回值:**
- `Promise<number>`: 用户点击的按钮索引

**示例:**
```javascript
const result = await this.api.ui.showDialog({
  title: '确认删除',
  message: '确定要删除这个项目吗？此操作不可撤销。',
  type: 'warning',
  buttons: ['取消', '删除'],
  defaultButton: 0
});

if (result === 1) {
  // 用户点击了删除
}
```

#### `showInputDialog(options)`

显示输入对话框。

**参数:**
- `options` (object): 输入对话框选项
  - `title` (string): 对话框标题
  - `message` (string): 提示信息
  - `placeholder` (string, 可选): 输入框占位符
  - `defaultValue` (string, 可选): 默认值
  - `validator` (function, 可选): 输入验证函数

**返回值:**
- `Promise<string|null>`: 用户输入的值，取消时返回 null

**示例:**
```javascript
const name = await this.api.ui.showInputDialog({
  title: '输入名称',
  message: '请输入项目名称:',
  placeholder: '项目名称',
  validator: (value) => {
    if (!value.trim()) {
      return '名称不能为空';
    }
    return null;
  }
});
```

#### `createSettingsPanel(options)`

创建设置面板。

**参数:**
- `options` (object): 设置面板选项
  - `title` (string): 面板标题
  - `component` (Component): Vue 组件
  - `props` (object, 可选): 组件属性

**返回值:**
- `object`: 面板控制对象

**示例:**
```javascript
const panel = this.api.ui.createSettingsPanel({
  title: '插件设置',
  component: SettingsComponent,
  props: {
    pluginId: this.id,
    config: this.config
  }
});

// 显示面板
panel.show();

// 隐藏面板
panel.hide();

// 销毁面板
panel.destroy();
```

## HttpAPI - HTTP 请求

### 方法

#### `get(url, options?)`

发送 GET 请求。

**参数:**
- `url` (string): 请求URL
- `options` (object, 可选): 请求选项

**返回值:**
- `Promise<Response>`: 响应对象

**示例:**
```javascript
const response = await this.api.http.get('https://api.example.com/data');
const data = await response.json();
```

#### `post(url, data?, options?)`

发送 POST 请求。

**参数:**
- `url` (string): 请求URL
- `data` (any, 可选): 请求数据
- `options` (object, 可选): 请求选项

**返回值:**
- `Promise<Response>`: 响应对象

**示例:**
```javascript
const response = await this.api.http.post('https://api.example.com/submit', {
  name: 'test',
  value: 123
});
```

#### `put(url, data?, options?)`

发送 PUT 请求。

#### `delete(url, options?)`

发送 DELETE 请求。

#### `request(options)`

发送自定义请求。

**参数:**
- `options` (object): 请求选项
  - `method` (string): 请求方法
  - `url` (string): 请求URL
  - `headers` (object, 可选): 请求头
  - `body` (any, 可选): 请求体
  - `timeout` (number, 可选): 超时时间

**示例:**
```javascript
const response = await this.api.http.request({
  method: 'PATCH',
  url: 'https://api.example.com/update',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({ status: 'active' }),
  timeout: 10000
});
```

## UtilsAPI - 工具函数

### 方法

#### `debounce(func, delay)`

创建防抖函数。

**参数:**
- `func` (function): 要防抖的函数
- `delay` (number): 延迟时间（毫秒）

**返回值:**
- `function`: 防抖后的函数

**示例:**
```javascript
const debouncedSave = this.api.utils.debounce(() => {
  this.saveData();
}, 1000);
```

#### `throttle(func, limit)`

创建节流函数。

**参数:**
- `func` (function): 要节流的函数
- `limit` (number): 限制间隔（毫秒）

**返回值:**
- `function`: 节流后的函数

**示例:**
```javascript
const throttledUpdate = this.api.utils.throttle(() => {
  this.updateUI();
}, 100);
```

#### `formatTime(timestamp, format?)`

格式化时间。

**参数:**
- `timestamp` (number): 时间戳
- `format` (string, 可选): 格式字符串，默认 'YYYY-MM-DD HH:mm:ss'

**返回值:**
- `string`: 格式化后的时间字符串

**示例:**
```javascript
const timeStr = this.api.utils.formatTime(Date.now(), 'YYYY-MM-DD');
```

#### `generateId(length?)`

生成随机ID。

**参数:**
- `length` (number, 可选): ID长度，默认 8

**返回值:**
- `string`: 随机ID

**示例:**
```javascript
const id = this.api.utils.generateId(16);
```

#### `deepClone(obj)`

深度克隆对象。

**参数:**
- `obj` (any): 要克隆的对象

**返回值:**
- `any`: 克隆后的对象

**示例:**
```javascript
const cloned = this.api.utils.deepClone(originalObject);
```

#### `merge(target, ...sources)`

合并对象。

**参数:**
- `target` (object): 目标对象
- `...sources` (object[]): 源对象

**返回值:**
- `object`: 合并后的对象

**示例:**
```javascript
const merged = this.api.utils.merge(
  { a: 1 },
  { b: 2 },
  { c: 3 }
);
```

## 错误处理

### 错误类型

插件 API 可能抛出以下类型的错误：

#### `PermissionError`
权限不足错误。

#### `ValidationError`
参数验证错误。

#### `NetworkError`
网络请求错误。

#### `StorageError`
存储操作错误。

### 错误处理示例

```javascript
try {
  await this.api.storage.set('key', 'value');
} catch (error) {
  if (error instanceof PermissionError) {
    this.api.logger.error('存储权限不足', { error: error.message });
  } else if (error instanceof ValidationError) {
    this.api.logger.error('参数验证失败', { error: error.message });
  } else {
    this.api.logger.error('未知错误', { error: error.message });
  }
}
```

## 版本兼容性

### API 版本

当前 API 版本: `2.0.0`

### 版本检查

```javascript
if (this.api.version >= '2.0.0') {
  // 使用新版本 API
} else {
  // 使用旧版本 API 或显示兼容性警告
}
```

### 废弃的 API

以下 API 已废弃，将在未来版本中移除：

- `api.legacy.method()` - 使用 `api.newMethod()` 替代

## 最佳实践

### 1. 错误处理

始终使用 try-catch 包装 API 调用：

```javascript
try {
  const result = await this.api.someMethod();
  // 处理结果
} catch (error) {
  this.api.logger.error('API 调用失败', { error: error.message });
  // 错误恢复逻辑
}
```

### 2. 事件监听器管理

在插件销毁时清理事件监听器：

```javascript
class MyPlugin {
  constructor(api) {
    this.api = api;
    this.listeners = [];
  }

  addListener(event, handler) {
    this.api.events.on(event, handler);
    this.listeners.push({ event, handler });
  }

  destroy() {
    // 清理所有监听器
    this.listeners.forEach(({ event, handler }) => {
      this.api.events.off(event, handler);
    });
    this.listeners = [];
  }
}
```

### 3. 配置管理

使用配置变化监听器响应用户设置：

```javascript
async initialize() {
  // 加载初始配置
  this.config = await this.api.config.get();
  
  // 监听配置变化
  this.api.config.onChange((newConfig) => {
    this.handleConfigChange(newConfig);
  });
}

handleConfigChange(newConfig) {
  const oldConfig = this.config;
  this.config = newConfig;
  
  // 响应配置变化
  if (oldConfig.theme !== newConfig.theme) {
    this.updateTheme(newConfig.theme);
  }
}
```

### 4. 性能优化

使用防抖和节流优化频繁操作：

```javascript
constructor(api) {
  this.api = api;
  
  // 防抖保存操作
  this.debouncedSave = this.api.utils.debounce(
    this.saveData.bind(this), 
    1000
  );
  
  // 节流UI更新
  this.throttledUpdate = this.api.utils.throttle(
    this.updateUI.bind(this), 
    100
  );
}
```

---

更多详细信息请参考 [插件开发指南](./plugin-development.md)。