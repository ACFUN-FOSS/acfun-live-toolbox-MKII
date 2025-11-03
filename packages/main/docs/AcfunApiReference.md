# AcFun Live API 参考文档

## 概述

AcFun Live API 提供了与 AcFun 直播平台交互的 HTTP 接口，支持认证、弹幕、直播管理、礼物、房管等功能。

### 基础信息

- **基础URL**: `http://localhost:3000/api/acfun`
- **认证方式**: 插件ID认证 + 权限控制
- **数据格式**: JSON
- **字符编码**: UTF-8

## API 合规性说明

本项目已完成与 `acfunlive-http-api` 库的完全合规性验证：

- ✅ **QR登录实现**: 完全符合 `acfunlive-http-api` 的 `AuthService` 标准接口
- ✅ **Token管理**: 实现了标准的token存储、刷新和过期处理机制
- ✅ **错误处理**: 遵循标准的错误响应格式和状态码
- ✅ **类型定义**: 使用与 `acfunlive-http-api` 一致的TypeScript类型定义

### 认证

所有 API 请求都需要提供插件ID，可以通过以下方式之一提供：

1. **HTTP Header**: `X-Plugin-ID: your-plugin-id`
2. **查询参数**: `?pluginId=your-plugin-id`
3. **请求体**: `{"pluginId": "your-plugin-id"}`

### 响应格式

所有 API 响应都遵循统一的格式：

```json
{
  "success": true,
  "data": {},
  "error": "错误信息（仅在失败时）",
  "code": 200
}
```

### 速率限制

- 默认限制：每分钟 100 次请求
- 响应头包含限制信息：
  - `X-RateLimit-Limit`: 限制数量
  - `X-RateLimit-Remaining`: 剩余次数
  - `X-RateLimit-Reset`: 重置时间

## 认证相关 API

### 检查认证状态

```http
GET /auth/status
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "isAuthenticated": true,
    "userId": "12345",
    "username": "用户名",
    "tokenExpiry": 1640995200000
  }
}
```

### 开始二维码登录

```http
POST /auth/qr-login
```

**请求体**:
```json
{
  "callback": "http://example.com/callback"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "qrCodeUrl": "https://m.acfun.cn/login?token=xxx",
    "sessionId": "session-123",
    "expiresIn": 300
  }
}
```

### 检查二维码登录状态

```http
GET /auth/qr-status?sessionId=session-123
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "confirmed",
    "userId": "12345",
    "username": "用户名",
    "token": "auth-token-xxx"
  }
}
```

### 设置认证令牌

```http
POST /auth/token
```

**请求体**:
```json
{
  "token": "auth-token-xxx",
  "userId": "12345"
}
```

### 清除认证令牌

```http
DELETE /auth/token
```

## 用户相关 API

### 获取用户信息

```http
GET /user/info
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userId": "12345",
    "username": "用户名",
    "avatar": "https://example.com/avatar.jpg",
    "level": 15,
    "followCount": 100,
    "fanCount": 500,
    "acCoin": 1000,
    "banana": 50
  }
}
```

### 获取钱包信息

```http
GET /user/wallet
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "acCoin": 1000,
    "banana": 50,
    "totalRecharge": 5000,
    "totalConsume": 4000
  }
}
```

## 弹幕相关 API

### 开始弹幕会话

```http
POST /danmu/start
```

**请求体**:
```json
{
  "roomId": "123456",
  "userId": "12345"
}
```

### 停止弹幕会话

```http
POST /danmu/stop
```

**请求体**:
```json
{
  "roomId": "123456"
}
```

### 获取直播间信息

```http
GET /danmu/room-info?roomId=123456
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "roomId": "123456",
    "title": "直播间标题",
    "owner": {
      "userId": "12345",
      "username": "主播名",
      "avatar": "https://example.com/avatar.jpg"
    },
    "status": "live",
    "viewerCount": 1000,
    "likeCount": 500,
    "category": "游戏",
    "tags": ["LOL", "竞技"]
  }
}
```

## 直播相关 API

### 检查直播权限

```http
GET /live/permission
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "canLive": true,
    "restrictions": []
  }
}
```

### 获取推流地址

