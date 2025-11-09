## ADDED Requirements

### Requirement: Renderer Frame Pass-through (Wujie eventBus)
Renderer frames SHALL only relay store updates, lifecycle events, and inter-end messages to inner HTML via Wujie eventBus using namespaced event names.

#### Scenario: Store update relay
- WHEN main-process publishes a store update for `<pluginId>`,
- THEN the frame receives it via IPC and `$emit('plugin:<pluginId>:store-update', payload)` to the inner page.

#### Scenario: Lifecycle relay
- WHEN main-process publishes a lifecycle event (start/login/begin-live/fetch-danmu/stop-live/logout/stop-danmu/exit) for `<pluginId>`,
- THEN the frame `$emit('plugin:<pluginId>:lifecycle', payload)` to the inner page.

#### Scenario: Inter-end message relay (UI/window → overlay)
- WHEN UI/window sends a message via HTTP `POST /api/plugins/<pluginId>/overlay/messages`,
- THEN the message center delivers it over SSE to the overlay frame,
- AND the frame `$emit('plugin:<pluginId>:overlay-message', payload)` to the inner overlay HTML.

### Requirement: Overlay Link and SSE Base Alignment
UI SHALL build overlay links and SSE URLs using the ApiServer base from bridge (`get-api-base`).

#### Scenario: Build overlay link
- WHEN UI needs an overlay link for `<pluginId>`,
- THEN it uses `/overlay-wrapper?plugin=<pluginId>&type=overlay` on the Api base,
- AND copies the absolute URL for use in OBS browser source.

#### Scenario: SSE subscription in frame
- WHEN overlay frame subscribes to messages,
- THEN it opens `GET /sse/plugins/<pluginId>/overlay` on the Api base and relies on SSE auto-reconnect with `Last-Event-ID`,
- AND re-emits all incoming SSE messages to inner HTML via Wujie eventBus.

## MODIFIED Requirements

### Requirement: Remove manual overlay controls in UI
UI SHALL not expose manual overlay lifecycle controls (create/update/close/show/hide/bring-to-front/list).

#### Scenario: Message-only controls
- WHEN users interact with UI/window to send messages to overlay,
- THEN the frame forwards a message request to the main-process via HTTP/IPC; no lifecycle controls are shown.
