# Desktop UI Specification

## ADDED Requirements

### Requirement: Plugin-First Main Layout
The system SHALL provide a plugin-first desktop interface that prioritizes plugin access and real-time danmu display over traditional page navigation.

#### Scenario: User opens application
- **WHEN** user launches the desktop application
- **THEN** the main interface displays with plugin navigation on the left, danmu bar on top, and central plugin container
- **AND** the default view shows available plugins or a welcome screen

#### Scenario: Plugin container displays content
- **WHEN** user selects a plugin from the navigation
- **THEN** the central container loads the plugin interface using Wujie micro-frontend
- **AND** the plugin operates in an isolated environment with controlled API access

### Requirement: Real-time Danmu Display
The system SHALL display real-time danmu (bullet chat) from all connected rooms in a prominent top bar.

#### Scenario: Danmu received from connected room
- **WHEN** a new danmu message is received from any connected room
- **THEN** the message appears in the top danmu bar with smooth scrolling animation
- **AND** the message includes room identifier, username, and content
- **AND** messages automatically scroll and fade after display duration

#### Scenario: Multiple room danmu handling
- **WHEN** multiple rooms are connected and sending danmu simultaneously
- **THEN** messages from all rooms are merged and displayed in chronological order
- **AND** room-specific color coding or indicators distinguish message sources
- **AND** high-frequency messages trigger backpressure to prevent UI blocking

### Requirement: Plugin Navigation System
The system SHALL provide a left sidebar for plugin discovery, installation, and quick access.

#### Scenario: Plugin list display
- **WHEN** user views the plugin navigation sidebar
- **THEN** all installed plugins are listed with icons and names
- **AND** plugin status (enabled/disabled) is clearly indicated
- **AND** system shortcuts for room management and settings are also available

#### Scenario: Plugin installation interface
- **WHEN** user clicks the plugin installation button
- **THEN** a file picker opens for local plugin import
- **AND** selected plugin manifests are validated before installation
- **AND** installation progress and results are clearly communicated

### Requirement: System Function Integration
The system SHALL maintain access to core system functions while prioritizing plugin interface.

#### Scenario: Room management access
- **WHEN** user needs to manage live rooms
- **THEN** room management functions are accessible via sidebar shortcuts
- **AND** room status is visible in the main interface
- **AND** room operations do not require leaving the plugin-first layout

#### Scenario: Settings access
- **WHEN** user needs to modify application settings
- **THEN** settings are accessible via sidebar or overlay interface
- **AND** settings changes apply immediately without interface disruption
- **AND** plugin-specific settings are managed within plugin containers

### Requirement: Responsive Layout Management
The system SHALL adapt the interface layout to different window sizes while maintaining plugin-first principles.

#### Scenario: Window resize handling
- **WHEN** user resizes the application window
- **THEN** the plugin container adjusts to available space
- **AND** the danmu bar remains visible and functional
- **AND** the plugin navigation adapts to smaller widths if necessary

#### Scenario: Minimum window size enforcement
- **WHEN** window size falls below minimum requirements
- **THEN** the interface gracefully degrades with collapsible sidebars
- **AND** core functionality remains accessible
- **AND** plugin content maintains usability within constraints