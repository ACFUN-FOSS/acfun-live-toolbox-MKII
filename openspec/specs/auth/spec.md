# auth Specification

## Purpose
TBD - created by archiving change update-login-qr-auth. Update Purpose after archive.
## Requirements
### Requirement: Client QR Login Flow
客户端应提供稳定可靠的二维码登录流程，通过主进程 IPC 与后端 API 对接，实现创建会话、轮询状态、完成登录与取消流程。

#### Scenario: Create QR session success
- **WHEN** 用户打开登录对话框
- **THEN** 客户端 SHALL 调用 `login.qrStart` 创建会话，获得 `qrDataUrl` 与 `expireAt`
- **AND** UI 在 3 秒内展示二维码与倒计时（单调递减，误差 ≤ ±1s）

#### Scenario: Create QR session failure
- **WHEN** 创建会话失败（网络或服务异常）
- **THEN** 客户端 SHALL 显示错误提示并提供重试与取消入口
- **AND** 不启动轮询与倒计时，状态保持在 `error/idle` 可控范围

#### Scenario: Poll QR status
- **WHEN** 会话进入 `waiting`
- **THEN** 客户端 SHALL 以 ≤1s 间隔调用 `login.qrCheck`
- **AND** 根据服务返回状态切换为 `waiting/scanned/expired/success/error`
- **AND** 任何取消操作 SHALL 立即停止轮询与倒计时

#### Scenario: Scan and finalize success
- **WHEN** 状态切为 `scanned` 并随后 `success`
- **THEN** 客户端 SHALL 调用 `login.qrFinalize`，在 2 秒内刷新 `userInfo` 至全局状态并关闭对话框
- **AND** 不记录明文敏感 token 于日志；必要信息持久化由主进程安全管理

#### Scenario: Expired and refresh
- **WHEN** 二维码过期（`expired`）
- **THEN** UI SHALL 提供刷新入口，重新调用 `login.qrStart` 并重置倒计时锚定
- **AND** 轮询与旧倒计时 SHALL 被终止，避免多计时器并发

#### Scenario: Cancel flow
- **WHEN** 用户点击取消
- **THEN** 客户端 SHALL 调用 `login.qrCancel` 并立即停止轮询与倒计时；状态回到 `idle`

### Requirement: Electron Login API Contract
主进程应在 `window.electronApi.login` 下暴露以下 IPC 合约，并保证类型安全与隔离环境可用：

#### Scenario: API contract
- **WHEN** 渲染层调用 `login.qrStart/login.qrCheck/login.qrFinalize/login.qrCancel`
- **THEN** 主进程 SHALL 正确路由到登录服务并返回结构化结果（包含 `sessionId/status/expireAt/qrDataUrl/userInfo` 等）
- **AND** 错误返回包含稳定的 `code/message` 字段，便于 UI 呈现与退避策略

### Requirement: Countdown Behavior
倒计时应以 `expireAt` 为时间锚定，采用单计时器更新，避免跳变与抖动。

#### Scenario: Monotonic countdown
- **WHEN** 二维码展示且未取消/过期
- **THEN** 倒计时 SHALL 每秒递减并在到期时触发 `expired` 流程
- **AND** 任何刷新或取消 SHALL 重置或终止倒计时，确保无重入计时器

