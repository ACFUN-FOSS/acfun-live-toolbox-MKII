## ADDED Requirements

### Requirement: Standard Vue Router Layout System
The system SHALL provide a standard Vue Router-based desktop interface with topbar, sidebar navigation, and RouterView content area following ui2.json specifications.

#### Scenario: Application layout structure
- **WHEN** user launches the desktop application
- **THEN** the interface displays with LayoutShell containing topbar (40px), sidebar (208px), and RouterView content area
- **AND** the layout follows TDesign component structure with t-layout, t-header, t-aside, and t-content

#### Scenario: Route-based navigation
- **WHEN** user navigates between different sections
- **THEN** Vue Router handles navigation with immediate transitions (no animations)
- **AND** the sidebar highlights the current route
- **AND** the content area updates via RouterView without page refresh

### Requirement: Topbar Interface Components
The system SHALL provide a comprehensive topbar with application title, account management, room status, and window controls.

#### Scenario: Topbar layout and functionality
- **WHEN** user views the topbar
- **THEN** the left section contains draggable application title area
- **AND** the center section displays account summary and room status indicator
- **AND** the right section provides window minimize and close controls

#### Scenario: Account management integration
- **WHEN** user clicks the account area
- **THEN** an account popup displays with login/logout options and user information
- **AND** for non-logged users, a QR code login dialog is available
- **AND** account state changes reflect immediately in the topbar

#### Scenario: Room status monitoring
- **WHEN** user clicks the room status indicator
- **THEN** a drawer opens showing detailed room information, connection rates, latency, and reconnection counts
- **AND** status colors indicate connection state (green/yellow/red for connected/connecting/failed)

### Requirement: Sidebar Navigation System
The system SHALL provide a sidebar with route-based navigation supporting home, plugins, system, settings, and console sections.

#### Scenario: Navigation menu structure
- **WHEN** user views the sidebar
- **THEN** navigation items are displayed using t-menu component with proper routing
- **AND** current route is highlighted automatically
- **AND** keyboard shortcuts (Alt+1-5) provide quick navigation between sections

#### Scenario: Plugin access through navigation
- **WHEN** user selects plugins from sidebar
- **THEN** navigation routes to /plugins page showing plugin list and management
- **AND** individual plugins are accessible via /plugins/:id routes
- **AND** plugin functionality is preserved through PluginFramePage component

## MODIFIED Requirements

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

## ADDED Requirements

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