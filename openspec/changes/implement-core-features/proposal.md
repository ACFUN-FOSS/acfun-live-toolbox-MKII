# OpenSpec Change Proposal: Implement Core Features

## Why

The current AcFun Live Toolbox MKII has completed its foundational refactoring but lacks several critical features defined in the SRS and DDD specifications. These missing features are essential for the application to function as a complete live streaming management tool for ACFun streamers.

Key missing capabilities include:
- QR code login system for ACFun authentication
- Live room connection and management (up to 3 concurrent rooms)
- Real-time danmu (bullet chat) event processing and display
- Overlay system for OBS integration
- Enhanced UI components for live streaming workflow
- Configuration management for streaming settings

## What Changes

- **Add QR Code Authentication**: Implement ACFun login via QR code scanning with secure token storage
- **Add Live Room Management**: Enable connection to multiple ACFun live rooms with status monitoring
- **Add Real-time Event Display**: Create UI components to show live danmu, gifts, and other events
- **Add Overlay System**: Implement overlay pages for OBS browser sources with real-time event streaming
- **Add Enhanced Configuration**: Expand settings management for streaming preferences and room configurations
- **Add Status Monitoring**: Implement comprehensive status displays for connections, services, and system health

## Impact

- Affected specs: Will create new capability specifications for:
  - `authentication` - QR login and token management
  - `live-room-management` - Room connections and event processing
  - `real-time-display` - Event visualization and streaming
  - `overlay-system` - OBS integration and browser sources
  - `configuration` - Settings and preferences management
  - `status-monitoring` - System health and connection status

- Affected code: 
  - `packages/main/src/` - Core business logic implementation
  - `packages/renderer/src/` - UI components and pages
  - `packages/preload/src/` - IPC bridge enhancements
  - New API endpoints in HTTP server
  - WebSocket event broadcasting
  - Database schema extensions for user preferences