## ADDED Requirements

### Requirement: Overlay Wujie Integration
The desktop UI SHALL support rendering overlay pages via Wujie micro-frontend when declared by plugin manifest, while preserving existing overlay behaviors.

#### Scenario: Overlay route loads via Wujie
- **WHEN** user navigates to `/overlay/:overlayId` for an overlay whose plugin manifest declares `overlay.wujie.url`
- **THEN** the overlay is rendered in a Wujie container using the declared URL
- **AND** the overlay operates in an isolated environment with controlled API access
- **AND** OverlayManager manages visibility, z-index, layering, and animations as before

#### Scenario: SPA route initialization for overlay
- **WHEN** `overlay.wujie.spa` is true
- **THEN** the overlay container initializes the child app at `overlay.wujie.route`
- **AND** if `overlay.wujie.route` is missing, the initial route defaults to `/`

#### Scenario: Overlay fallback without Wujie
- **WHEN** the manifest does not declare `overlay.wujie.*`
- **THEN** overlay content renders via existing text/HTML/component modes
- **AND** all overlay behaviors (modal/blocking, click-through, closability) remain functional

### Requirement: SPA Route Declaration for Plugin UI
The desktop UI SHALL respect SPA route declarations from the plugin manifest for plugin UI rendering via Wujie.

#### Scenario: Plugin UI SPA initial route
- **WHEN** the plugin manifest sets `ui.wujie.spa: true` and provides `ui.wujie.route`
- **THEN** `PluginFramePage`/`CentralPluginContainer` initializes the Wujie child app at the declared route
- **AND** navigation within the child app does not affect main application routing

#### Scenario: Default route when unset
- **WHEN** `ui.wujie.spa` is true but `ui.wujie.route` is not provided
- **THEN** the initial child app route defaults to `/`
- **AND** plugin UI continues to operate with isolated DOM/JS context