## ADDED Requirements

### Requirement: Overlay Presence per Browser Source
The desktop UI SHALL mount exactly one overlay per browser source. The UI MUST NOT implement overlay stacking, z-index layer management, or multi-overlay toggles.

#### Scenario: Single overlay across navigation
- **WHEN** the user navigates between plugin pages or toggles visibility
- **THEN** the system SHALL keep one overlay instance for the source
- **AND** MUST NOT create additional overlays nor expose stacking APIs

### Requirement: Wujie Acceptance in Overlay
The overlay context MUST accept UI/Window requests through Wujie. UI/Window MUST use HTTP endpoints to request overlay actions; reverse HTTP from Overlay to UI/Window MUST NOT exist.

#### Scenario: UI → Overlay request path via Wujie
- **WHEN** UI calls an overlay action through HTTP
- **THEN** Wujie SHALL route the action into the overlay context
- **AND** the overlay SHALL process it and MAY emit events via Wujie back to UI/Window

