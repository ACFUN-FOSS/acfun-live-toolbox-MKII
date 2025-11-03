# danmu-display Specification

## Purpose
TBD - created by archiving change add-a3-plugin-first-desktop-ui. Update Purpose after archive.
## Requirements
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

### Requirement: Danmu Display Performance Management
The system SHALL manage danmu display performance to prevent UI blocking during high-frequency message periods.

#### Scenario: High-frequency danmu handling
- **WHEN** danmu messages arrive at rates exceeding 10 messages per second
- **THEN** the system applies backpressure strategies to maintain UI responsiveness
- **AND** older messages are automatically removed to prevent memory accumulation
- **AND** message display prioritizes recent content over historical messages

#### Scenario: Display buffer management
- **WHEN** the danmu display buffer reaches capacity limits
- **THEN** oldest messages are automatically removed using FIFO strategy
- **AND** buffer size is configurable with reasonable defaults (e.g., 100 messages)
- **AND** buffer operations do not cause visible UI stuttering or delays

### Requirement: Danmu Visual Presentation
The system SHALL present danmu messages with clear, readable formatting that enhances user experience without overwhelming the interface.

#### Scenario: Message formatting and styling
- **WHEN** danmu messages are displayed
- **THEN** usernames are highlighted with distinct styling
- **AND** message content uses readable fonts and appropriate sizing
- **AND** timestamps are formatted in user-friendly format (e.g., HH:MM:SS)
- **AND** long messages are truncated with ellipsis and expandable on hover/click

#### Scenario: Room identification visual cues
- **WHEN** messages from different rooms are displayed
- **THEN** each room has a consistent color scheme or icon identifier
- **AND** room switching or filtering options are available
- **AND** room status (connected/disconnected) is visually indicated

### Requirement: Danmu Display Customization
The system SHALL allow users to customize danmu display behavior and appearance according to their preferences.

#### Scenario: Display preferences configuration
- **WHEN** user accesses danmu display settings
- **THEN** options for message count, display duration, and refresh rate are available
- **AND** font size, color themes, and layout options can be customized
- **AND** room filtering and priority settings can be configured

#### Scenario: Display toggle and minimize
- **WHEN** user needs to focus on other tasks
- **THEN** danmu display can be minimized or temporarily hidden
- **AND** display state is preserved across application sessions
- **AND** quick toggle shortcuts are available for rapid access

### Requirement: Danmu Interaction Features
The system SHALL provide interactive features for danmu messages to enhance user engagement and utility.

#### Scenario: Message interaction and context
- **WHEN** user interacts with a danmu message
- **THEN** additional context (full message, user info, timestamp) is available
- **AND** options to copy message content or username are provided
- **AND** navigation to the source room or user profile is possible

#### Scenario: Message filtering and search
- **WHEN** user wants to filter danmu content
- **THEN** keyword filtering options are available
- **AND** user-based filtering (block/highlight specific users) is supported
- **AND** message type filtering (regular danmu, gifts, follows) is configurable

### Requirement: AcFun Live Stream Connection Management
The system SHALL establish and maintain reliable connections to AcFun live streams using proper acfunlive-http-api integration patterns.

#### Scenario: API instance initialization
- **WHEN** system initializes AcFun API connections
- **THEN** API instances are created using `new AcFunLiveApi(config)` with proper configuration
- **AND** configuration includes timeout, retryCount, and baseUrl parameters
- **AND** connection pooling uses properly configured API instances
- **AND** API configuration handles retry behavior internally

#### Scenario: Authentication integration
- **WHEN** user authentication is required for AcFun services
- **THEN** system implements complete QR code login flow using `api.auth.qrLogin()`
- **AND** system polls `api.auth.checkQrLoginStatus()` until authentication completes
- **AND** authentication tokens are set using `api.setAuthToken()` method
- **AND** token management includes proper validation and refresh logic

#### Scenario: Danmu service connection
- **WHEN** establishing danmu stream connection
- **THEN** system calls `api.danmu.startDanmu(liverUID, callback)` with correct parameters
- **AND** liverUID is passed as string type according to API specification
- **AND** callback function handles events according to API event structure
- **AND** session management uses API-provided session identifiers

### Requirement: Real AcFun Danmu Event Processing
The system SHALL process AcFun danmu events using API-compliant event handling patterns.

#### Scenario: Event callback implementation
- **WHEN** danmu events are received from AcFun API
- **THEN** event callbacks match the API's expected function signature
- **AND** event types are processed according to API documentation (Comment, Gift, Like, etc.)
- **AND** event data extraction follows API's event structure patterns
- **AND** user information is accessed through API's standardized event properties

#### Scenario: Error handling alignment
- **WHEN** API errors occur during danmu processing
- **THEN** error handling uses API's error response format
- **AND** retry logic relies on API's built-in retry mechanism
- **AND** external retry wrappers do not conflict with API retry behavior
- **AND** connection recovery follows API's recommended patterns

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

### Requirement: API Configuration Compliance

The system SHALL configure acfunlive-http-api instances according to library specifications.

#### Scenario: Proper API configuration
- **WHEN** creating AcFunLiveApi instances
- **THEN** configuration object includes all required parameters
- **AND** timeout values are set appropriately for the application context
- **AND** retry count is configured based on reliability requirements
- **AND** base URL is set to match API documentation recommendations

#### Scenario: Configuration validation
- **WHEN** API configuration is applied
- **THEN** system validates configuration parameters against API requirements
- **AND** invalid configurations are rejected with clear error messages
- **AND** default values align with API documentation standards
- **AND** configuration changes are applied consistently across all API instances

