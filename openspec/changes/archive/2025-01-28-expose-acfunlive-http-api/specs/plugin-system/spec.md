# Plugin System Requirements for AcFunLive HTTP API Exposure

## Overview

扩展插件系统以支持通过HTTP接口直接访问 `acfunlive-http-api` 功能，为插件开发者提供更灵活的API访问方式。

## ADDED Requirements

### Requirement: HTTP API端点暴露
系统SHALL通过HTTP接口暴露 `acfunlive-http-api` 的核心功能，为插件和渲染进程提供直接的API访问能力。

#### Scenario: 插件通过HTTP接口调用AcFun API
**Given**: 插件需要调用AcFun直播API获取用户信息  
**When**: 插件发送HTTP请求到 `/api/acfun/user/info`  
**Then**: 系统返回用户信息的JSON响应

**Acceptance Criteria**:
- [ ] 在 `http://localhost:{port}/api/acfun/` 下提供API端点
- [ ] 支持认证、弹幕、直播、用户等核心API类别
- [ ] 所有端点返回统一格式的JSON响应
- [ ] 提供完整的错误处理和状态码

### Requirement: 插件认证机制
插件访问HTTP API时MUST进行身份认证，确保只有授权的插件可以访问相应的API功能。

#### Scenario: 插件使用Token访问受保护的API
**Given**: 插件已获得有效的访问Token  
**When**: 插件在请求头中包含 `Authorization: Bearer <token>` 访问API  
**Then**: 系统验证Token并允许访问

#### Scenario: 未认证插件尝试访问API
**Given**: 插件没有提供有效Token  
**When**: 插件尝试访问受保护的API端点  
**Then**: 系统返回401未认证错误

**Acceptance Criteria**:
- [ ] 插件通过Bearer Token进行认证
- [ ] Token包含插件ID和权限信息
- [ ] 系统能够验证Token的有效性和权限
- [ ] 未认证请求返回401状态码

### Requirement: API代理和转换
系统SHALL实现API代理层，将HTTP请求转换为 `acfunlive-http-api` 调用，提供统一的接口格式和错误处理。

#### Scenario: HTTP请求转换为acfunlive-http-api调用
**Given**: 插件发送HTTP请求到 `/api/acfun/live/info/12345`  
**When**: API代理层接收到请求  
**Then**: 代理层调用 `acfunlive-http-api.getLiveInfo(12345)` 并返回格式化响应

**Acceptance Criteria**:
- [ ] 创建 `AcfunApiProxy` 类处理请求转换
- [ ] 支持参数验证和格式转换
- [ ] 处理异步调用和错误传播
- [ ] 记录API调用日志

### Requirement: 权限控制
系统SHALL基于插件身份实现API访问权限控制，确保不同插件只能访问其被授权的API功能。

#### Scenario: 插件权限验证
**Given**: 插件A只有用户信息访问权限  
**When**: 插件A尝试访问直播管理API  
**Then**: 系统返回403权限不足错误

**Acceptance Criteria**:
- [ ] 不同插件可以有不同的API访问权限
- [ ] 支持禁用特定插件的API访问
- [ ] 记录权限违规尝试
- [ ] 提供权限管理接口

### Requirement: 速率限制
系统SHALL防止插件过度调用API影响系统性能，实现基于插件的请求频率控制机制。

#### Scenario: 插件超出速率限制
**Given**: 插件在1分钟内已发送100个API请求  
**When**: 插件尝试发送第101个请求  
**Then**: 系统返回429请求频率超限错误

**Acceptance Criteria**:
- [ ] 实现基于插件的速率限制
- [ ] 超出限制时返回429状态码
- [ ] 提供速率限制状态信息
- [ ] 支持配置不同API的限制策略

### Requirement: 客户端集成支持
系统SHALL为插件提供便捷的HTTP API客户端方法，简化插件开发者的API调用过程。

#### Scenario: 插件使用便捷的客户端方法
**Given**: 插件需要调用AcFun API  
**When**: 插件使用 `ApiBridge.httpApi.getUserInfo()` 方法  
**Then**: 方法自动处理认证和请求，返回用户信息

**Acceptance Criteria**:
- [ ] 在 `ApiBridge` 中提供HTTP客户端方法（可选）
- [ ] 自动处理认证Token
- [ ] 提供TypeScript类型定义
- [ ] 包含使用示例和文档

## API Endpoints Specification

### Authentication APIs
```
POST /api/acfun/auth/login          - 用户登录
GET  /api/acfun/auth/status         - 获取登录状态
POST /api/acfun/auth/logout         - 用户登出
```

### Danmu APIs
```
POST /api/acfun/danmu/start         - 开始弹幕连接
POST /api/acfun/danmu/stop          - 停止弹幕连接
GET  /api/acfun/danmu/status        - 获取弹幕连接状态
```

### Live APIs
```
GET  /api/acfun/live/info/:liveId   - 获取直播信息
POST /api/acfun/live/start          - 开始直播
POST /api/acfun/live/stop           - 停止直播
GET  /api/acfun/live/permission     - 检查直播权限
```

### User APIs
```
GET  /api/acfun/user/info           - 获取用户信息
GET  /api/acfun/user/wallet         - 获取钱包信息
```

## Error Handling

### Standard Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: number;
  timestamp: number;
  requestId: string;
  details?: any;
}
```

### Error Codes
- `401` - 未认证或Token无效
- `403` - 权限不足
- `429` - 请求频率超限
- `400` - 请求参数错误
- `500` - 服务器内部错误
- `502` - AcFun API调用失败

## Security Considerations

1. **Token安全**: Token应该包含过期时间和签名验证
2. **本地访问限制**: 仅允许本地访问，拒绝外部请求
3. **敏感信息保护**: 不在响应中暴露敏感的认证信息
4. **日志记录**: 记录所有API访问和异常情况

## Performance Requirements

1. **响应时间**: API响应时间应在100ms内（不包括AcFun API调用时间）
2. **并发处理**: 支持至少10个并发API请求
3. **内存使用**: API代理层内存占用不超过50MB
4. **错误恢复**: API调用失败时能够自动重试和恢复

## Testing Requirements

1. **单元测试**: 覆盖API代理层的核心逻辑
2. **集成测试**: 验证HTTP端点的完整功能
3. **权限测试**: 验证认证和权限控制机制
4. **性能测试**: 验证并发处理和响应时间要求