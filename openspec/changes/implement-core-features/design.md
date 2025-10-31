# Design Document: Implement Core Features

## Context

The AcFun Live Toolbox MKII has completed its foundational architecture refactoring but needs to implement the core features that make it a functional live streaming management tool. This involves integrating with ACFun's live streaming APIs, managing real-time data flows, and providing a comprehensive user interface for streamers.

The implementation must follow the established patterns from the SRS and DDD specifications while maintaining security, performance, and usability standards.

## Goals / Non-Goals

### Goals
- Implement a complete QR code authentication system for ACFun
- Enable management of multiple concurrent live room connections
- Provide real-time event processing and display capabilities
- Create an overlay system for OBS integration
- Enhance configuration management for streaming workflows
- Implement comprehensive status monitoring and health checks

### Non-Goals
- Public plugin marketplace (deferred to future releases)
- Advanced permission systems for plugins
- Proxy/VPN integration
- Mobile application support

## Decisions

### Authentication Architecture
- **Decision**: Use QR code-based authentication with secure token storage in main process
- **Rationale**: Follows ACFun's standard authentication flow and maintains security by keeping tokens isolated from renderer
- **Implementation**: Main process handles QR generation and token exchange, renderer displays QR and status

### Real-time Data Flow
- **Decision**: Maintain existing event normalization pipeline with enhanced UI components
- **Rationale**: Leverages the robust foundation already built, adds presentation layer improvements
- **Implementation**: Extend existing WebSocket broadcasting to include new UI components and overlays

### Overlay System Design
- **Decision**: Server-side rendered HTML pages with WebSocket connections for real-time updates
- **Rationale**: Provides maximum compatibility with OBS browser sources while maintaining real-time capabilities
- **Implementation**: Express routes serve overlay HTML, WebSocket provides event streaming

### Configuration Management
- **Decision**: Extend existing ConfigManager with schema validation and migration support
- **Rationale**: Builds on established patterns while adding robustness for complex streaming configurations
- **Implementation**: JSON schema validation, automatic migration, and backup/restore capabilities

## Risks / Trade-offs

### Risk: Authentication Token Security
- **Mitigation**: Store tokens only in main process, use encrypted storage, implement token refresh logic

### Risk: Real-time Performance
- **Mitigation**: Implement event batching, connection pooling, and performance monitoring

### Risk: UI Complexity
- **Mitigation**: Use established TDesign components, implement progressive disclosure, provide user guidance

### Risk: OBS Integration Compatibility
- **Mitigation**: Test with multiple OBS versions, provide fallback options, document requirements

## Migration Plan

1. **Phase 1**: Implement authentication without breaking existing functionality
2. **Phase 2**: Add room management features incrementally
3. **Phase 3**: Enhance UI components while maintaining backward compatibility
4. **Phase 4**: Deploy overlay system as additional feature
5. **Phase 5**: Expand configuration management with migration support
6. **Phase 6**: Add monitoring and health checks as final layer

## Open Questions

- Should we implement rate limiting for ACFun API calls to prevent abuse?
- How should we handle offline mode when ACFun services are unavailable?
- What level of customization should be available for overlays?
- Should configuration profiles be shareable between users?