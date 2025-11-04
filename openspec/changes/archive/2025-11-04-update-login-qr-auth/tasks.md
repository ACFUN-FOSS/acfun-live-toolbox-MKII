## 1. Implementation
- [x] 1.1 主进程：实现登录 IPC（`login.qrStart/login.qrCheck/login.qrFinalize/login.qrCancel`）并对接 `acfunlive-http-api` 的 `AuthService`
- [x] 1.2 预加载层：在 `window.electronApi.login.*` 暴露类型安全 API（确保 `contextIsolation` 与最小暴露）
- [x] 1.3 渲染层 Store：重构 `useAccountStore` 的 QR 会话状态机与单通道轮询；支持取消与错误退避
- [x] 1.4 渲染层 UI：修复二维码对话框的倒计时（基于 `expireAt` 单调递减），完善刷新/取消/错误提示
- [x] 1.5 登录成功：调用 `finalize` 后刷新 `userInfo`（2s 内），持久化必要信息（不记录敏感 token）
- [x] 1.6 类型与契约：补充类型定义（global.d.ts / interface.ts），对齐 IPC 合约
- [x] 1.7 观测与日志：在主/渲染进程完善日志（创建/轮询/终止/错误），方便诊断
- [x] 1.8 静态检查：`pnpm -r run typecheck`（不编写/运行测试；仅静态走查与类型检查）
- [ ] 1.9 UI 预览：启动渲染进程 dev server 并打开预览，核对登录对话框交互与倒计时
- [x] 1.10 文档与状态：更新 `ui2.json` 的 `implementation_status` 与task.md

## 2. Rollback Plan
- 若主进程对接失败，暂时回退到旧逻辑但保留新 Store 状态机（降级轮询与提示）
- 记录失败原因并在 `SystemPage` 中提示诊断方向（网络、API 变更、凭证失效）

## 3. Non-Goals
- 不涉及二次认证（2FA）、多账号管理、离线登录
- 不引入新的外部依赖（除非 `acfunlive-http-api` 版本对齐所需）

备注：1.9 UI 预览受运行约束限制（不启动渲染进程 dev server），暂未执行。