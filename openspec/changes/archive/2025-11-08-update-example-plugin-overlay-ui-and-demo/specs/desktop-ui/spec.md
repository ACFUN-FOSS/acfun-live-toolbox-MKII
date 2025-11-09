## ADDED Requirements

### Requirement: Overlay Demo Panel Status Display
The desktop UI MUST show the current registration status for the selected overlay (`registered` / `unregistered`). The status SHOULD update in real time.

#### Scenario: Update status via SSE action
- **WHEN** an SSE event with `eventType: 'action'` and `type: 'overlay-registered'` arrives
- **THEN** the UI shows the overlay as `registered`
- **AND WHEN** a subsequent event with `type: 'overlay-unregistered'` arrives
- **THEN** the UI shows the overlay as `unregistered`

#### Scenario: Fallback via IPC broadcast
- **WHEN** SSE action forwarding is unavailable
- **THEN** the UI subscribes to a main-process IPC broadcast `overlay.action`
- **AND** mirrors status updates based on the broadcast payloads

### Requirement: Message Input and Send
The desktop UI MUST provide a text input and a send button to push messages to the overlay via `overlay.send(overlayId, 'demo-message', payload)` or `POST /api/overlay/:overlayId/send`.

#### Scenario: Send message and overlay displays it
- **WHEN** the user enters text and clicks the send button
- **THEN** the UI calls `overlay.send(overlayId, 'demo-message', { text })`
- **AND** the overlay messages pane displays the content via SSE `message`

### Requirement: Overlay Link Generation and Copy
The desktop UI MUST generate the overlay URL and provide copy-to-clipboard functionality, preserving required query parameters (e.g., room, token).

#### Scenario: Copy URL to clipboard
- **WHEN** the user clicks `Copy link`
- **THEN** the overlay URL (with required params) is written to the clipboard

