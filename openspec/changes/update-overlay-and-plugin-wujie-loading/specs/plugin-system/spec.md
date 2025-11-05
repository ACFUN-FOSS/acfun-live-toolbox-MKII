## ADDED Requirements

### Requirement: Wujie UI Manifest Fields
The plugin manifest SHALL declare Wujie micro-frontend entry for plugin UI with optional SPA routing support.

#### Scenario: Plugin UI Wujie entry declared
- **WHEN** a plugin manifest includes `ui.wujie.url` (string) and optionally `ui.wujie.spa` (boolean) and `ui.wujie.route` (string)
- **THEN** the plugin manager reads and validates these fields
- **AND** the renderer loads the plugin UI via Wujie using `ui.wujie.url`
- **AND** if `ui.wujie.spa` is true, the renderer applies `ui.wujie.route` as the initial internal route (default `/` when unset)
- **AND** the plugin UI runs in an isolated environment with controlled API access

#### Scenario: Fallback when no Wujie fields
- **WHEN** the manifest does not include `ui.wujie.*`
- **THEN** plugin UI falls back to current supported rendering paths
- **AND** existing behavior remains unchanged

### Requirement: Wujie Overlay Manifest Fields
The plugin manifest SHALL declare Wujie micro-frontend entry for overlays with optional SPA routing support.

#### Scenario: Overlay Wujie entry declared
- **WHEN** a plugin manifest includes `overlay.wujie.url` (string) and optionally `overlay.wujie.spa` (boolean) and `overlay.wujie.route` (string)
- **THEN** the plugin manager exposes these fields to the renderer overlay system
- **AND** overlay pages for the plugin load via a Wujie container using `overlay.wujie.url`
- **AND** if `overlay.wujie.spa` is true, the renderer applies `overlay.wujie.route` as the initial internal route (default `/` when unset)
- **AND** overlay content preserves isolation and controlled API access

#### Scenario: Overlay fallback
- **WHEN** the manifest does not include `overlay.wujie.*`
- **THEN** overlay rendering uses existing text/HTML/component modes
- **AND** OverlayManager capabilities (z-index, visibility, animations) remain available