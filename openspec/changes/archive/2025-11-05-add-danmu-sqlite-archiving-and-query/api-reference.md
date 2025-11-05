# API Reference — Events Query

## GET `/api/events`
- Purpose: 查询事件，支持 `type` 过滤多种事件类型（`danmaku/gift/follow/like/enter/system`）；省略时返回所有类型。支持用户名与主播名关键词过滤。
- Query params:
  - `room_kw` (string) — 主播用户名关键词（模糊匹配）
  - `from_ts` (number) — 起始时间戳（ms）
  - `to_ts` (number) — 结束时间戳（ms）
  - `type` (`NormalizedEventType`) — 事件类型（允许集合：`danmaku/gift/follow/like/enter/system`）。集合传法：`?type=danmaku,gift` 或 `?type=danmaku&type=gift`。
  - `user_kw` (string) — 中文用户名关键词（模糊匹配）
  - `q` (string) — 关键字（`username`/`payload`/`raw_data` 模糊匹配）
  - `page` (number, default `1`, min `1`)
  - `pageSize` (number, default `200`, range `1..1000`)

- Response: `{
    items: NormalizedEvent[],
    total: number,
    page: number,
    pageSize: number,
    hasNext: boolean
  }`

## Optional Alias
- GET `/api/danmu` → 代理 `/api/events?type=danmaku`