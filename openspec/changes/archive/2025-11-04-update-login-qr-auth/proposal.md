## Why
当前客户端登录功能存在可用性问题：
- 二维码经常刷新不出来或状态异常。
- 登录成功后未正确获取用户信息并更新全局状态。
- 倒计时显示出现跳跃、卡顿，体验不佳。

这些问题导致首屏登录流程不可靠、易误导用户，需要优化协议对接、状态管理和 UI 交互以达到可用稳定状态。

## What Changes
- 主进程：新增登录服务桥接，统一 `login.qrStart / login.qrCheck / login.qrFinalize / login.qrCancel` IPC 合约；对接 `acfunlive-http-api` 的 `AuthService`；完善错误处理与日志记录。
- 预加载层：在 `window.electronApi.login.*` 暴露类型安全的接口，确保 `contextIsolation` 环境下无泄漏且 API 可用。
- 渲染层（Pinia + 组件）：
  - 重构 `useAccountStore` 的 QR 会话状态机（idle/loading/waiting/scanned/expired/error/success）。
  - 登录成功后主动刷新 `userInfo` 并落库（通过主进程 Token 管理或 API 再取一次）。
  - 修复倒计时为单调递减的时间锚定（基于 `expireAt` 计算），避免多计时器竞争造成跳变。
  - 轮询统一为单通道，具备取消与错误退避（短暂网络异常 → 指数退避，UI 不抖动）。
  - UI 对话框支持刷新二维码、取消登录、错误提示与重试。
- 文档与规格：新增 `auth` 能力规范，补充客户端 QR 登录流程的可靠性与 UX 要求；更新 `ui2.json` 实现状态。

## Impact
- 受影响规范：新增 `specs/auth` 能力；关联 `desktop-ui` 登录页/对话框。
- 受影响代码：
  - `packages/main/src/server|ipc|bootstrap`：登录 IPC 与 Token/OAuth 管理。
  - `packages/preload/src`：暴露 `electronApi.login` 接口。
  - `packages/renderer/src/stores/account.ts`：状态机与 `userInfo` 刷新逻辑。
  - `packages/renderer/src/pages/HomePage.vue`：登录对话框的交互与倒计时显示。
- 非目标（Non-Goals）：
  - 多账号切换、二次认证（2FA）
  - 服务端策略或权限体系变更
  - 复杂的离线登录与缓存同步

## Acceptance Criteria
- 首次打开登录对话框 3s 内展示二维码（若失败给出明确可重试的错误）。
- 轮询状态平滑可靠：waiting→scanned→success/expired，取消后立即停止所有计时与请求。
- 登录成功后 `userInfo` 在 2s 内更新到全局状态并关闭对话框。
- 倒计时单调递减，最大误差不超过 ±1s；刷新二维码后倒计时重新锚定。
- 全流程在开发与发行模式下均可用（无未捕获异常、无界面卡顿）。