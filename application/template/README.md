# 小程序开发指南

本文档详细介绍如何基于当前模板开发新的小程序，包括项目结构、配置方法、API开发和前端实现等内容。

## 项目结构

小程序模板包含以下核心文件：

```
template/
├── api.cjs        # 后端API实现
├── config.json    # 应用配置文件
└── index.html     # 前端页面 (可由React/Vue/Angular等SPA框架打包生成)
```

### 文件说明

- **api.cjs**: Express路由实现，处理前端请求
- **config.json**: 应用元数据和窗口配置
- **index.html**: 前端页面，支持多页面路由

## 开发步骤

### 1. 配置应用信息

修改`config.json`文件设置应用基本信息：

```json
{
  "id": "unique-app-id",          // 应用唯一ID
  "name": "your-app-name",       // 应用名称(用于路由)
  "version": "1.0.0",            // 版本号
  "info": "Application description", // 应用描述
  "settings": {                   // 应用默认设置
    "theme": "light",
    "notifications": true
  },
  "windows": {                    // 窗口配置
    "width": 800,
    "height": 600,
    "title": "App Title",
    "resizable": true
  }
}
```

### 2. 实现后端API

在`api.cjs`中添加或修改API端点：

```javascript
// 示例：添加新的API端点
router.get('/user/profile', async (req, res) => {
  try {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      data: {
        username: "demo",
        email: "demo@example.com"
      }
    }));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
});
```

### 3. 开发前端界面

`index.html`可以是任意SPA前端框架(React/Vue/Angular等)的打包输出文件，模板默认提供基础SPA路由实现：

#### 添加新页面

1. 在`<div id="app">`中添加页面容器：
```html
<div id="new-page" class="page">
  <h1>新页面</h1>
  <p>这是一个新添加的页面</p>
</div>
```

2. 在路由函数中添加路径处理：
```javascript
if (path.endsWith('/new-page')) {
  document.getElementById('new-page').classList.add('active');
}
```

#### 调用API

使用fetch调用后端API：
```javascript
async function loadProfile() {
  try {
    const response = await fetch('/api/application/template/user/profile');
    const data = await response.json();
    console.log('User profile:', data);
  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}
```

## 配置窗口

通过修改`config.json`中的`windows`配置，可以自定义窗口属性：

| 属性 | 说明 |
|------|------|
| width | 窗口宽度 |
| height | 窗口高度 |
| title | 窗口标题 |
| resizable | 是否可调整大小 |
| alwaysOnTop | 是否置顶窗口 |
| frame | 是否显示窗口边框 |

## 测试与调试

### API测试

模板提供了API测试界面，点击页面中的按钮即可测试：
- 获取配置 (getConfig)
- 更新设置 (updateSettings)
- 获取状态 (getStatus)

### 调试工具

开发模式下，Electron会自动打开调试工具。也可通过`window.webContents.openDevTools()`手动打开。

## 打包与部署

小程序开发完成后，可通过主应用的打包功能将其包含在内。具体步骤：

1. 确保小程序代码位于`application/`目录下
2. 运行主应用的打包命令
3. 小程序会自动被包含在最终的安装包中

## 最佳实践

1. **代码组织**：
   - 复杂逻辑建议拆分为多个模块
   - API请求集中管理

2. **错误处理**：
   - 所有API调用必须包含错误处理
   - 前端需对用户操作提供反馈

3. **性能优化**：
   - 减少不必要的DOM操作
   - API响应数据按需返回

4. **安全性**：
   - 验证所有用户输入
   - 敏感操作需进行权限检查