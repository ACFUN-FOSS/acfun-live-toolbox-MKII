# Implementation Tasks

*注意：所有UI组件和布局必须针对1024x768分辨率进行优化设计*

## 1. 路由系统设置（完整导航结构）
- [x] 1.1 安装和配置Vue Router 4
- [x] 1.2 创建路由配置文件 `src/router/index.ts`
- [x] 1.3 定义ui2.json中指定的完整路由树结构
  - [x] 1.3.1 首页路由 (/home)
  - [x] 1.3.2 直播功能路由 (/live, /live/room, /live/danmu)
  - [x] 1.3.3 插件管理路由 (/plugins, /plugins/management, /plugins/:plugname)
  - [x] 1.3.4 系统功能路由 (/system, /system/settings, /system/console, /system/develop)
- [x] 1.4 在App.vue中集成Vue Router
- [x] 1.5 实现动态插件路由注册机制

## 2. LayoutShell组件实现（1024x768优化）
- [x] 2.1 创建LayoutShell.vue主布局组件
- [x] 2.2 实现topbar区域（40px高度，适配1024px宽度）
- [x] 2.3 实现sidebar区域（208px宽度，适配728px高度）
- [x] 2.4 实现RouterView内容区域（816x728px可用空间）
- [x] 2.5 添加1024x768分辨率下的响应式布局支持

## 3. Topbar组件开发
- [x] 3.1 创建Topbar.vue组件
- [x] 3.2 实现左侧应用标题和拖拽区域
- [x] 3.3 实现中央账户区域和房间状态指示器
- [x] 3.4 实现右侧窗口控制按钮（最小化/关闭）
- [x] 3.5 集成账户弹出卡片和房间状态抽屉

## 4. Sidebar导航组件（完整导航结构）
- [x] 4.1 创建Sidebar.vue组件
- [x] 4.2 实现基于t-menu的多层级导航菜单
- [x] 4.3 添加路由高亮功能
- [x] 4.5 实现动态插件导航显示
  - [x] 4.5.1 从插件管理页面获取侧边栏显示配置
  - [x] 4.5.2 动态渲染插件入口菜单项
  - [x] 4.5.3 支持插件菜单项的启用/禁用状态

## 5. 页面组件迁移和新增
- [ ] 5.1 重构HomePage组件以匹配ui2.json规范
  - [ ] 5.1.1 实现WelcomeCard（欢迎引导）
  - [ ] 5.1.2 实现UserInfoCard（用户信息/二维码登录）
  - [ ] 5.1.3 实现KPISection（统计指标+ECharts）
- [ ] 5.2 更新PluginsPage为标准页面组件
- [x] 5.3 创建直播功能页面组件
  - [x] 5.3.1 创建LivePage组件（直播主页面）
  - [x] 5.3.2 创建LiveRoomPage组件（房间管理）
  - [x] 5.3.3 创建LiveDanmuPage组件（弹幕设置）
- [ ] 5.4 创建SystemPage组件
  - [ ] 5.4.1 实现日志管理标签页
  - [ ] 5.4.2 实现配置导出标签页
  - [ ] 5.4.3 实现诊断标签页
- [ ] 5.5 更新SettingsPage组件
  - [ ] 5.5.1 实现网络设置标签页
  - [ ] 5.5.2 实现导出设置标签页
  - [ ] 5.5.3 实现系统设置标签页
- [ ] 5.6 创建SystemDevelopPage组件（开发文档）
- [ ] 5.7 创建ConsoleEmbedPage组件
- [ ] 5.8 创建ErrorPage和NotFoundPage组件

## 6. 插件系统集成（增强版）
- [x] 6.1 创建PluginFramePage组件用于插件承载
- [x] 6.2 更新插件路由配置 `/plugins/:id/(.*)?`
- [x] 6.3 保持Wujie微前端集成
- [x] 6.4 确保插件弹窗功能正常工作
- [x] 6.5 实现插件管理页面的侧边栏显示配置
- [x] 6.6 实现动态插件路由注册和注销
- [x] 6.7 支持插件自定义导航标签和图标

## 7. 状态管理更新
- [x] 7.1 安装和配置Pinia
- [x] 7.2 创建useAccountStore
- [x] 7.3 创建useRoomStore
- [x] 7.4 创建usePluginStore
- [x] 7.5 创建useUiStore

## 8. 样式和主题（1024x768适配）
- [ ] 8.1 确保TDesign主题变量正确应用
- [ ] 8.2 实现全局样式重置，针对1024x768分辨率优化
- [ ] 8.3 添加1024x768分辨率的专用样式规则
- [ ] 8.4 优化滚动条样式，适配较小屏幕空间
- [ ] 8.5 确保所有组件在1024x768下的字体、间距、尺寸合理
- [ ] 8.6 添加最小窗口尺寸限制（1024x768）

