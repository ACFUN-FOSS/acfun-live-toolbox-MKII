## 1. Implementation
- [ ] 1.1 搭建首页右侧容器为 2×2 栅格（TDesign `t-row`/`t-col`，每列 `span=6`）。
- [ ] 1.2 实现 A/B/C/D 四张卡片的骨架、加载、错误与空态逻辑（分卡片独立）。
- [ ] 1.3 接入全局状态：`auth/role/statsScope/ui.loading/ui.error` 与头像下拉角色切换联动卡片重渲染。
- [ ] 1.4 接入端点与传输选择器：按角色并行请求 C 卡历史数据、B 卡用户信息、D 卡文档列表；遵循 `request/response_transform`。
- [ ] 1.5 首次登录角色选择对话框：无持久化角色时弹出、确认后持久化并关闭；与头像下拉保持一致行为。
- [ ] 1.6 路由跳转：A 卡主 CTA（主播→`/stream/start`，房管→`/rooms`，开发→`/debugger`）；C 卡房管“查看更多”→`/rooms`；D 卡“查看更多”→`/docs`（新标签）。
- [ ] 1.7 视口验证 视口右侧无纵向滚动，卡片完整可见。
- [ ] 1.8 样式约束：无固定像素、分数单位、12列栅格、`card_span=6`、`header_fraction=0.2`/`body_fraction=0.8`、文本截断（单行/签名两行）。
- [ ] 1.9 Header 右侧头像下拉：`t-avatar + t-dropdown` 支持“切换角色/登出”，切换更新 `role.current` 并重渲染 A/B/C/D。
- [ ] 1.10 移除右侧持久化顶部快捷操作条（仅右侧区域）。
- [ ] 1.11 引导序列：实现 `GET_ROLE → GET_USER → (按角色并行) GET_ANCHOR_STATS/GET_MOD_ROOMS/GET_DEV_METRICS → GET_DOCS`。
- [ ] 1.12 错误处理映射：按卡片独立横幅 + 重试；`401` 在 B 显示登录按钮，其他卡显示空态 + 单 CTA。
- [ ] 1.13 字段与交互细节：UID 可复制并 `t-message.success` 提示；粉丝数 `formatCompact`；签名空态“暂无签名”与两行截断。
- [ ] 1.14 C 卡细节：主播（最近一次直播/区间统计/礼物数）、房管（最多2房间 + “查看更多”可见性）、开发（错误/消息/唯一错误类型，空态“去调试”）。
- [ ] 1.15 D 卡细节：展示前 3 条文档项，`target='_blank'` 打开；“查看更多”跳转 `/docs`。
- [ ] 1.16 传输选择器：优先 IPC，失败回退 HTTP，最后 Mock；严格遵循 `request_transform/response_transform`。
- [ ] 1.17 开发模式 Mock Server：接入 `latency_ms_range`、`error_rate` 与 `seed` 配置，保障演示一致性。

## 2. Validation
- [ ] 2.1 手动验证卡片加载/错误/空态独立工作，不相互阻塞。
- [ ] 2.2 手动验证角色切换与 `7d/30d` 切换对数据加载范围的影响仅作用于 C 卡。
- [ ] 2.3 手动验证 UID 复制反馈、签名两行截断与粉丝数紧凑格式。
- [ ] 2.4 手动验证“无滚动”约束与 2×2 栅格填充布局。
- [ ] 2.5 验证引导序列执行顺序与并行加载行为。
- [ ] 2.6 验证传输选择器 IPC→HTTP→Mock 的回退逻辑与字段映射正确。
- [ ] 2.7 验证右侧无持久化顶部快捷操作条。
- [ ] 2.8 验收准则逐条对照 `ui-main.json.acceptance_criteria`。

## 3. Notes
- 不改动左侧导航结构与 Header 外壳；不新增或变更顶层 Topbar。
- 测试遵循项目约束：不创建新的自动化测试用例，使用真实请求，严禁 mock。
- 传输策略：优先 IPC，失败回退 HTTP，最后 mock（按端点标注）。