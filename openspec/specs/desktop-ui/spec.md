# desktop-ui Specification

## Purpose
TBD - created by archiving change add-a3-plugin-first-desktop-ui. Update Purpose after archive.
## Requirements
### Requirement: Plugin-First Main Layout
The system SHALL provide both plugin-first and standard navigation modes, with the ability to switch between plugin-priority interface and standard Vue Router-based navigation.

#### Scenario: Legacy plugin-first mode compatibility
- **WHEN** user enables plugin-first mode
- **THEN** the main interface displays with plugin navigation on the left, danmu bar on top, and central plugin container
- **AND** the interface maintains backward compatibility with existing plugin system

#### Scenario: Standard navigation mode
- **WHEN** user uses standard navigation mode (default)
- **THEN** the interface follows Vue Router patterns with topbar, sidebar, and RouterView
- **AND** plugins are accessible through dedicated plugin management pages
- **AND** the layout follows ui2.json specifications for 1024x768 resolution

### Requirement: Real-time Danmu Display
The system SHALL display real-time danmu (bullet chat) from all connected rooms in a prominent top bar.

#### Scenario: Danmu received from connected room
- **WHEN** a new danmu message is received from any connected room
- **THEN** the message appears in the top danmu bar with smooth scrolling animation
- **AND** the message includes room identifier, username, and content
- **AND** messages automatically scroll and fade after display duration

#### Scenario: Multiple room danmu handling
- **WHEN** multiple rooms are connected and sending danmu simultaneously
- **THEN** messages from all rooms are merged and displayed in chronological order
- **AND** room-specific color coding or indicators distinguish message sources
- **AND** high-frequency messages trigger backpressure to prevent UI blocking

### Requirement: Plugin Navigation System
The system SHALL provide a left sidebar for plugin discovery, installation, and quick access.

#### Scenario: Plugin list display
- **WHEN** user views the plugin navigation sidebar
- **THEN** all installed plugins are listed with icons and names
- **AND** plugin status (enabled/disabled) is clearly indicated
- **AND** system shortcuts for room management and settings are also available

#### Scenario: Plugin installation interface
- **WHEN** user clicks the plugin installation button
- **THEN** a file picker opens for local plugin import
- **AND** selected plugin manifests are validated before installation
- **AND** installation progress and results are clearly communicated

### Requirement: System Function Integration
The system SHALL maintain access to core system functions while prioritizing plugin interface.

#### Scenario: Room management access
- **WHEN** user needs to manage live rooms
- **THEN** room management functions are accessible via sidebar shortcuts
- **AND** room status is visible in the main interface
- **AND** room operations do not require leaving the plugin-first layout

#### Scenario: Settings access
- **WHEN** user needs to modify application settings
- **THEN** settings are accessible via sidebar or overlay interface
- **AND** settings changes apply immediately without interface disruption
- **AND** plugin-specific settings are managed within plugin containers

### Requirement: Responsive Layout Management
The system SHALL adapt the interface layout to different window sizes while maintaining plugin-first principles.

#### Scenario: Window resize handling
- **WHEN** user resizes the application window
- **THEN** the plugin container adjusts to available space
- **AND** the danmu bar remains visible and functional
- **AND** the plugin navigation adapts to smaller widths if necessary

#### Scenario: Minimum window size enforcement
- **WHEN** window size falls below minimum requirements
- **THEN** the interface gracefully degrades with collapsible sidebars
- **AND** core functionality remains accessible
- **AND** plugin content maintains usability within constraints

### Requirement: Standard Vue Router Layout System
The system SHALL implement a standard Vue Router-based layout with topbar, sidebar, and main content area optimized for 1024x768 resolution.

#### Scenario: Application layout structure
- **WHEN** user opens the application
- **THEN** LayoutShell component renders with topbar, sidebar, and RouterView
- **AND** the layout follows ui2.json specifications for component positioning and sizing
- **AND** the interface is optimized for 1024x768 resolution with responsive behavior

#### Scenario: Route-based navigation
- **WHEN** user navigates between different sections
- **THEN** Vue Router handles navigation with appropriate page components
- **AND** the topbar and sidebar remain consistent across all routes
- **AND** page transitions are smooth and maintain application state

### Requirement: Topbar Interface Components
The system SHALL provide a topbar with account management, room status, and system controls.

#### Scenario: Account management display
- **WHEN** user views the topbar
- **THEN** account information and login status are displayed
- **AND** account-related actions (login, logout, profile) are accessible
- **AND** QR code login is available for unauthenticated users