## 9. 测试和验证（1024x768分辨率）
- [x] 9.1 测试所有路由导航功能
  - [x] 9.1.1 测试基础路由跳转（首页、直播、插件、系统）
  - [x] 9.1.2 测试直播子路由（房间管理、弹幕设置）
  - [x] 9.1.3 测试系统子路由（设置、控制台、开发文档）
  - [x] 9.1.4 测试动态插件路由注册和跳转
- [x] 9.2 验证1024x768分辨率下的布局响应性
- [x] 9.3 测试所有页面在1024x768下的显示效果
- [x] 9.4 验证内容区域滚动和溢出处理
- [ ] 9.5 测试键盘快捷键功能（Alt+1-5）
- [x] 9.6 验证插件系统在新布局下的兼容性
- [x] 9.7 测试动态插件导航的显示和隐藏
- [x] 9.8 验证所有页面组件的功能完整性
 
## 10. 额外微调（2025-11-04）
- [x] 欢迎卡片：增加三步使用指南，移除“查看指南”按钮
- [x] 账号卡片：头像缩小至原大小的40%，优化对齐与间距
- [x] 账号卡片：头像调整为150px宽高
- [x] 账号卡片：切换账号/退出登录按钮改为medium并居中卡片底端
- [x] 账号卡片：profile-header的margin-bottom设为36px
 - [x] 欢迎卡片：移除“前往直播工具”按钮；三步指南可点击并导航到对应页面（房间/插件管理/系统控制台），并添加悬浮交互效果
 - [x] 账号卡片：将“复制”改为“个人空间”按钮，点击使用外部浏览器打开用户空间（通过system.openExternal桥接）；统计数据区增加悬浮与点击交互样式
 - [x] 账号卡片：移除原footer区域（切换账号/退出登录）；在个人空间按钮右侧新增“退出登录”按钮，两个按钮样式完全一致；头像调整为120×120圆形
 - [x] 主播统计页面：重构为数据可视化总览与趋势（mock数据）；顶部显示直播次数、总时长、点赞、香蕉、礼物；底部为柱+折线混合图（柱：每日时长；线：点赞/香蕉/礼物），支持按日/周/月粒度切换，样式与TDesign一致

## 11. 清理与兼容性（2025-11-08）
- [x] 移除未引用的 `MainLayout.vue`（保留 `LayoutShell` 标准路由布局；插件承载迁移至路由页面，避免冗余旧模式）
- [x] 移除未引用的组件：`TopDanmuBar.vue`、`LeftPluginNav.vue`
- [x] 移除未引用的叠加层旧组件：`OverlayManager.vue`、`OverlayRenderer.vue`、`overlay/TestOverlayComponent.vue`
- [x] 移除未引用的插件弹窗旧组件：`PluginPopupManager.vue`、`PluginPopup.vue`
- [x] 移除未引用的事件过滤组件：`EventFilterBar.vue`
- [x] 移除未引用的页面：`pages/Events.vue`
- [x] 移除未引用的示例资源：`assets/vue.svg`
 - [x] 移除 `src/router/index.ts`，统一使用 `src/router.ts` 路由入口
- [x] 更新：`pages/PluginFramePage.vue` 已移除对 `components/CentralPluginContainer.vue` 的使用，改为以右侧主显示区域全屏 `iframe` 统一承载插件 UI，并追加最小 `postMessage` 桥接（`overlay.action/close/update/send`）到真实 `preload` API。
 - [x] 已删除：`components/CentralPluginContainer.vue`（全仓代码确认不再引用）
 - [x] 移除未引用文件：`components/Console/ConsoleView.vue`、`pages/LivePage.vue`、`pages/PluginsPage.vue`、`pages/SystemPage.vue`、`components/overlay/`（空目录）
 - [x] 类型检查修复：移除 `types/global.d.ts` 中对 `acfunlive-http-api/dist/...` 与 `acfunlive-http-api/src/...` 的 `any` 模块声明；在 `packages/renderer/tsconfig.app.json` 新增 `paths` 映射到 `../main/node_modules/acfunlive-http-api/dist/*`，让 TypeScript 使用真实声明文件进行检查。
 - [x] 允许 iframe 承载插件 UI：在 `packages/main/src/server/ApiServer.ts` 的 `helmet` 配置中禁用 `frameguard`，移除全局 `X-Frame-Options`，确保 `http://127.0.0.1:<port>/plugins/:id/...` 可在渲染进程 iframe 中加载。
 - [x] 修复 postMessage DataCloneError：`PluginFramePage.vue` 中对初始化消息负载进行深度清理为结构化克隆安全的纯数据（移除函数/代理/循环引用），避免 `postMessage` 报错。