```http
GET /live/stream-url?quality=high&format=rtmp
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "url": "rtmp://push.acfun.cn/live/stream-key",
    "quality": "high",
    "format": "rtmp",
    "expiresAt": 1640995200000
  }
}
```

### 获取推流设置

```http
GET /live/stream-settings
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "title": "直播标题",
    "category": "游戏",
    "tags": ["LOL"],
    "description": "直播描述",
    "isPrivate": false
  }
}
```

### 获取推流状态

```http
GET /live/stream-status
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "isLive": true,
    "startTime": 1640990000000,
    "duration": 3600,
    "viewerCount": 1000,
    "likeCount": 500,
    "giftCount": 100
  }
}
```

### 开始直播

```http
POST /live/start
```

**请求体**:
```json
{
  "title": "直播标题",
  "category": "游戏",
  "tags": ["LOL", "竞技"],
  "description": "直播描述"
}
```

### 停止直播

```http
POST /live/stop
```

### 更新直播间设置

```http
PUT /live/update
```

**请求体**:
```json
{
  "title": "新的直播标题",
  "category": "娱乐",
  "tags": ["聊天", "互动"],
  "description": "新的直播描述"
}
```

### 获取直播统计

```http
GET /live/statistics?days=7
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalViews": 10000,
    "peakViewers": 2000,
    "totalLikes": 5000,
    "totalGifts": 1000,
    "totalRevenue": 500,
    "averageViewTime": 1800
  }
}
```

### 获取直播总结

```http
GET /live/summary
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "roomId": "123456",
    "title": "直播标题",
    "duration": 7200,
    "viewerCount": 1500,
    "likeCount": 800,
    "giftCount": 200,
    "revenue": 100,
    "highlights": ["精彩时刻1", "精彩时刻2"]
  }
}
```

### 获取热门直播

```http
GET /live/hot-lives?limit=10&category=游戏
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "roomId": "123456",
      "title": "热门直播1",
      "owner": {
        "userId": "12345",
        "username": "主播1",
        "avatar": "https://example.com/avatar1.jpg"
      },
      "viewerCount": 5000,
      "category": "游戏",
      "coverImage": "https://example.com/cover1.jpg"
    }
  ]
}
```

### 获取直播分类

```http
GET /live/categories
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "game",
      "name": "游戏",
      "description": "游戏直播分类",
      "icon": "https://example.com/game-icon.png",
      "liveCount": 1000
    }
  ]
}
```

### 获取用户直播信息

```http
GET /live/user-info?userId=12345
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userId": "12345",
    "username": "用户名",
    "roomId": "123456",
    "isLive": true,
    "title": "直播标题",
    "viewerCount": 1000,
    "followCount": 500,
    "fanCount": 2000
  }
}
```

### 获取剪辑权限

```http
GET /live/clip-permission
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "canClip": true,
    "maxDuration": 60,
    "cooldownTime": 300
  }
}
```

### 设置剪辑权限

```http
PUT /live/clip-permission
```

**请求体**:
```json
{
  "canClip": true,
  "maxDuration": 60,
  "cooldownTime": 300
}
```

## 礼物相关 API

### 获取所有礼物列表

```http
GET /gift/all
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "gift-1",
      "name": "香蕉",
      "price": 1,
      "icon": "https://example.com/banana.png",
      "description": "最便宜的礼物",
      "category": "普通",
      "isAvailable": true
    }
  ]
}
```

### 获取直播间礼物列表

```http
GET /gift/live?roomId=123456
```

## 房管相关 API

### 获取房管列表

```http
GET /manager/list
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "userId": "54321",
      "username": "房管1",
      "avatar": "https://example.com/avatar.jpg",
      "level": 2,
      "addedAt": 1640990000000,
      "addedBy": "12345"
    }
  ]
}
```

### 添加房管

```http
POST /manager/add
```

**请求体**:
```json
{
  "userId": "54321",
  "username": "房管用户名"
}
```

### 移除房管

```http
DELETE /manager/remove
```

**请求体**:
```json
{
  "userId": "54321"
}
```

### 获取踢人记录

