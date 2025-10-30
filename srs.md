
# AcFun Live Manager（Electron）— 需求规格说明书（SRS）

## 1. 文档元信息

* **Spec 版本**：1.0.0
* **项目标题**：AcFun Live Manager (Electron)
* **文档作者**：根据来稿整理
* **生成对象**：AI 代码生成（如“gpt5-pro”流水线）
* **生成时间**：2025-10-30（America/Los\_Angeles）
* **适用环境**：Windows / macOS / Linux（Electron 桌面端）
* **上游核心库**：`ACFUN-FOSS/acfundanmu.js`（MIT 许可，2025-10-28 有更新记录）([GitHub][1])

> **合规与注意**：`acfundanmu.js` 为 ACFUN-FOSS 组织下的 JavaScript/TypeScript 项目，仓库标注 **MIT License**；保持与其 API/事件模型的兼容与二进制隔离（通过主进程适配器）。([GitHub][1])

---

## 2. 项目背景与范围

Electron 本地客户端为主播（Anchor）提供**多房间弹幕接入、事件标准化与本地持久化**，并暴露 **LAN 内 HTTP/WS 服务**与**混合插件模型（web + node-assisted）**。
**核心尽可能最小化**：登录、多房间连接、事件标准化入库、基础控制台与插件生命周期；**高级功能**（高亮、OBS、TTS、抽奖、旁观他人房间）由插件实现。

**不在本期范围**（明确非目标）：

* 公开在线插件市场；
* 插件最小权限强约束；
* 出站代理；
* Overlay Token 过期与 UA/IP 白名单。

---

## 3. 角色与典型能力

1. **Anchor（主播）**：在直播电脑上运行客户端

* 扫码登录；管理≤3 个房间；打开插件窗口；CSV 导出

2. **Operator/Controller（同局域网）**：浏览器访问 `http://host:port`

* 查看状态与事件；访问插件页面；打开 Overlay URL

3. **Plugin Developer（本地插件开发者）**：以 zip/tgz 导入

* 用 **wujie** 声明路由与设置页；注册 Overlay；通过主进程**转发**HTTP/WS（不可见真实 Token）；仅经主进程写入 SQLite

---

## 4. 目标与非功能性要求（NFR）

* **性能**：单房间 1000\~2000 事件/分钟突发；端到端延迟 ≤ 500ms（主进程异步写队列避免阻塞 UI）
* **可靠性**：集中 WS；快速重试 + 退避重连；单插件熔断不影响核心
* **安全**：Token 仅主进程可见；插件从不读取 Token；Overlay 仅以查询 Token 保护（无过期）
* **可运维**：系统/插件日志、可视化日志视图、**一键诊断包**导出
* **跨平台**：Win/macOS/Linux

---

## 5. 外部依赖与合规（面向 AI 代码生成的硬约束）

* **acfundanmu.js（ACFUN-FOSS）**：AcFun 弹幕/直播协议的 JS/TS 实现（仓库 MIT License）([GitHub][1])
* **仓库活跃度**：组织公开仓库页显示 `acfundanmu.js` 更新到 2025-10-28（用于“选择最新兼容版本”的自动化校验）([GitHub][2])
* **运行时**：Node.js ≥16、Electron（主进程集中连接）、Express（本地 HTTP/WS）
* **持久化**：SQLite（`userData/db/events.db`）
* **插件前端**：wujie（微前端挂载）

> **AI 生成器提示**：生成任何与 AcFun 弹幕连接相关代码时，**唯一上游库**应为 `ACFUN-FOSS/acfundanmu.js`；不得引用 `ac-danmu.js` 或 `orzogc/acfundanmu`。

---

## 6. 总体架构与层次职责

### 6.1 层次

