## 1. Implementation
- [x] 1.1 添加 `packages/main/src/plugins/worker/plugin-worker.js`，实现方法执行与内存上报
- [x] 1.2 更新 `WorkerPoolManager` 路径解析，支持 dist/src 多候选回退
- [x] 1.3 调整 `SecureCommunicationChannel`：忽略非安全消息，签名校验在签名存在时才执行
- [x] 1.4 运行全仓库类型检查：`pnpm -r run typecheck`

## 2. Notes
- 不启动渲染进程开发服务器；不编写/执行测试，严格遵循“静态代码走查与 typecheck”约束。
- 此改动为缺失运行时的修复，属“Bug 修复（恢复预期行为）”，无需 proposal。
- 插件最小导出约定：至少包含 `init()` 与 `cleanup()`；可选提供 `handleMessage(type, payload)` 以响应安全通道消息。

完成日期：2025-11-06
