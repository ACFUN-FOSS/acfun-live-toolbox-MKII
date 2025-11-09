## ADDED Requirements

### Requirement: Desktop UI Does Not Provide Plugin Popups
The desktop UI SHALL NOT provide plugin popup windows for plugins.

#### Scenario: No popup creation entrypoints
- **WHEN** a user navigates the UI to open a plugin
- **THEN** the system SHALL NOT open a separate BrowserWindow via a "plugin popup" mechanism.

#### Scenario: Overlay remains available in UI
- **WHEN** floating overlay behavior is needed
- **THEN** the UI SHALL utilize overlay capabilities; popup windows are not implemented.

