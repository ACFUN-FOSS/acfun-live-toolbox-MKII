# Desktop UI Spec Delta

## MODIFIED Requirements

### Requirement: Authentication Interface
桌面应用MUST提供用户认证界面，支持AcFun账号登录和登出功能，认证状态通过统一的TokenManager管理

#### Scenario: User login through unified token manager
- **WHEN** 用户通过UI进行登录操作
- **THEN** 系统必须通过TokenManager处理认证流程
- **AND** 确保认证状态在全局范围内统一管理

#### Scenario: User logout through unified token manager
- **WHEN** 用户通过UI进行登出操作
- **THEN** 系统必须通过TokenManager清除认证状态
- **AND** 确保所有模块同步更新认证状态

### Requirement: Authentication State Display
界面MUST实时显示TokenManager管理的认证状态和用户信息，并响应token状态变更事件

#### Scenario: Display unified authentication state
- **WHEN** UI需要显示当前认证状态
- **THEN** 系统必须从TokenManager获取统一的认证状态
- **AND** 显示一致的用户信息

#### Scenario: Respond to token state changes
- **WHEN** TokenManager发出token状态变更事件
- **THEN** UI必须立即更新显示的认证状态和用户信息
- **AND** 确保界面状态与实际认证状态保持同步