* **electron\_main\_process**

  * 通过 `acfundanmu.js` 统一管理 ≤3 个房间的 WebSocket；
  * 将所有上行/下行事件**标准化**；写入 SQLite（单大表）；
  * 启动 Express，提供 `/api/*`、`/console`、`/plugins/:id/*`、`/overlay/:overlayId`；
  * 插件生命周期（安装/加载/启用/暂停），API 转发（附加 Token）；
  * 统一日志与诊断导出。
* **renderer\_builtin\_ui**

  * A3 布局主界面：账号/房间状态、最简事件条、插件管理、日志视图
* **plugin\_runtime\_mixed**

  * Web 插件（wujie）+ 可选 Node Worker（由主进程托管）
  * 受控 API：事件订阅、受控 DB 写、受控 API 转发、路由/Overlay 注册
* **external\_access\_layer**

  * `http://host:port/console` 控制台、插件路由与 Overlay 路由

### 6.2 数据流（关键路径）

```
acfundanmu.js → 主进程 normalize → SQLite(异步队列) → 广播给 renderer / plugins / overlays
plugin → 主进程 →（附加 Token）→ AcFun API → 返回给 plugin（插件不可见 Token）
renderer/plugin → 主进程 → 保存 config/secrets/plugins settings 到 userData
```

---

## 7. 与 `acfundanmu.js` 的对接规范（Adapter 合同）

> 目的：将第三方库暴露的事件/会话语义收敛为**平台标准事件**与**统一控制 API**，对上提供稳定 TS 类型，对下可替换升级库版本。

### 7.1 版本选择与加载

* **版本锁定**：在 `package.json` 以 `~` 或 `^` 约束**次版本**更新；新增大版本需人工验收
* **License 校验**：启动时读取依赖树，确保 `acfundanmu.js` 为 **MIT**；否则阻止启动并给出诊断（日志 + UI）([GitHub][1])

### 7.2 连接管理（伪代码）

```ts
// main process
import { createClient, type DanmuEvent, type RoomConn } from 'acfundanmu.js-adapter'; 
// ↑ 本项目自建 adapter，内部 wrap ACFUN-FOSS/acfundanmu.js 的具体 API

class RoomManager {
  private conns: Map<string, RoomConn>;
  async connect(roomId: string, opts: { primary?: boolean }) {
    assert(this.conns.size < 3);
    const conn = await createClient({ roomId, /* ...login token from secrets.json */ });
    this.bind(conn, roomId);
    this.conns.set(roomId, conn);
  }
  private bind(conn: RoomConn, roomId: string) {
    conn.on('open',     () => this.emitStatus(roomId, 'open'));
    conn.on('close',    (e) => this.scheduleReconnect(roomId, e));
    conn.on('danmaku',  (e) => this.ingest(normalize(roomId, 'danmaku', e)));
    conn.on('gift',     (e) => this.ingest(normalize(roomId, 'gift', e)));
    conn.on('like',     (e) => this.ingest(normalize(roomId, 'like', e)));
    conn.on('follow',   (e) => this.ingest(normalize(roomId, 'follow', e)));
    conn.on('enter',    (e) => this.ingest(normalize(roomId, 'enter', e)));
    conn.on('system',   (e) => this.ingest(normalize(roomId, 'system', e)));
  }
}
```

### 7.3 标准化事件（**平台唯一事件形状**）

```ts
type NormalizedEventType = 'danmaku'|'gift'|'follow'|'like'|'enter'|'system';
interface NormalizedEvent {
  ts: number;               // ms epoch
  room_id: string;
  event_type: NormalizedEventType;
  user_id?: string|null;
  user_name?: string|null;
  content?: string|null;
  raw: unknown;             // 原始事件（acfundanmu.js 结构）
}
```

> **说明**：事件类型列表源自本项目统一规范；库的原始枚举需在 Adapter 中进行映射与补全（兼容差异字段名/嵌套）。

### 7.4 重连策略

* **快速重试** `N=5` 次（100ms、200ms、400ms、800ms、1.6s），随后**指数退避**（上限 60s）
* 任一连接失败不影响其他房间；主进程状态广播到 UI 与插件

