# plugin-system Specification

## Purpose
TBD - created by archiving change add-a3-plugin-first-desktop-ui. Update Purpose after archive.
## Requirements
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

