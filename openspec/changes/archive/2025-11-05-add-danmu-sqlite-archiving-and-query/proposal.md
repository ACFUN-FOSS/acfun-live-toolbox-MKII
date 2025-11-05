## Why
当前工程已在主进程实现了弹幕事件的标准化、SQLite 持久化与 HTTP 查询接口，但这些能力尚未在 OpenSpec 中以规范化的、可验证的要求体现。为保证后续演进与验收的一致性，需要将“弹幕 SQLite 存档与查询接口”以规范增量的形式固化。

## What Changes
- 新增规范要求：直播事件（`danmaku/gift/follow/like/enter/system`）必须被标准化并批量写入 SQLite `events` 表，含必要索引。
- 新增规范要求：对外提供 `/api/events` 查询接口，支持按 `type`（允许集合）及多维过滤分页查询，响应为标准 `NormalizedEvent` 列表；当 `type` 省略时返回所有类型。
- 过滤参数语义调整：`user_id` 改为中文用户名关键词 `user_kw`；`room_id` 改为主播用户名关键词 `room_kw`（模糊匹配）。
- 明确性能与一致性约束：批量写入事务化、默认 1s 刷新窗口，索引保障查询性能。
- 可选增强（非破坏）：提供 `/api/danmu` 别名端点（代理 `/api/events?type=danmaku`），提升语义清晰度。

## Impact
- Affected specs: `specs/danmu-display/spec.md`（覆盖所有事件类型，含点赞、进入等）
- Affected code (参考实现位置，不作为规范的一部分)：
  - `packages/main/src/adapter/AcfunAdapter.ts:863-916`（统一事件标准化并发射）
  - `packages/main/src/rooms/RoomManager.ts:115-150`（事件接收与入队写库）
  - `packages/main/src/persistence/EventWriter.ts:52-121`（批量写入 SQLite）
  - `packages/main/src/persistence/DatabaseManager.ts:31-115`（表结构与索引）
  - `packages/main/src/persistence/QueryService.ts:1-160, 93-132`（查询构造与返回映射）
  - `packages/main/src/server/ApiServer.ts:205-230`（`/api/events` 端点参数与返回）

## Notes
- 本提案不要求立即代码改动；目标是将既有能力规范化，便于后续严格校验与档案化。
- 若未来引入 `/api/danmu` 别名端点，将以 MODIFIED 方式更新规范并补充实现任务。