---

## 8. 数据持久化

* **数据库**：SQLite（`userData/db/events.db`）
* **唯一表**：`events`（**所有**类型事件写入同表）

```sql
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  room_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT,
  content TEXT,
  raw_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_room_ts ON events (room_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events (event_type, ts);
```

* **CSV 导出**：字段 `ts,room_id,event_type,user_id,user_name,content`；
  过滤条件：时间范围、`room_id`；
  默认导出目录：`userData/exports/`（**英文文件名**，如 `events-2025-10-30T08-00-00.csv`）

---

## 9. 本地 HTTP/WS 服务（Express，主进程内）

### 9.1 路由

* `GET /api/events?room_id&from_ts&to_ts&type` → 查询分页事件
* `POST /api/export` → 触发 CSV 导出（返回文件名与保存路径）
* `GET /console` → LAN 控制台（免认证，面向同局域网）
* `GET /plugins/:id/*` → 插件页面（wujie/静态资源托管）
* `GET /overlay/:overlayId` → Overlay 入口（Query：`room`,`token`）

### 9.2 WebSocket（服务端 → 客户端广播）

```json
// 事件推送帧
{
  "op": "event",
  "d": {
    "ts": 1730265600123,
    "room_id": "12345",
    "event_type": "danmaku",
    "user_id": "u1",
    "user_name": "Alice",
    "content": "hello",
    "raw": { /* redacted */ }
  }
}
```

---

## 10. 登录与凭证

* **登录方式**：AcFun **二维码登录**（主进程内实现；插件不可见）
* **存储**：`userData/secrets.json`（仅主进程可读写）
* **渲染进程**：仅获知“登录状态与账号昵称”等**非敏感**信息
* **API 转发**：插件调用 `callAcfun({ method, path, body })` → 主进程自动附加 Token → 发起请求 → 返回结果（不暴露 Token）

---

## 11. 插件模型（Mixed：web-first + optional node-assisted）

### 11.1 安装与结构

* **来源**：本地 `zip/tgz` 导入；解压到 `userData/plugins/<pluginId>/`
* **Manifest（示例）**：

```json
{
  "name": "awesome-plugin",
  "version": "1.2.3",
  "entry": "dist/index.html",
  "routes": ["/plugins/:id", "/plugins/:id/settings"],
  "overlays": ["/overlay/:overlayId"],
  "engine": { "min": "1.0.0", "max": "1.x" },
  "needsNodeWorker": false
}
```

* **强制前缀**：页面路由 `/plugins/:id/*`，Overlay 路由 `/overlay/:overlayId`

### 11.2 受控 API（由主进程注入/代理）

* **事件订阅**：

  * `subscribeEvents({ roomId?, types? })`
  * 事件流：`onDanmaku/onGift/onLike/onFollow/onEnter/onSystem/onRoomStatusChange`
* **AcFun 调用转发**：`callAcfun({ method, path, body })`（主进程附 Token）
* **直播动作**：`sendComment`、`sendLike`、`kickBan`（权限校验由主进程依据登录账号判定）
* **插件存储**：`pluginStorage.write(pluginId, table, row)`（主进程代写 SQLite，采用**插件前缀表**）
* **HTTP 路由注册**：`registerHttpRoute(pluginId, routeDef)` → 暴露在 `/plugins/:id/*`
* **UI 注册**：wujie 挂载 `/plugins/:id` 与 `/plugins/:id/settings`
* **Overlay 注册**：`/overlay/:overlayId`（Express 托管 HTML/JS）

### 11.3 插件熔断

* N 次异常/短时窗口触发熔断 → **仅暂停该插件**，提供 UI 恢复按钮；核心与他插件不受影响

---

## 12. 内置 UI（A3 布局）

