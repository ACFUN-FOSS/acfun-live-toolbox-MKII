## ADDED Requirements

### Requirement: SQLite Archiving of Live Events
The system SHALL persist all normalized live events into a SQLite `events` table, including `danmaku`, `gift`, `follow`, `like`, `enter`, and `system` types.

#### Scenario: Persist normalized live event
- **WHEN** a live event is received and normalized
- **THEN** it MUST be enqueued and written in batch to `events`
- **AND** the row MUST include `type ∈ {danmaku, gift, follow, like, enter, system}`, `room_id`, `timestamp (ts)`, `received_at`, `source='acfun'`, `user_id`, `username`, `payload (content)`, and `raw_data`
- **AND** writes MUST be transactionally committed
- **AND** the default flush interval SHOULD be 1 second and batch size around 100

#### Scenario: Maintain indexes for query performance
- **WHEN** the `events` table exists
- **THEN** the system MUST maintain indexes `idx_events_room_ts (room_id, timestamp)` and `idx_events_type_ts (type, timestamp)`
- **AND** SHOULD maintain additional indexes for `source` and `received_at` as needed

### Requirement: HTTP Query API for Events
The system SHALL expose an HTTP API to query live events using filters and pagination.

#### Scenario: Query events by type and room
- **WHEN** client calls `GET /api/events` with `type` set to any allowed type and a `room_kw`
- **THEN** the system MUST return a paginated list of `NormalizedEvent` items
- **AND** response MUST include `items`, `total`, `page`, `pageSize`, and `hasNext`
- **AND** **WHEN** `type` is omitted, results MUST include all event types

#### Scenario: Time window and user filtering
- **WHEN** `from_ts` and/or `to_ts` are provided
- **THEN** results MUST be constrained to the given timestamp window
- **AND** `user_kw` filter MUST restrict results to users whose `username` contains the given keyword

#### Scenario: Room streamer keyword filtering
- **WHEN** `room_kw` is provided
- **THEN** results MUST be restricted to events belonging to rooms whose streamer username contains the given keyword
- **AND** the system SHALL maintain or access a mapping from `room_id` to streamer username to evaluate this filter

#### Scenario: Keyword search
- **WHEN** `q` is provided
- **THEN** the system MUST apply partial matching on `username`, `payload`, or `raw_data`

#### Scenario: Pagination contract
- **WHEN** `page` and `pageSize` are provided
- **THEN** `page` MUST be `>= 1`
- **AND** `pageSize` MUST be within `1..1000`

#### Scenario: Optional alias endpoint (non-breaking)
- **WHEN** `/api/danmu` is implemented as an alias
- **THEN** it SHALL proxy to `/api/events?type=danmaku` without altering response format