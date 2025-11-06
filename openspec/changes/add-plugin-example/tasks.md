## 1. Implementation
- [ ] 1.1 脚手架 `plugins/example-plugin-pro/` 目录结构（manifest、index.js、overlay、settings）
- [ ] 1.2 在 `index.js` 实现生命周期钩子（load/unload）与事件订阅、业务处理示例
- [ ] 1.3 集成弹窗（popup）示例代码，调用现有公开接口或 IPC 网关
- [ ] 1.4 实现设置页面（settings）静态资源与入口，并与 manifest 关联
 - [ ] 1.5 实现 Overlay 资源（HTML/CSS/JS）与消息交互（例如 `window.postMessage` 或既有 overlay API）
 - [x] 1.6 文档更新：补充 `docs/plugin-development.md` 与 `README.md` 的示例说明与清单字段
 - [x] 1.7 运行静态类型检查与代码走查（不编写/执行测试）：`pnpm run typecheck:all`
- [ ] 1.8 OpenSpec 严格校验：`openspec validate add-plugin-example --strict`

## 2. Notes
- 不改变现有核心行为；示例以最小侵入方式挂载。
- 遵循仓库约束：不启动渲染进程开发服务器；测试仅限静态代码走查与 typecheck。