* **左侧栏**：账号卡片+扫码登录状态；房间列表（≤3，状态灯）；服务状态（WS/SQLite/HTTP 端口）
* **主区域 Tabs**：Plugins / Settings / Logs
* **事件条（右上或底栏）**：显示最新事件；动作：展开最近 20 条、打开“弹幕显示”插件窗口
* **Web Console**：`http://host:port/console`（LAN 免认证；移动端便于操控）

---

## 13. 配置与迁移

* `userData/config.json`（`configVersion,httpPort,uiLayout,rooms[],pluginDir`）
* `userData/secrets.json`（`acfun_token,refresh_token,...`）
* 插件设置：`userData/plugins/<id>/settings.json`（**仅**经主进程写入服务）
* 启动迁移：若 `configVersion` 过旧则**补字段**回写；坏文件重命名 `config.broken-<ts>.json` 并生成默认新档

---

## 14. 日志与诊断

* **系统日志**：连接/断线/重连、插件加载、插件异常堆栈（敏感字段脱敏）、SQLite/端口冲突
* **落盘策略**：滚动日志（10MB × 5）
* **UI 日志页**：展示最近 N 行
* **诊断包**：一键导出 `diagnostic-package.zip`，含日志、系统信息、插件清单（不含 Token）、SQLite 架构子集与非敏感配置

---

## 15. 典型流程（时序要点）

1. **启动**：读取配置与密钥 → 启动 Express → 扫描插件并注册路由/Overlay → 加载内置 UI
2. **扫码登录**：渲染进程触发 → 主进程与 AcFun 登录 API 交互 → 写入 `secrets.json` → 广播登录状态
3. **连接房间**：渲染进程提交 `room_id` → 主进程创建 `acfundanmu.js` 连接 → 事件 Normalize → 入库（异步）→ 广播到 UI/插件/Overlay
4. **OBS Overlay**：复制 `http://host:port/overlay/:overlayId?room=:roomId&token=:token` → OBS 浏览器源加载
5. **CSV 导出**：触发 `/api/export` → 查询 SQLite → 保存至 `userData/exports/`（英文文件名）

---

## 16. 可测试需求（Acceptance Criteria）

**A. 连接与重连**

* [ ] 在网络抖动 30s 内，连接保持自动恢复，平均恢复时间 ≤ 3s（快速重试+退避）
* [ ] 同时连接 3 房间，互不影响

**B. 事件标准化与持久化**

* [ ] 任一事件到达 → ≤100ms 内写入队列；后台批量落盘
* [ ] `events` 表记录字段与索引符合定义；`raw_json` 可用于审计复现
* [ ] 查询 `/api/events` 在 10 万行数据下 95p 响应 ≤ 200ms（带索引过滤）

**C. 安全与隔离**

* [ ] 插件侧任何路径均无法读到 Token（代码审计 + 渗透测试用例）
* [ ] `callAcfun` 的请求头由主进程注入，插件无法覆写/读取

**D. 插件生命周期与熔断**

* [ ] 单插件连续异常 N 次后自动暂停；其余插件与核心不中断
* [ ] UI 可手动恢复，恢复后事件订阅能重建

**E. 导出与诊断**

* [ ] CSV 文件名英文、含时间戳；导出完成可在 UI 下载/打开目录
* [ ] 诊断包包含所列内容且**不包含**任何 Token/敏感字段

---

## 17. 工程落地与目录建议

```
/app
  /main                # Electron 主进程
    adapter/           # acfundanmu.js 适配层（事件映射、连接封装）
    api/               # Express 各 /api/* 路由与 WS 广播
    persistence/       # SQLite 队列、DAO、迁移
    plugins/           # 插件生命周期、受控 API 实现
    logging/           # 日志、诊断包
  /renderer            # 内置 UI（A3 布局 + wujie 容器）
  /overlays            # 内置 Overlay 示例（可选）
  /shared              # 公共类型（NormalizedEvent 等）
  /scripts             # 构建/打包/版本校验
  /tests               # 集成/契约测试
```

