## MODIFIED Requirements

### Requirement: System Page Data Integration

The system SHALL provide real data integration for the System Page, replacing all mock data and simulated delays.

#### Scenario: Viewing Logs
- **WHEN** a user navigates to the Logs tab on the System Page
- **THEN** the system SHALL fetch and display real system logs via the `system.getSystemLog` interface.
- **AND** the user SHALL be able to filter logs by level, keyword, and time range.

#### Scenario: Managing Configuration
- **WHEN** a user navigates to the Config & Export tab
- **THEN** the system SHALL load the current application configuration using the `system.getConfig` interface.
- **AND** the user SHALL be able to modify and save the configuration using the `system.updateConfig` interface, with changes taking effect immediately.

#### Scenario: Exporting Data
- **WHEN** a user attempts to export data from the Config & Export tab
- **THEN** the system SHALL make a request to the `GET /api/export` endpoint with the specified parameters (roomId, from, to, format).
- **AND** the system SHALL provide the user with the generated file for download.

#### Scenario: Generating Diagnostics
- **WHEN** a user generates a diagnostic package from the Diagnostics tab
- **THEN** the system SHALL call the `system.genDiagnosticZip` interface with the selected options.
- **AND** the system SHALL present the generated ZIP file's path to the user, allowing them to open its location.