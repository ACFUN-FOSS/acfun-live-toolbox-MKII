# danmu-display Spec Deltas

## ADDED Requirements

### Requirement: AcFun Live Stream Connection Management
The system SHALL establish and maintain reliable connections to AcFun live streams using the acfundanmu.js backend integration.

#### Scenario: Live stream connection establishment
- **WHEN** user requests connection to an AcFun live room
- **THEN** the system establishes WebSocket connection using acfunlive-http-api
- **AND** authentication is performed using valid AcFun credentials
- **AND** connection status is reported within 5 seconds
- **AND** room metadata (title, streamer info, viewer count) is retrieved

#### Scenario: Connection failure and recovery
- **WHEN** live stream connection fails or is interrupted
- **THEN** the system attempts automatic reconnection with exponential backoff
- **AND** connection status is updated to reflect current state
- **AND** user is notified of connection issues without blocking UI
- **AND** manual reconnection option is available

### Requirement: Real AcFun Danmu Event Processing
The system SHALL process authentic AcFun danmu events and enrich them with contextual metadata for display and analysis.

#### Scenario: Danmu event reception and enrichment
- **WHEN** danmu events are received from AcFun live stream
- **THEN** events are parsed according to AcFun protocol specifications
- **AND** each event is enriched with roomId, source platform, and timestamp
- **AND** event types (comment, gift, like, follow, enter) are properly categorized
- **AND** user information (username, level, badges) is extracted and preserved

#### Scenario: High-volume danmu stream handling
- **WHEN** live stream generates high-frequency danmu events (>50/second)
- **THEN** the system applies rate limiting and buffering strategies
- **AND** critical events (gifts, follows) are prioritized over regular comments
- **AND** system performance remains stable without memory leaks
- **AND** event processing latency stays below 100ms average

### Requirement: AcFun Authentication Integration
The system SHALL integrate with AcFun authentication services to enable authorized access to live stream data and user-specific features.

#### Scenario: User authentication flow
- **WHEN** user initiates AcFun account connection
- **THEN** the system guides through OAuth or credential-based authentication
- **AND** authentication tokens are securely stored and managed
- **AND** token refresh is handled automatically before expiration
- **AND** authentication status is clearly indicated in the UI

#### Scenario: Authentication failure handling
- **WHEN** authentication fails or tokens expire
- **THEN** user is prompted to re-authenticate without data loss
- **AND** existing connections are gracefully maintained where possible
- **AND** error messages provide clear guidance for resolution
- **AND** fallback to anonymous access is available where supported

## MODIFIED Requirements

### Requirement: Real-time Danmu Stream Display
The system SHALL provide a continuous, real-time display of danmu messages from all connected AcFun live rooms using authentic acfundanmu.js backend integration instead of simulated data.

#### Scenario: Danmu message reception and display
- **WHEN** a danmu message is received from any connected AcFun room via acfundanmu.js
- **THEN** the message appears in the danmu display area within 200ms
- **AND** the message includes timestamp, room identifier, username, and content from real AcFun data
- **AND** the message is formatted with appropriate styling and color coding
- **AND** AcFun-specific metadata (user level, badges, gift values) is displayed

#### Scenario: Multi-room danmu aggregation
- **WHEN** multiple AcFun rooms are connected simultaneously via acfundanmu.js
- **THEN** danmu messages from all rooms are merged in chronological order
- **AND** each message is visually distinguished by room-specific indicators
- **AND** room names and streamer information from AcFun API are clearly displayed
- **AND** connection status for each room is monitored and displayed