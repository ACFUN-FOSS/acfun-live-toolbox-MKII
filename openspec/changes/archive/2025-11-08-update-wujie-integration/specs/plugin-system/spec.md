## ADDED Requirements

### Requirement: Wujie Event Bus Integration
Wujie SHALL act as the framework event bus to bridge readonly store SSE updates and main-process lifecycle/event hooks into plugin contexts (UI, Overlay, Window). Plugins MUST consume a unified event envelope and MUST NOT mutate readonly data.

#### Scenario: Store change SSE → plugin contexts
- **WHEN** the readonly store emits a change via SSE
- **THEN** Wujie re-emits an envelope `{ type: 'store-change', payload }` to UI, Overlay, and Window contexts
- **AND** plugins SHALL handle the unified structure without direct SSE handling

#### Scenario: Main lifecycle hook propagation
- **WHEN** the main process emits lifecycle/event hooks
- **THEN** Wujie broadcasts `{ type: 'main-lifecycle', hook, payload }` to all plugin contexts
- **AND** plugins MUST receive consistently via Wujie event bus

### Requirement: One-way UI/Window → Overlay communication
UI/Window MUST send informational or control requests to Overlay via HTTP endpoints; Overlay SHALL accept requests through Wujie and MAY emit acknowledgement via Wujie event bus. Overlay MUST NOT initiate direct HTTP requests to UI or Window.

#### Scenario: UI triggers overlay effect via HTTP
- **WHEN** UI performs `POST /api/overlay/:overlayId/action` or equivalent helper
- **THEN** Wujie routes the effect to Overlay; Overlay applies changes
- **AND** Overlay MAY emit `{ type: 'overlay-ack', event, payload }` via Wujie, not HTTP

### Requirement: Single Overlay Instance per Browser Source
Each browser source MUST load exactly one Overlay instance. Overlay management SHALL be idempotent and MUST NOT expose creation/hide/remove/layer stacking operations.

#### Scenario: Duplicate overlay creation request
- **WHEN** a request attempts to create another overlay for the same browser source
- **THEN** the system SHALL reuse the existing instance and MUST NOT create a second one
- **AND** the system MAY return an idempotent success with the existing `overlayId`

