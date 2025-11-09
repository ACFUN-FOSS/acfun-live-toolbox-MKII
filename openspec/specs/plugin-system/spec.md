# plugin-system Specification

## Purpose
TBD - created by archiving change add-a3-plugin-first-desktop-ui. Update Purpose after archive.
## Requirements
### Requirement: Plugin Popup Capability Removal
The system SHALL NOT implement plugin popup BrowserWindow capability. Plugins MUST host user interfaces via in-app router pages or Overlay windows.

#### Scenario: No preload exposure and IPC channels
- **WHEN** inspecting preload API exposure
- **THEN** `window.electronApi.plugin.popup.*` MUST NOT be present
- **AND** corresponding `plugin.popup.*` IPC channels MUST NOT exist in the main process

#### Scenario: Overlay and router alternatives remain supported
- **WHEN** plugins require UI surfaces
- **THEN** overlay API via `window.electronApi.overlay.*` SHALL provide only `send` and `action` exposures
- **AND** router-based plugin frames SHALL remain available via `/plugins/:id`

### Requirement: Plugin UI Integration
The system SHALL integrate plugin user interfaces seamlessly into the main desktop application using micro-frontend technology.

#### Scenario: Plugin route loading
- **WHEN** user selects a plugin from the navigation
- **THEN** the plugin's main route is loaded in the central container via Wujie
- **AND** the plugin operates with isolated DOM and JavaScript context
- **AND** plugin loading states are displayed during initialization

#### Scenario: Plugin settings page embedding
- **WHEN** user accesses plugin settings
- **THEN** the plugin's settings interface is embedded in the main application
- **AND** settings changes are persisted through the plugin API
- **AND** settings validation occurs within the plugin context

### Requirement: Plugin Installation Management
The system SHALL provide comprehensive plugin installation and management capabilities through the desktop interface with full implementation of file handling, validation, and lifecycle management.

#### Scenario: Local plugin import
- **WHEN** user clicks the "Install Plugin" button in the plugin navigation
- **THEN** a file picker dialog opens accepting .zip and .tar.gz plugin archives
- **AND** the selected file is validated for proper plugin structure and manifest.json
- **AND** plugin dependencies are checked against available APIs and existing plugins
- **AND** installation proceeds with real-time progress indication and user confirmation
- **AND** the plugin is extracted to the designated plugins directory
- **AND** plugin metadata is registered in the plugin manager
- **AND** the plugin appears in the navigation upon successful installation

#### Scenario: Plugin manifest validation
- **WHEN** a plugin file is selected for installation
- **THEN** the manifest.json file is extracted and parsed
- **AND** required fields (name, version, main, api_version) are validated
- **AND** plugin dependencies are checked for compatibility
- **AND** conflicting plugins are detected and reported
- **AND** installation is blocked if validation fails with clear error messages

#### Scenario: Plugin enable/disable control
- **WHEN** user toggles plugin enabled state in the navigation
- **THEN** the plugin state is persisted in the plugin configuration
- **AND** enabled plugins are loaded and initialized on application startup
- **AND** disabled plugins are excluded from loading but remain installed
- **AND** plugin UI elements are dynamically added or removed from navigation
- **AND** plugin background processes are started or stopped accordingly

#### Scenario: Plugin uninstallation
- **WHEN** user selects uninstall option for a plugin
- **THEN** a confirmation dialog is displayed with plugin details
- **AND** plugin files are removed from the plugins directory upon confirmation
- **AND** plugin metadata is removed from the plugin manager
- **AND** plugin configuration and data are optionally preserved or removed
- **AND** the plugin is removed from navigation immediately

### Requirement: Plugin Lifecycle UI Feedback
The system SHALL provide clear visual feedback for plugin states and operations through the desktop interface.

#### Scenario: Plugin loading indication
- **WHEN** a plugin is being loaded or initialized
- **THEN** appropriate loading indicators are displayed in the navigation and container
- **AND** error states are clearly communicated if loading fails
- **AND** retry options are available for failed plugin loads

#### Scenario: Plugin error handling
- **WHEN** a plugin encounters runtime errors
- **THEN** error information is displayed without crashing the main application
- **AND** the plugin can be reloaded or disabled from the interface
- **AND** error details are logged for debugging purposes

