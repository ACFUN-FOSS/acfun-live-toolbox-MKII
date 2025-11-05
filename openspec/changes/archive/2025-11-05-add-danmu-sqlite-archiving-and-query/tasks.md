## 1. Implementation
- [x] 1.1 验证标准化类型映射覆盖 `danmaku/gift/follow/like/enter/system`
- [x] 1.2 确认批量写入事务化与 1s 刷新窗口的执行
- [x] 1.3 校验 `events` 表索引（`room_id+timestamp`, `type+timestamp` 等）存在
- [x] 1.4 `/api/events` 支持 `type`（允许集合）、`room_kw`（主播用户名关键词）、时间窗、`user_kw`（中文用户名关键词）、`q` 过滤与分页；省略 `type` 时返回所有类型
- [x] 1.5 文档补充 API 入参约束与返回结构（NormalizedEvent 列表 + 统计字段）
- [x] 1.6 在查询实现中将 `user_kw` 映射为 `username LIKE` 模糊匹配
- [x] 1.7 在查询实现中将 `room_kw` 解析为房间ID集合（通过主播用户名映射），再过滤 `events.room_id IN (...)`

## 2. Optional Enhancements
- [ ] 2.1 设计 `/api/danmu` 别名端点（代理 `/api/events?type=danmaku`）
- [ ] 2.2 评估 `q` 关键字查询的性能（必要时添加 FTS 或虚拟列索引）
- [ ] 2.3 编制数据保留与清理策略（VACUUM/归档周期）