#### Scenario: Room status integration
- **WHEN** user has connected rooms
- **THEN** room status indicators appear in the topbar
- **AND** room management actions are quickly accessible
- **AND** real-time room information updates are displayed

### Requirement: Sidebar Navigation System
The system SHALL provide a sidebar with hierarchical navigation for all application features.

#### Scenario: Main navigation structure
- **WHEN** user views the sidebar
- **THEN** navigation items are organized by category (Home, Live, Plugins, System)
- **AND** each category expands to show relevant sub-pages
- **AND** current page is highlighted with appropriate visual indicators

#### Scenario: Plugin access integration
- **WHEN** user navigates to plugin-related sections
- **THEN** plugin management and individual plugin access are available
- **AND** plugin status and availability are clearly indicated
- **AND** plugin navigation integrates seamlessly with main application routing

### Requirement: Page Component Architecture
The system SHALL implement dedicated page components for each major section following ui2.json specifications.

#### Scenario: HomePage implementation
- **WHEN** user navigates to home route
- **THEN** HomePage displays welcome card, user info card, and KPI statistics section
- **AND** ECharts integration provides mini trend visualizations
- **AND** QR code login functionality is integrated for non-authenticated users

#### Scenario: System pages implementation
- **WHEN** user navigates to system, settings, or console routes
- **THEN** dedicated page components (SystemPage, SettingsPage, ConsoleEmbedPage) render appropriate content
- **AND** each page follows TDesign component patterns and ui2.json specifications
- **AND** console page embeds the web console interface safely

### Requirement: Plugin System Router Integration
The system SHALL maintain plugin system compatibility through router-based access while preserving micro-frontend isolation.

#### Scenario: Plugin frame routing
- **WHEN** user navigates to /plugins/:id route
- **THEN** PluginFramePage component loads the specified plugin using Wujie micro-frontend
- **AND** plugin operates in isolated environment with controlled API access
- **AND** plugin popup and overlay functionality remains available
 - **AND** plugin overlay functionality SHALL remain available
 - **AND** plugin popup functionality SHALL NOT be implemented

#### Scenario: Plugin navigation preservation
- **WHEN** plugins require sub-routing or navigation
- **THEN** the /plugins/:id/(.*) route pattern captures plugin-specific routes
- **AND** plugin internal navigation works without affecting main application routing
- **AND** plugin state is preserved during navigation within plugin context

### Requirement: Home Right Pane 2×2 Card Grid
首页右侧内容区域（不含左侧导航与头部外壳）MUST 在 792×704 视口下以 2×2 卡片栅格（A,B,C,D）呈现，且无纵向滚动。

#### Scenario: Fixed viewport layout
- **WHEN** 用户在 792×704 视口查看首页
- **THEN** 右侧内容以 2×2 卡片栅格填充（A 左上、B 右上、C 左下、D 右下）
- **AND** 右侧内容区域无纵向滚动
- **AND** 每列采用 12 栅格中的 `span=6`，不使用固定像素（分数单位布局）

#### Scenario: Remove persistent right quick-actions bar
- **WHEN** 首页右侧渲染完成
- **THEN** 不存在右侧区域的持久化顶部快捷操作条

### Requirement: Card A — Welcome and Single Primary Action
卡片 A MUST 仅包含欢迎文案与一个“按角色”主行动按钮，点击后路由到对应页面。

#### Scenario: Role-based CTA routing
- **WHEN** 用户点击卡片 A 的主行动按钮
- **THEN** 若角色为主播，路由至 `/stream/start`
- **AND** 若角色为房管，路由至 `/rooms`
- **AND** 若角色为开发，路由至 `/debugger`

### Requirement: Card B — Account Information and Login/Logout
卡片 B MUST 展示账户信息；未登录时显示登录按钮；已登录时显示用户名、UID（可复制且有成功提示）、签名（两行截断）、粉丝数（紧凑格式）与退出登录按钮。

#### Scenario: Not logged in
- **WHEN** `auth.isLoggedIn=false`
- **THEN** 卡片 B 显示“登录”按钮，点击后进入 `/login`

#### Scenario: Logged in fields and actions
- **WHEN** `auth.isLoggedIn=true`
- **THEN** 显示用户名、UID（可复制并提示成功）、签名（两行截断，空则显示“暂无签名”）、粉丝数（紧凑格式）与“退出登录”按钮

