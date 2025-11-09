## ADDED Requirements

### Requirement: Central Message Center for Plugin Overlay
The system SHALL use a unified main-process message center (DataManager) to publish/subscribe plugin events: store updates, lifecycle notifications, and overlay messages.

#### Scenario: UI sends message before overlay opens
- WHEN a UI/window posts `POST /api/plugins/<pluginId>/overlay/messages` with a payload,
- THEN the main-process enqueues the message under `<pluginId>` with a unique `id` and `timestamp`,
- AND WHEN the overlay connects to `GET /sse/plugins/<pluginId>/overlay`,
- THEN the queued messages are delivered in order, at-least-once, with replay support.

#### Scenario: Overlay reconnects and resumes
- WHEN an overlay reconnects using SSE with `Last-Event-ID`,
- THEN the server resumes delivery from the last acknowledged `id`,
- AND missing messages within the retention window SHALL be replayed.

### Requirement: Overlay Presence and Heartbeat
Overlays SHALL report presence via action endpoints and receive heartbeat via SSE.

#### Scenario: Overlay-loaded/unloaded
- WHEN overlay loads, it posts `POST /api/plugins/<pluginId>/overlay/action` with `type=overlay-loaded`,
- THEN the message center marks overlay as online and flushes the queue.
- WHEN overlay unloads, it posts `type=overlay-unloaded`,
- THEN the message center marks overlay as offline and buffers subsequent messages.

## MODIFIED Requirements

### Requirement: Overlay Lifecycle Semantics (Link-driven)
Overlays SHALL be created and closed implicitly by the browser source loading/unloading the overlay link; manual lifecycle APIs are deprecated.

#### Scenario: Link creates overlay
- WHEN a browser source (e.g., OBS) loads `/overlay-wrapper?plugin=<pluginId>&type=overlay`,
- THEN the overlay is considered created and connects to SSE.

#### Scenario: Close by unloading link
- WHEN the browser source closes the overlay link,
- THEN the overlay is considered closed; any subsequent messages are buffered until next load.

### Requirement: Message-only Overlay API
The overlay API SHALL provide only message send and action endpoints; manual create/close/update/show/hide/bring-to-front/list are no-ops.

#### Scenario: Send message
- WHEN UI/window calls `electronApi.overlay.send(pluginId, payload)` or POSTs to `/api/plugins/<pluginId>/overlay/messages`,
- THEN the message is enqueued and delivered via SSE to the overlay.

