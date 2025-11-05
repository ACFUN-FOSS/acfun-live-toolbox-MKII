## ADDED Requirements

### Requirement: Home Right Pane 2×2 Card Grid
首页右侧内容区域（不含左侧导航与头部外壳）必须在 792×704 视口下以 2×2 卡片栅格（A,B,C,D）呈现，且无纵向滚动。

#### Scenario: Fixed viewport layout
- **WHEN** 用户在 792×704 视口查看首页
- **THEN** 右侧内容以 2×2 卡片栅格填充（A 左上、B 右上、C 左下、D 右下）
- **AND** 右侧内容区域无纵向滚动
- **AND** 每列采用 12 栅格中的 `span=6`，不使用固定像素（分数单位布局）

#### Scenario: Remove persistent right quick-actions bar
- **WHEN** 首页右侧渲染完成
- **THEN** 不存在右侧区域的持久化顶部快捷操作条

### Requirement: Card A — Welcome and Single Primary Action
卡片 A 仅包含欢迎文案与一个“按角色”主行动按钮，点击后路由到对应页面。

#### Scenario: Role-based CTA routing
- **WHEN** 用户点击卡片 A 的主行动按钮
- **THEN** 若角色为主播，路由至 `/stream/start`
- **AND** 若角色为房管，路由至 `/rooms`
- **AND** 若角色为开发，路由至 `/debugger`

### Requirement: Card B — Account Information and Login/Logout
卡片 B 展示账户信息；未登录时显示登录按钮；已登录时显示用户名、UID（可复制且有成功提示）、签名（两行截断）、粉丝数（紧凑格式）与退出登录按钮。

#### Scenario: Not logged in
- **WHEN** `auth.isLoggedIn=false`
- **THEN** 卡片 B 显示“登录”按钮，点击后进入 `/login`

#### Scenario: Logged in fields and actions
- **WHEN** `auth.isLoggedIn=true`
- **THEN** 显示用户名、UID（可复制并提示成功）、签名（两行截断，空则显示“暂无签名”）、粉丝数（紧凑格式）与“退出登录”按钮

### Requirement: Card C — Role-Driven Overview with 7d/30d Toggle
卡片 C 根据角色展示不同的历史概览，并提供 `7d/30d` 范围切换，仅影响 C 卡的数据加载。

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
卡片 D 展示文档列表的前 3 项，且提供“查看更多”链接。

#### Scenario: Docs list and more
- **WHEN** 成功获取文档列表
- **THEN** 展示前 3 项，包含标题/描述与“打开”链接（新标签）
- **AND** 提供“查看更多”链接到 `/docs`（或外部文档枢纽）

### Requirement: First Login Role Selection Dialog
首次登录且无持久化角色时必须弹出角色选择对话框；确认后持久化并驱动右侧卡片重渲染。头像下拉菜单的角色切换同样驱动卡片重渲染。

#### Scenario: First login role dialog
- **WHEN** `GET_ROLE` 返回 `null`
- **THEN** 打开角色选择对话框，确认后持久化角色并关闭对话框，右侧 A/B/C/D 按角色重渲染

#### Scenario: Avatar dropdown role switching
- **WHEN** 用户在头像下拉菜单切换角色
- **THEN** 更新 `role.current` 并触发 2×2 卡片区域重新渲染

### Requirement: Per-card Loading and Error Handling
各卡片独立显示加载骨架与错误横幅，并提供重试，不互相阻塞。`401` 的处理在卡片 B 上显示登录按钮，其他卡片显示空态与单 CTA。

#### Scenario: Card-specific loading and retry
- **WHEN** 卡片数据加载中或失败
- **THEN** 显示骨架或错误横幅，并提供重试；其他卡片不受影响

#### Scenario: 401 handling
- **WHEN** 接口返回 401
- **THEN** 卡片 B 显示登录按钮；其他卡片显示空态与单一 CTA

### Requirement: Transport Selector (IPC → HTTP → Mock)
优先使用主进程 IPC 通道；不可用时回退 HTTP；最后使用 Mock。各端点需遵循 `ui-main.json` 的 `request_transform`/`response_transform`。

#### Scenario: Boot sequence and transport
- **WHEN** 页面初始化
- **THEN** 执行引导序列：`GET_ROLE → GET_USER → (按角色并行) GET_ANCHOR_STATS/GET_MOD_ROOMS/GET_DEV_METRICS → GET_DOCS`
- **AND** 传输优先级按 IPC → HTTP → Mock 执行；字段映射遵循 transform 规则