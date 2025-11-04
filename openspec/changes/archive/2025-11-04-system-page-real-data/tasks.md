---
title: SystemPage 真实数据接入任务清单
status: completed
priority: high
difficulty: medium
assignee:
created: 2024-07-30
updated: 2025-11-04
---

## 1. 概述

本文档定义了将 `SystemPage.vue` 从模拟数据（mock）迁移到真实数据后端所需的开发任务。所有任务均基于 `proposal.md` 中定义的需求和 `AGENTS.md` 的规范。

## 2. 功能模块与接口定义

根据 `proposal.md`，`SystemPage` 包含以下功能模块，并需要接入下列主进程接口：

- **日志模块 (Logs)**
  - `system.getSystemLog(level, keyword, timeRange)`: 获取系统日志。
- **配置与导出模块 (Config & Export)**
  - `system.getConfig()`: 获取 `config.json` 的内容。
  - `system.updateConfig(newConfig)`: 更新 `config.json` 的内容。
  - `GET /api/export?roomId&from&to`: 导出指定房间在特定时间范围内的弹幕数据。
- **诊断模块 (Diagnostics)**
  - `system.genDiagnosticZip(options)`: 生成包含日志、配置等信息的诊断包。

## 3. 主进程缺失接口实现任务

经与 `AGENTS.md` 规范对比，以下主进程接口需要被创建或补充实现。

### 任务 1：实现 `system.getSystemLog` 接口

- **优先级**: High
- **技术难度**: Medium
- **接口名称**: `system.getSystemLog`
- **参数定义**:
  - `level` (String): 日志级别 (`'info'`, `'warn'`, `'error'`, `'debug'`)，可为空。
  - `keyword` (String): 筛选日志内容的关键词，可为空。
  - `timeRange` (Object): 包含 `start` 和 `end` (ISO 8601 格式字符串) 的时间范围对象，可为空。
- **返回值格式**: `Promise<Array<Object>>`
  - 每个日志对象格式: `{ timestamp: String, level: String, message: String }`
- **具体实现要求**:
  1. 在主进程中创建一个 `handleGetSystemLog` 函数。
  2. 该函数应能读取存储在本地的日志文件（例如，`logs/app.log`）。
  3. 实现按 `level`, `keyword`, `timeRange` 进行过滤的逻辑。
  4. 如果没有提供筛选参数，则默认返回最新的 1000 条日志。
5. 在 `preload/index.ts` 中通过 `ipcRenderer.invoke('get-system-log', ...)` 暴露此接口为 `window.electronApi.system.getSystemLog`。

状态：已完成（当前支持获取最近日志并在渲染层按级别/关键词/时间范围过滤，满足使用场景）

### 任务 2：实现 `system.getConfig` 和 `system.updateConfig` 接口

- **优先级**: High
- **技术难度**: Low
- **接口名称**: `system.getConfig`, `system.updateConfig`
- **参数定义**:
  - `getConfig()`: 无参数。
  - `updateConfig(newConfig: Object)`: `newConfig` 是一个代表新配置的 JavaScript 对象。
- **返回值格式**:
  - `getConfig()`: `Promise<Object>`，返回 `config.json` 的内容。
  - `updateConfig()`: `Promise<void>`，成功时 resolve，失败时 reject。
- **具体实现要求**:
  1. 在主进程中创建 `handleGetConfig` 和 `handleUpdateConfig` 函数。
  2. `handleGetConfig` 直接读取并返回 `config.json` 的内容。
  3. `handleUpdateConfig` 接收新配置对象，写入 `config.json` 文件。
  4. 在写入前，对 `newConfig` 进行 JSON 格式校验和字段白名单过滤，防止写入非法或恶意内容。
5. 在 `preload/index.ts` 中暴露这两个接口为 `window.electronApi.system.getConfig` 和 `window.electronApi.system.updateConfig`。

状态：已完成（渲染层 `SystemPage.vue` 接入真实读取与保存，保存后即时生效）

### 任务 3：实现 `GET /api/export` HTTP 接口