### Requirement: Plugin API Bridge Enhancement
The system SHALL extend the existing plugin API bridge to support UI integration and enhanced plugin management.

#### Scenario: UI-specific API exposure
- **WHEN** plugins request UI-related capabilities
- **THEN** the API bridge provides controlled access to navigation updates
- **AND** plugins can register custom menu items or shortcuts
- **AND** UI operations are sandboxed to prevent interference with core interface

#### Scenario: Plugin metadata management
- **WHEN** plugins are installed or updated
- **THEN** plugin metadata (name, version, description, icon) is managed by the bridge
- **AND** metadata is used for navigation display and plugin identification
- **AND** metadata validation ensures consistency and security

### Requirement: Plugin Storage Management
The system SHALL provide secure and organized storage for plugin files, configurations, and runtime data.

#### Scenario: Plugin directory structure
- **WHEN** the application initializes
- **THEN** a dedicated plugins directory is created in the application data folder
- **AND** each installed plugin has its own subdirectory with proper isolation
- **AND** plugin configurations are stored in a centralized configuration file
- **AND** plugin runtime data is isolated per plugin to prevent conflicts

#### Scenario: Plugin configuration persistence
- **WHEN** plugin settings are modified
- **THEN** configuration changes are immediately persisted to disk
- **AND** configuration is validated before saving to prevent corruption
- **AND** backup configurations are maintained for rollback capability
- **AND** plugin-specific data is isolated from other plugins and core application data

### Requirement: Plugin Installation Error Handling
The system SHALL provide comprehensive error handling and recovery mechanisms for plugin installation and management operations.

#### Scenario: Installation failure recovery
- **WHEN** plugin installation fails at any stage
- **THEN** partial installation artifacts are cleaned up automatically
- **AND** detailed error information is displayed to the user
- **AND** the plugin manager state remains consistent
- **AND** retry options are provided for recoverable errors

#### Scenario: Corrupted plugin detection
- **WHEN** a plugin file is corrupted or incomplete
- **THEN** the corruption is detected during validation
- **AND** installation is prevented with clear error messaging
- **AND** existing plugin installations are not affected
- **AND** the user is guided to obtain a valid plugin file

#### Scenario: Plugin conflict resolution
- **WHEN** installing a plugin that conflicts with existing plugins
- **THEN** conflicts are detected and clearly reported
- **AND** options for resolution are presented (update, replace, or cancel)
- **AND** the user can make informed decisions about conflict resolution
- **AND** plugin dependencies are rechecked after conflict resolution

### Requirement: Bundled Example Plugin Visibility in Management List
系统 SHALL 在插件管理页面展示所有已安装插件，包括默认随包示例插件，即使其初始状态为禁用（inactive）。

#### Scenario: Example plugin listed when installed but disabled
- WHEN 应用启动后自动安装示例插件（如 `base-example`），且其配置为 `enabled: false`
- THEN 插件管理页面的列表 SHALL 显示该插件，状态为 `inactive`

#### Scenario: HTTP fallback lists plugins when IPC is unavailable
- WHEN 渲染层无法访问 `window.electronApi.plugin`
- THEN 渲染层 SHALL 使用 `GET /api/plugins` 回退接口获取插件列表并正确映射状态

#### Scenario: Consistent field mapping for UI rendering
- WHEN 插件列表包含 `id/name/version/description/author/enabled/status/installedAt/manifest`
- THEN 渲染层 SHALL 将 `enabled/active` 映射为 `active`，`installed/disabled/inactive` 映射为 `inactive`，错误态映射为 `error`

### Requirement: Plugin Popup Capability Not Implemented
The system SHALL NOT provide a BrowserWindow-based plugin popup capability.

#### Scenario: No popup API exposed
- **WHEN** a plugin attempts to access `window.electronApi.plugin.popup.*`
- **THEN** such APIs SHALL NOT be present or SHALL respond with a standardized "not supported" indication.

#### Scenario: No popup IPC channels
- **WHEN** inspecting preload/main IPC handlers for `plugin.popup.*`
- **THEN** no such channels SHALL exist in the implementation.