```http
GET /manager/kick-records?limit=20&offset=0
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "kick-1",
      "targetUserId": "99999",
      "targetUsername": "被踢用户",
      "operatorUserId": "54321",
      "operatorUsername": "房管1",
      "reason": "违规发言",
      "kickedAt": 1640990000000,
      "duration": 3600
    }
  ]
}
```

### 踢出用户

```http
POST /manager/kick
```

**请求体**:
```json
{
  "userId": "99999",
  "reason": "违规发言",
  "duration": 3600
}
```

## 权限管理 API

### 获取所有插件权限

```http
GET /permissions/plugins
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "plugin-1": {
      "pluginId": "plugin-1",
      "permissions": 2,
      "allowedEndpoints": ["/auth/*", "/user/*"],
      "rateLimit": {
        "requests": 100,
        "windowMs": 60000
      }
    }
  }
}
```

### 设置插件权限

```http
POST /permissions/plugins
```

**请求体**:
```json
{
  "targetPluginId": "plugin-1",
  "permissions": 2,
  "allowedEndpoints": ["/auth/*", "/user/*"],
  "deniedEndpoints": ["/live/start", "/live/stop"],
  "rateLimit": {
    "requests": 50,
    "windowMs": 60000
  }
}
```

### 获取特定插件权限

```http
GET /permissions/plugins/plugin-1
```

### 删除插件权限

```http
DELETE /permissions/plugins/plugin-1
```

### 获取 API 端点权限配置

```http
GET /permissions/api-endpoints
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "path": "/auth/status",
      "method": "GET",
      "requiredLevel": 1,
      "description": "Check authentication status"
    }
  ]
}
```

### 检查权限

```http
POST /permissions/check
```

**请求体**:
```json
{
  "targetPluginId": "plugin-1",
  "endpoint": "/auth/status",
  "method": "GET"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "permission": {
      "allowed": true
    },
    "rateLimit": {
      "allowed": true,
      "remaining": 99,
      "resetTime": 1640995200000
    }
  }
}
```

### 重置速率限制

```http
POST /permissions/rate-limit/reset
```

**请求体**:
```json
{
  "targetPluginId": "plugin-1",
  "endpoint": "/auth/status"
}
```

## 错误代码

| 代码 | 说明 |
|------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或插件ID无效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 429 | 速率限制超出 |
| 500 | 服务器内部错误 |

## 权限级别

| 级别 | 名称 | 说明 |
|------|------|------|
| 0 | NONE | 无权限 |
| 1 | READ | 只读权限 |
| 2 | WRITE | 读写权限 |
| 3 | ADMIN | 管理员权限 |

## 使用示例

### JavaScript/TypeScript

```typescript
// 设置插件ID
const pluginId = 'my-plugin';
const baseUrl = 'http://localhost:3000/api/acfun';

// 发送请求
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Plugin-ID': pluginId,
      ...options.headers
    }
  });
  
  return response.json();
}

// 获取用户信息
const userInfo = await apiRequest('/user/info');

// 开始弹幕会话
const danmuResult = await apiRequest('/danmu/start', {
  method: 'POST',
  body: JSON.stringify({
    roomId: '123456'
  })
});
```

### Python

```python
import requests

plugin_id = 'my-plugin'
base_url = 'http://localhost:3000/api/acfun'

def api_request(endpoint, method='GET', data=None):
    headers = {
        'Content-Type': 'application/json',
        'X-Plugin-ID': plugin_id
    }
    
    response = requests.request(
        method=method,
        url=f'{base_url}{endpoint}',
        headers=headers,
        json=data
    )
    
    return response.json()

# 获取用户信息
user_info = api_request('/user/info')

# 开始弹幕会话
danmu_result = api_request('/danmu/start', 'POST', {
    'roomId': '123456'
})
```

## 注意事项

1. **插件ID**: 必须是字母数字、下划线、连字符组成的字符串
2. **速率限制**: 超出限制会返回 429 错误，需要等待重置时间
3. **权限控制**: 不同操作需要不同的权限级别
4. **错误处理**: 始终检查响应中的 `success` 字段
5. **认证状态**: 某些操作需要先进行 AcFun 账号认证

## 更新日志

### v1.0.0
- 初始版本
- 支持认证、用户、弹幕、直播、礼物、房管功能
- 实现权限控制和速率限制
- 提供完整的 TypeScript 类型定义