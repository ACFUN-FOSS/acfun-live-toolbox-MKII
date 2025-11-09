## ADDED Requirements

### Requirement: Plugin Popup Capability Not Implemented
The system SHALL NOT provide a BrowserWindow-based plugin popup capability.

#### Scenario: No popup API exposed
- **WHEN** a plugin attempts to access `window.electronApi.plugin.popup.*`
- **THEN** such APIs SHALL NOT be present or SHALL respond with a standardized "not supported" indication.

#### Scenario: No popup IPC channels
- **WHEN** inspecting preload/main IPC handlers for `plugin.popup.*`
- **THEN** no such channels SHALL exist in the implementation.

#### Scenario: Overlay remains available
- **WHEN** a plugin requires floating UI behavior
- **THEN** the overlay capability remains available and SHALL be used as the recommended alternative.