#### Scenario: Overlay remains available
- **WHEN** a plugin requires floating UI behavior
- **THEN** the overlay capability remains available and SHALL be used as the recommended alternative.

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
UI/Window MUST send informational or control requests to Overlay via HTTP message endpoint; Overlay SHALL accept messages via SSE (from message center) and MAY emit acknowledgement via Wujie event bus. Overlay MUST NOT initiate direct HTTP requests to UI or Window.

#### Scenario: UI triggers overlay effect via HTTP
- **WHEN** UI performs `POST /api/plugins/<pluginId>/overlay/messages`
- **THEN** DataManager enqueues the message and SSE routes it to Overlay; Overlay applies changes
- **AND** Overlay MAY emit `{ type: 'overlay-ack', event, payload }` via Wujie, not HTTP

### Requirement: Single Overlay Instance per Browser Source
Each browser source MUST load exactly one Overlay instance. Overlay management SHALL be idempotent and MUST NOT expose creation/hide/remove/layer stacking operations.

#### Scenario: Duplicate overlay creation request
- **WHEN** a request attempts to create another overlay for the same browser source
- **THEN** the system SHALL reuse the existing instance and MUST NOT create a second one
- **AND** the system MAY return an idempotent success with the existing `overlayId`

### Requirement: Example Overlay Demo Layout and Telemetry
The example plugin overlay page MUST render a two-pane layout using shared theme CSS variables. The left pane MUST display the readonly-store overlay slice from SSE `init`/`update`, and the right pane MUST show a live message feed. The overlay MUST update the snapshot on `init`/`update` without reload and MUST append incoming `message` events with timestamps.

#### Scenario: Render snapshots on init/update
- **WHEN** an SSE `init` event is received
- **THEN** the overlay renders the initial readonly-store overlay slice
- **AND WHEN** an SSE `update` event is received
- **THEN** the overlay updates the snapshot view without a full reload

#### Scenario: Display messages pushed from UI
- **WHEN** the desktop UI sends a payload via `POST /api/plugins/<pluginId>/overlay/messages`
- **THEN** the overlay appends the payload to the messages pane with a timestamp

### Requirement: Overlay Presence and Heartbeat
The overlay MUST report presence lifecycle events to the main process via `POST /api/plugins/<pluginId>/overlay/action` using action types `overlay-loaded` and `overlay-unloaded`. Heartbeats SHALL be tracked via SSE connections.

#### Scenario: Report presence on load
- **WHEN** the overlay completes bootstrapping
- **THEN** it POSTs an action `overlay-loaded` to `/api/plugins/<pluginId>/overlay/action` (including its `overlayInstanceId` in payload if applicable) and receives a 2xx response

#### Scenario: Report offline on unload
- **WHEN** the overlay is unloading (e.g., browser source removed or page closed)
- **THEN** it POSTs an action `overlay-unloaded` to `/api/plugins/<pluginId>/overlay/action` and receives a 2xx response

#### Scenario: SSE heartbeat updates presence
- **WHEN** the SSE connection `GET /sse/plugins/<pluginId>/overlay` is active
- **THEN** the server updates heartbeat timestamps and online status on each heartbeat event

### Requirement: Message Handling Semantics
The overlay MUST treat incoming messages as an append-only feed for the demo window and MUST not mutate the readonly-store snapshot in response to `message` events.

#### Scenario: Keep snapshot immutable on message
- **WHEN** a `message` event arrives with arbitrary payload
- **THEN** the overlay updates only the messages pane and leaves the readonly snapshot unchanged

### Requirement: Central Message Center for Plugin Overlay
The system SHALL use a unified main-process message center (DataManager) to publish/subscribe plugin events: store updates, lifecycle notifications, and overlay messages.

#### Scenario: UI sends message before overlay opens
- **WHEN** a UI/window posts `POST /api/plugins/<pluginId>/overlay/messages` with a payload
- **THEN** the main-process enqueues the message under `<pluginId>` with a unique `id` and `timestamp`
- **AND WHEN** the overlay connects to `GET /sse/plugins/<pluginId>/overlay`
- **THEN** the queued messages are delivered in order, at-least-once, with replay support

#### Scenario: Overlay reconnects and resumes
- **WHEN** an overlay reconnects using SSE with `Last-Event-ID`
- **THEN** the server resumes delivery from the last acknowledged `id`
- **AND** missing messages within the retention window SHALL be replayed
