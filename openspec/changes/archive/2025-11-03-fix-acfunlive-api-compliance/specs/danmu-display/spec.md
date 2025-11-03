# Danmu Display Specification Delta

## MODIFIED Requirements

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



## MODIFIED Requirements

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