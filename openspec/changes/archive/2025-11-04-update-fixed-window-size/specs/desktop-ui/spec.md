## ADDED Requirements

### Requirement: Fixed Window Size (1024x768)
The application SHALL use a fixed-size main window at 1024x768 during runtime.

#### Scenario: Fixed BrowserWindow size
- **WHEN** the application creates the main window
- **THEN** `BrowserWindow` config includes `width: 1024` and `height: 768`
- **AND** `resizable` is set to `false`
- **AND** minimum and maximum sizes are both set to `1024x768`

#### Scenario: Layout alignment at fixed size
- **WHEN** the renderer loads with the fixed-size window
- **THEN** `LayoutShell` aligns to `Topbar 40px / Sidebar 208px / Content 816x728`
- **AND** scroll behavior remains consistent without overflow beyond content area