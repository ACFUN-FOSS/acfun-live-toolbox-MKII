# desktop-ui Specification

## Purpose
TBD - created by archiving change add-a3-plugin-first-desktop-ui. Update Purpose after archive.
## Requirements
### Requirement: Plugin-First Main Layout
The system SHALL provide both plugin-first and standard navigation modes, with the ability to switch between plugin-priority interface and standard Vue Router-based navigation.

#### Scenario: Legacy plugin-first mode compatibility
- **WHEN** user enables plugin-first mode
- **THEN** the main interface displays with plugin navigation on the left, danmu bar on top, and central plugin container
- **AND** the interface maintains backward compatibility with existing plugin system

#### Scenario: Standard navigation mode
- **WHEN** user uses standard navigation mode (default)
- **THEN** the interface follows Vue Router patterns with topbar, sidebar, and RouterView
- **AND** plugins are accessible through dedicated plugin management pages
- **AND** the layout follows ui2.json specifications for 1024x768 resolution

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

### Requirement: Standard Vue Router Layout System
The system SHALL implement a standard Vue Router-based layout with topbar, sidebar, and main content area optimized for 1024x768 resolution.

#### Scenario: Application layout structure
- **WHEN** user opens the application
- **THEN** LayoutShell component renders with topbar, sidebar, and RouterView
- **AND** the layout follows ui2.json specifications for component positioning and sizing
- **AND** the interface is optimized for 1024x768 resolution with responsive behavior

#### Scenario: Route-based navigation
- **WHEN** user navigates between different sections
- **THEN** Vue Router handles navigation with appropriate page components
- **AND** the topbar and sidebar remain consistent across all routes
- **AND** page transitions are smooth and maintain application state

### Requirement: Topbar Interface Components
The system SHALL provide a topbar with account management, room status, and system controls.

#### Scenario: Account management display
- **WHEN** user views the topbar
- **THEN** account information and login status are displayed
- **AND** account-related actions (login, logout, profile) are accessible
- **AND** QR code login is available for unauthenticated users

#### Scenario: Room status integration
- **WHEN** user has connected rooms
- **THEN** room status indicators appear in the topbar
- **AND** room management actions are quickly accessible
- **AND** real-time room information updates are displayed

### Requirement: Sidebar Navigation System
The system SHALL provide a sidebar with hierarchical navigation for all application features.

#### Scenario: Main navigation structure
- **WHEN** user views the sidebar
- **THEN** navigation items are organized by category (Home, Live, Plugins, System)
- **AND** each category expands to show relevant sub-pages
- **AND** current page is highlighted with appropriate visual indicators

#### Scenario: Plugin access integration
- **WHEN** user navigates to plugin-related sections
- **THEN** plugin management and individual plugin access are available
- **AND** plugin status and availability are clearly indicated
- **AND** plugin navigation integrates seamlessly with main application routing

### Requirement: Page Component Architecture
The system SHALL implement dedicated page components for each major section following ui2.json specifications.

#### Scenario: HomePage implementation
- **WHEN** user navigates to home route
- **THEN** HomePage displays welcome card, user info card, and KPI statistics section
- **AND** ECharts integration provides mini trend visualizations
- **AND** QR code login functionality is integrated for non-authenticated users

#### Scenario: System pages implementation
- **WHEN** user navigates to system, settings, or console routes
- **THEN** dedicated page components (SystemPage, SettingsPage, ConsoleEmbedPage) render appropriate content
- **AND** each page follows TDesign component patterns and ui2.json specifications
- **AND** console page embeds the web console interface safely

### Requirement: Plugin System Router Integration
The system SHALL maintain plugin system compatibility through router-based access while preserving micro-frontend isolation.

#### Scenario: Plugin frame routing
- **WHEN** user navigates to /plugins/:id route
- **THEN** PluginFramePage component loads the specified plugin using Wujie micro-frontend
- **AND** plugin operates in isolated environment with controlled API access
- **AND** plugin popup and overlay functionality remains available

#### Scenario: Plugin navigation preservation
- **WHEN** plugins require sub-routing or navigation
- **THEN** the /plugins/:id/(.*) route pattern captures plugin-specific routes
- **AND** plugin internal navigation works without affecting main application routing
- **AND** plugin state is preserved during navigation within plugin context

