## ADDED Requirements

### Requirement: Example Overlay Demo Layout and Telemetry
The example plugin overlay page MUST render a two-pane layout using shared theme CSS variables. The left pane MUST display the readonly-store overlay slice from SSE `init`/`update`, and the right pane MUST show a live message feed. The overlay MUST update the snapshot on `init`/`update` without reload and MUST append incoming `message` events with timestamps.

#### Scenario: Render snapshots on init/update
- **WHEN** an SSE `init` event is received
- **THEN** the overlay renders the initial readonly-store overlay slice
- **AND WHEN** an SSE `update` event is received
- **THEN** the overlay updates the snapshot view without a full reload

#### Scenario: Display messages pushed from UI
- **WHEN** the desktop UI sends a payload via `overlay.send(overlayId, 'demo-message', payload)` or `POST /api/overlay/:overlayId/send`
- **THEN** the overlay appends the payload to the messages pane with a timestamp

### Requirement: Overlay Registration Lifecycle Reporting
The overlay MUST report registration and unregistration lifecycle events to the main process via `POST /api/overlay/:overlayId/action` using action types `overlay-registered` and `overlay-unregistered`.

#### Scenario: Report registration on load
- **WHEN** the overlay completes bootstrapping
- **THEN** it POSTs an action `overlay-registered` to `/api/overlay/:overlayId/action` and receives a 2xx response

#### Scenario: Report unregistration on unload
- **WHEN** the overlay is unloading (e.g., browser source removed or page closed)
- **THEN** it POSTs an action `overlay-unregistered` to `/api/overlay/:overlayId/action` and receives a 2xx response

### Requirement: Message Handling Semantics
The overlay MUST treat incoming messages as an append-only feed for the demo window and MUST not mutate the readonly-store snapshot in response to `message` events.

#### Scenario: Keep snapshot immutable on message
- **WHEN** a `message` event arrives with arbitrary payload
- **THEN** the overlay updates only the messages pane and leaves the readonly snapshot unchanged