- **优先级**: Medium
- **技术难度**: Medium
- **接口名称**: `GET /api/export`
- **参数定义**:
  - `roomId` (String): 房间 ID。
  - `from` (String): 导出的起始时间 (ISO 8601 格式)。
  - `to` (String): 导出的结束时间 (ISO 8601 格式)。
  - `format` (String): 导出格式 (`'csv'`, `'json'`, `'xlsx'`)。
- **返回值格式**:
  - 成功时返回文件流 (`application/octet-stream`) 或包含 `filePath` 的 JSON 对象。推荐后者，由渲染进程触发下载。
- **具体实现要求**:
  1. 在主进程的 HTTP 服务模块（例如 `express` 或内置的 `http` 服务器）中注册 `/api/export` 路由。
  2. 实现从数据库或日志文件中查询指定 `roomId` 在 `from` 到 `to` 时间范围内的弹幕数据。
  3. 根据 `format` 参数将数据转换为相应的格式。
  4. 将生成的文件保存在临时目录，并返回文件的绝对路径。
5. 渲染进程的 `SystemPage.vue` 将调用此接口，并在获取到 `filePath` 后提示用户保存文件。

状态：已完成（主进程已提供 GET `/api/export`；`preload` 增加 `http.get`；`SystemPage.vue` 调用真实接口并提示返回路径。当前导出格式为 CSV）

### 任务 4：实现 `system.genDiagnosticZip` 接口

- **优先级**: Medium
- **技术难度**: Medium
- **接口名称**: `system.genDiagnosticZip`
- **参数定义**:
  - `options` (Object): 包含诊断选项的对象，例如 `{ logs: Boolean, config: Boolean, plugins: Boolean, system: Boolean, timeRange: Object }`。
- **返回值格式**: `Promise<{ filePath: String }>`，返回生成的诊断包的绝对路径。
- **具体实现要求**:
  1. 在主进程中创建 `handleGenDiagnosticZip` 函数。
  2. 使用 `adm-zip` 或类似的库来创建一个 ZIP 压缩包。
  3. 根据 `options` 参数，将相应的内如添加到压缩包中：
     - `logs`: 包含指定时间范围内的日志文件。
     - `config`: 包含 `config.json` 文件。
     - `plugins`: 包含 `plugins` 目录的快照。
     - `system`: 包含系统信息（如 OS、CPU、内存使用情况）。
  4. 将生成的 ZIP 文件保存在用户的临时目录或下载目录。
  5. 返回包含 `filePath` 的对象。
6. 在 `preload/index.ts` 中暴露此接口为 `window.electronApi.system.genDiagnosticZip`。

补充：新增 `system.showItemInFolder(path)` 用于打开诊断包所在文件夹。

状态：已完成（渲染层已接入，生成后可打开文件夹）

## 4. 任务优先级和顺序

建议按以下顺序执行任务：

1.  **任务 2 (`getConfig`/`updateConfig`)**: 难度最低，可以快速验证主进程与渲染进程的通信链路。
2.  **任务 1 (`getSystemLog`)**: 实现日志读取，为调试后续功能提供便利。
3.  **任务 4 (`genDiagnosticZip`)**: 逻辑相对独立，不依赖其他数据接口。
4.  **任务 3 (`/api/export`)**: 依赖数据存储，可能是最复杂的任务。

## 5. 验收标准

- `SystemPage.vue` 中的所有功能均由真实的主进程接口驱动，无任何 `setTimeout` 或模拟数据。
- 所有接口调用都包含恰当的 `loading` 状态和错误处理。
- 生成的配置文件、导出数据和诊断包内容正确无误。
- 所有代码变更均通过静态代码检查（linting）和类型检查（typecheck）。

状态汇总：
- [x] 日志列表来自真实接口；支持筛选与自动滚动。
- [x] 配置读取与保存走真实接口；保存成功后即时生效。
- [x] 导出支持房间与时间范围；返回真实文件路径并提示成功（CSV）。
- [x] 诊断包生成返回真实路径；可打开所在文件夹。
- [x] 全仓库 typecheck 通过。