### Requirement: Card C — Role-Driven Overview with 7d/30d Toggle
卡片 C MUST 根据角色展示不同的历史概览，并提供 `7d/30d` 范围切换，仅影响 C 卡的数据加载。

#### Scenario: Anchor overview
- **WHEN** 角色为主播
- **THEN** 显示最近一次直播（日期、时长）与近区间统计（场次、平均时长、礼物数量）

#### Scenario: Moderator overview
- **WHEN** 角色为房管
- **THEN** 展示最多 2 个房间（封面、名称、状态点与文案），并提供“查看更多”链接至 `/rooms`

#### Scenario: Developer overview
- **WHEN** 角色为开发
- **THEN** 展示错误数、消息数与唯一错误类型数；无数据时显示空态并提供“去调试”链接至 `/debugger`

#### Scenario: Stats scope toggle only affects Card C
- **WHEN** 用户在卡片 C 切换统计范围为 `7d` 或 `30d`
- **THEN** 仅重新加载 C 卡对应范围的数据，不影响其他卡片

### Requirement: Card D — Docs Quicklinks
卡片 D MUST 展示文档列表的前 3 项，且提供“查看更多”链接。

#### Scenario: Docs list and more
- **WHEN** 成功获取文档列表
- **THEN** 展示前 3 项，包含标题/描述与“打开”链接（新标签）
- **AND** 提供“查看更多”链接到 `/docs`（或外部文档枢纽）

### Requirement: First Login Role Selection Dialog
首次登录且无持久化角色时 MUST 弹出角色选择对话框；确认后 MUST 持久化并驱动右侧卡片重渲染。头像下拉菜单的角色切换同样驱动卡片重渲染。

#### Scenario: First login role dialog
- **WHEN** `GET_ROLE` 返回 `null`
- **THEN** 打开角色选择对话框，确认后持久化角色并关闭对话框，右侧 A/B/C/D 按角色重渲染

#### Scenario: Avatar dropdown role switching
- **WHEN** 用户在头像下拉菜单切换角色
- **THEN** 更新 `role.current` 并触发 2×2 卡片区域重新渲染

### Requirement: Per-card Loading and Error Handling
各卡片 MUST 独立显示加载骨架与错误横幅，并提供重试，不互相阻塞。`401` 的处理在卡片 B 上显示登录按钮，其他卡片显示空态与单 CTA。

#### Scenario: Card-specific loading and retry
- **WHEN** 卡片数据加载中或失败
- **THEN** 显示骨架或错误横幅，并提供重试；其他卡片不受影响

#### Scenario: 401 handling
- **WHEN** 接口返回 401
- **THEN** 卡片 B 显示登录按钮；其他卡片显示空态与单一 CTA

### Requirement: Transport Selector (IPC → HTTP → Mock)
传输选择器 MUST 优先使用主进程 IPC 通道；不可用时 MUST 回退到 HTTP；最后 MUST 使用 Mock。各端点 MUST 遵循 `ui-main.json` 的 `request_transform`/`response_transform`。

#### Scenario: Boot sequence and transport
- **WHEN** 页面初始化
- **THEN** 执行引导序列：`GET_ROLE → GET_USER → (按角色并行) GET_ANCHOR_STATS/GET_MOD_ROOMS/GET_DEV_METRICS → GET_DOCS`
- **AND** 传输优先级按 IPC → HTTP → Mock 执行；字段映射遵循 transform 规则

### Requirement: Desktop UI Does Not Provide Plugin Popups
The desktop UI SHALL NOT provide plugin popup windows for plugins.

#### Scenario: No popup creation entrypoints
- **WHEN** a plugin attempts to create a popup window via UI entrypoints
- **THEN** no such entrypoints exist in the desktop UI
- **AND** attempts to trigger popup creation SHALL be ignored or surfaced as "not supported" in plugin APIs
### Requirement: Renderer Frame Pass-through (Wujie eventBus)
Renderer frames SHALL only relay store updates, lifecycle events, and inter-end messages to inner HTML via Wujie eventBus using namespaced event names.

#### Scenario: Store update relay
- WHEN main-process publishes a store update for `<pluginId>`,
- THEN the frame receives it via IPC and `$emit('plugin:<pluginId>:store-update', payload)` to the inner page.

#### Scenario: Lifecycle relay
- WHEN main-process publishes a lifecycle event (start/login/begin-live/fetch-danmu/stop-live/logout/stop-danmu/exit) for `<pluginId>`,
- THEN the frame `$emit('plugin:<pluginId>:lifecycle', payload)` to the inner page.