---

## 18. 关键接口与类型（面向 AI 生成器的“契约”）

### 18.1 主进程 IPC（Renderer ↔ Main）

```ts
// Renderer -> Main
ipc.invoke('login.startQr');                  // 开始扫码登录
ipc.invoke('room.connect', { roomId, primary? });
ipc.invoke('room.disconnect', { roomId });
ipc.invoke('export.csv', { roomId?, fromTs?, toTs? });

// Main -> Renderer (事件广播)
ipc.on('event.new', (ev: NormalizedEvent) => {});
ipc.on('room.status', ({ roomId, status }) => {}); // open/closing/reconnecting/...
```

### 18.2 插件受控 API（Node/Browser 可用）

```ts
declare global interface PluginAPI {
  subscribeEvents(f: { roomId?: string; types?: NormalizedEventType[] }, cb: (e: NormalizedEvent)=>void): Unsubscribe;
  callAcfun(req: { method:'GET'|'POST'|'PUT'|'DELETE', path:string, body?:any }): Promise<any>;
  pluginStorage: { write(pluginId: string, table: string, row: any): Promise<void> };
  registerHttpRoute(pluginId: string, def: { method:'GET'|'POST', path:string }, handler: (req,res)=>void): void;
}
```

### 18.3 HTTP 接口草案

```http
GET /api/events?room_id=123&from_ts=...&to_ts=...&type=danmaku|gift|...
200 { items: NormalizedEvent[], next?: string }

POST /api/export
Body: { room_id?: string, from_ts?: number, to_ts?: number }
200 { filename: "events-2025-10-30T08-00-00.csv", path: "C:/Users/.../exports/..." }
```

---

## 19. 更新与回滚

* **应用与数据分离**：更新不触及 `userData/*`
* **在线更新（可选）**：下载至 `userData/updates/`，重启后应用
* **回滚**：配置仅增字段；SQLite 迁移用 `ALTER TABLE` 或元版本策略；插件遇到不兼容仅**标记**为不可用，不删除文件

---

## 20. 风险与缓解

* **上游库接口变更**：以适配层隔离；对 `acfundanmu.js` 版本做最小化升级策略，新增大版本走专门回归
* **高峰入库压力**：批量写 + WAL 模式 + 轻量索引
* **插件滥用主进程**：严格走受控 API；限流与审计日志
* **LAN 暴露面**：默认端口在 UI 可见；提醒用户在不可信 LAN 内谨慎暴露

---

## 21. 面向 AI 代码生成的提示（Prompts/Policies）

* **唯一弹幕库**：指向 `ACFUN-FOSS/acfundanmu.js`；若生成代码包含其它库名（`ac-danmu.js`、`orzogc/acfundanmu` 等），视为违规产物，需自动重写
* **契约优先**：以本 SRS 的类型与路由为“单一事实来源”；生成器应先产出 `adapter/`（事件映射与会话管理）与 `persistence/`（异步写队列）
* **测试先行**：生成集成测试覆盖三类事件（danmaku/gift/enter）与断线重连回归
* **日志红线**：严禁日志中输出 Token/请求头

---

## 22. 参考与佐证

* `ACFUN-FOSS/acfundanmu.js` 仓库主页（MIT 许可）与目录结构概览（docs/protos/src/tests 等），用于确认上游为官方 FOSS 组织并可集成。([GitHub][1])
* ACFUN-FOSS 组织仓库列表中 `acfundanmu.js` 的**最近更新时间（2025-10-28）**，用于版本选择与更新监控。([GitHub][2])

---


[1]: https://github.com/ACFUN-FOSS/acfundanmu.js "GitHub - ACFUN-FOSS/acfundanmu.js"
[2]: https://github.com/orgs/ACFUN-FOSS/repositories "ACFUN-FOSS repositories · GitHub"
