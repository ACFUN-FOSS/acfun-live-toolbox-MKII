## ADDED Requirements

### Requirement: Multi-Room Connection Management
The system SHALL support concurrent connections to up to 3 ACFun live rooms with independent status tracking and event processing.

#### Scenario: Room connection establishment
- **WHEN** user requests connection to a live room
- **THEN** system establishes WebSocket connection using acfundanmu.js
- **AND** connection status is tracked and displayed in UI
- **AND** room is added to active rooms list

#### Scenario: Concurrent room limit enforcement
- **WHEN** user attempts to connect to a 4th room
- **THEN** system prevents the connection
- **AND** displays error message about 3-room limit
- **AND** suggests disconnecting an existing room first

#### Scenario: Room disconnection
- **WHEN** user requests disconnection from a room
- **THEN** system cleanly closes WebSocket connection
- **AND** removes room from active rooms list
- **AND** stops event processing for that room

### Requirement: Room Status Monitoring
The system SHALL continuously monitor and display the connection status of all active rooms with real-time updates.

#### Scenario: Connection status tracking
- **WHEN** room connection state changes
- **THEN** system updates internal status tracking
- **AND** broadcasts status change to UI components
- **AND** displays appropriate status indicator

#### Scenario: Automatic reconnection
- **WHEN** room connection is lost unexpectedly
- **THEN** system attempts automatic reconnection with exponential backoff
- **AND** displays reconnection status to user
- **AND** resumes event processing when reconnected

#### Scenario: Connection health monitoring
- **WHEN** system detects connection issues
- **THEN** displays warning indicators in UI
- **AND** provides diagnostic information
- **AND** offers manual reconnection options

### Requirement: Room Configuration and Labeling
The system SHALL allow users to configure room settings and assign custom labels for better organization.

#### Scenario: Room labeling
- **WHEN** user assigns a custom label to a room
- **THEN** system stores the label in configuration
- **AND** displays the label in UI instead of room ID
- **AND** persists label across application restarts

#### Scenario: Primary room designation
- **WHEN** user designates a room as primary
- **THEN** system marks it with special indicator
- **AND** gives priority to primary room events in UI
- **AND** uses primary room for default operations

#### Scenario: Room configuration persistence
- **WHEN** user modifies room settings
- **THEN** system saves configuration to persistent storage
- **AND** restores settings on application restart
- **AND** maintains room connection preferences