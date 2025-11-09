## 1. Specification
- [x] 1.1 起草 `proposal.md`（按 AGENTS.md 要求）
- [x] 1.2 编写规范增量：`specs/plugin-system/spec.md` 与 `specs/desktop-ui/spec.md` 使用 SHALL/MUST，并为每条 Requirement 提供至少一个 Scenario
- [x] 1.3 运行严格校验并修复：`openspec validate update-wujie-integration --strict`
- [x] 1.4 提交审批：已提交，获得批准后进入实现阶段

## 2. Implementation (post-approval)
- [x] 2.1 Wujie 事件总线：消费只读 store 的 SSE 更新与主进程生命周期钩子，并在 UI/Overlay/Window 统一转发事件信封
- [x] 2.2 通信约束：实现 UI/Window → Overlay 单向 HTTP 调用（Overlay 通过 Wujie 接收）；禁止 Overlay → UI/Window 直接 HTTP
- [ ] 2.3 Overlay 单实例策略：每个浏览器源仅一个 Overlay（幂等创建，禁止堆叠/层级/隐藏/移除接口暴露）
- [x] 2.4 类型与桥接：补充 `types/global.d.ts` 事件信封类型；完善 `packages/preload/src/index.ts` 桥接函数
- [x] 2.5 文档：更新 `docs/plugin-development.md` 集成指引（Wujie props/shared、SSE/POST 流程）
- [ ] 2.6 静态走查与类型检查：`pnpm -r run typecheck`（仅在实现完成后执行）

## 3. Approval Gate
- 未获批前不进行实现或接口更改，仅提交提案与规范增量。
