# Proposal: SystemPage 接入真实数据，移除 mock

## Why
- 现有 `SystemPage.vue` 的日志、配置、导出、诊断功能使用模拟数据与延时，违反「不允许使用 mock 数据」与规范的真实数据要求。
- `ui2.json` 已定义对应的服务接口（IPC/HTTP），应接入以实现验收标准中的实际导出与诊断包生成。

## Scope / Changes
- 日志页接入 `getSystemLog`（支持级别、关键词、时间范围）。
- 配置读取/保存接入 `getConfig` / `updateConfig`（即时生效，仅 `config.json`）。
- 数据导出接入 `GET /api/export?roomId&from&to`（返回文件路径或下载流）。
- 诊断包接入 `genDiagnosticZip`（返回 `filePath` 并支持打开所在文件夹）。
- 去除所有模拟延时与本地构造的示例日志/配置。

## IPC/HTTP Binding
- 通过 `preload` 暴露 `window.electronApi.system.getSystemLog`, `getConfig`, `updateConfig`, `genDiagnosticZip`。
- 数据导出可走 `window.electronApi.http.get('/api/export', params)` 或主进程代理下载并返回保存路径。

## Acceptance Criteria
- 日志列表来自真实接口；筛选与自动滚动正常；错误项可一键导出该时间段日志。
- 配置读取与保存走真实接口；保存成功后即时生效，无 mock。
- 导出支持房间选择、时间范围与格式选项；返回真实文件路径并提示成功。
- 诊断包生成返回真实路径；点击可打开所在文件夹。

## Non-Goals
- 不涉及新增日志字段或结构调整；不改动路由与 UI 布局。

## Risks & Mitigations
- 风险：接口不可达或返回慢。缓解：统一错误提示与重试、超时设置，禁用按钮期间显示 loading。
- 风险：保存配置不合法。缓解：保存前做 JSON 校验与字段白名单过滤。

## Dev Steps
1) 在 `preload` 增加 IPC 封装：`system.getSystemLog/getConfig/updateConfig/genDiagnosticZip` 与 `http.get`。
2) `SystemPage.vue` 替换 `refreshLogs/loadConfig/exportData/generateDiagnostic` 的 mock 实现为真实调用；联动 loading/禁用状态。
3) 实现错误处理与 MessagePlugin 提示；成功后滚动/打开文件夹等行为。
4) 移除所有 `setTimeout` 模拟与示例数据构造。
5) 自查：静态走查与 typecheck 通过。

## Next Steps
- 完成接入后，将 `ui2.json` 中 `SystemPage` 的 `implementation_status` 更新为「已实现」。