#### Scenario: Inter-end message relay (UI/window → overlay)
- WHEN UI/window sends a message via HTTP `POST /api/plugins/<pluginId>/overlay/messages`,
- THEN the message center delivers it over SSE to the overlay frame,
- AND the frame `$emit('plugin:<pluginId>:overlay-message', payload)` to the inner overlay HTML.

### Requirement: Overlay Link and SSE Base Alignment
UI SHALL build overlay links and SSE URLs using the ApiServer base from bridge (`get-api-base`).

#### Scenario: Build overlay link
- WHEN UI needs an overlay link for `<pluginId>`,
- THEN it uses `/overlay-wrapper?plugin=<pluginId>&type=overlay` on the Api base,
- AND copies the absolute URL for use in OBS browser source.

#### Scenario: SSE subscription in frame
- WHEN overlay frame subscribes to messages,
- THEN it opens `GET /sse/plugins/<pluginId>/overlay` on the Api base and relies on SSE auto-reconnect with `Last-Event-ID`,
- AND re-emits all incoming SSE messages to inner HTML via Wujie eventBus.

### Requirement: Remove manual overlay controls in UI
UI SHALL not expose manual overlay lifecycle controls (create/update/close/show/hide/bring-to-front/list).

#### Scenario: Message-only controls
- WHEN users interact with UI/window to send messages to overlay,
- THEN the frame forwards a message request to the main-process via HTTP/IPC; no lifecycle controls are shown.
- **WHEN** a user navigates the UI to open a plugin
- **THEN** the system SHALL NOT open a separate BrowserWindow via a "plugin popup" mechanism.

#### Scenario: Overlay remains available in UI
- **WHEN** floating overlay behavior is needed
- **THEN** the UI SHALL utilize overlay capabilities; popup windows are not implemented.

### Requirement: Overlay Presence per Browser Source
The desktop UI SHALL mount exactly one overlay per browser source. The UI MUST NOT implement overlay stacking, z-index layer management, or multi-overlay toggles.

#### Scenario: Single overlay across navigation
- **WHEN** the user navigates between plugin pages or toggles visibility
- **THEN** the system SHALL keep one overlay instance for the source
- **AND** MUST NOT create additional overlays nor expose stacking APIs

### Requirement: Wujie Acceptance in Overlay
The overlay context MUST accept UI/Window requests through Wujie. UI/Window MUST use HTTP endpoints to request overlay actions; reverse HTTP from Overlay to UI/Window MUST NOT exist.

#### Scenario: UI → Overlay request path via Wujie
- **WHEN** UI calls an overlay action through HTTP
- **THEN** Wujie SHALL route the action into the overlay context
- **AND** the overlay SHALL process it and MAY emit events via Wujie back to UI/Window

### Requirement: Overlay Demo Panel Status Display
The desktop UI MUST show the current registration status for the selected overlay (`registered` / `unregistered`). The status SHOULD update in real time.

#### Scenario: Update status via SSE action
- **WHEN** an SSE event with `eventType: 'action'` and `type: 'overlay-registered'` arrives
- **THEN** the UI shows the overlay as `registered`
- **AND WHEN** a subsequent event with `type: 'overlay-unregistered'` arrives
- **THEN** the UI shows the overlay as `unregistered`

#### Scenario: Fallback via IPC broadcast
- **WHEN** SSE action forwarding is unavailable
- **THEN** the UI subscribes to a main-process IPC broadcast `overlay.action`
- **AND** mirrors status updates based on the broadcast payloads

### Requirement: Message Input and Send
The desktop UI MUST provide a text input and a send button to push messages to the overlay via `overlay.send(overlayId, 'demo-message', payload)` or `POST /api/overlay/:overlayId/send`.

#### Scenario: Send message and overlay displays it
- **WHEN** the user enters text and clicks the send button
- **THEN** the UI calls `overlay.send(overlayId, 'demo-message', { text })`
- **AND** the overlay messages pane displays the content via SSE `message`

### Requirement: Overlay Link Generation and Copy
The desktop UI MUST generate the overlay URL and provide copy-to-clipboard functionality, preserving required query parameters (e.g., room, token).

#### Scenario: Copy URL to clipboard
- **WHEN** the user clicks `Copy link`
- **THEN** the overlay URL (with required params) is written to the clipboard
