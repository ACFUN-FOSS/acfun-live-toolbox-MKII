<template>
  <div class="system-page">
    <div class="page-header">
      <h1 class="page-title">系统管理</h1>
      <p class="page-description">系统日志、配置管理和诊断工具</p>
    </div>

    <t-tabs v-model="activeTab" class="system-tabs">
      <!-- 日志管理标签页 -->
      <t-tab-panel value="logs" label="日志">
        <div class="logs-panel">
          <!-- 日志过滤器 -->
          <div class="logs-filters">
            <div class="filter-row">
              <t-select 
                v-model="logFilters.level" 
                placeholder="日志级别"
                style="width: 120px;"
                clearable
              >
                <t-option value="error" label="错误" />
                <t-option value="warn" label="警告" />
                <t-option value="info" label="信息" />
                <t-option value="debug" label="调试" />
              </t-select>
              
              <t-input 
                v-model="logFilters.keyword" 
                placeholder="关键词搜索"
                style="width: 200px;"
                clearable
              >
                <template #prefix-icon>
                  <t-icon name="search" />
                </template>
              </t-input>
              
              <t-date-range-picker 
                v-model="logFilters.timeRange"
                placeholder="选择时间范围"
                style="width: 280px;"
                clearable
              />
              
              <t-button @click="refreshLogs">
                <t-icon name="refresh" />
                刷新
              </t-button>
            </div>
            
            <div class="filter-actions">
              <t-switch 
                v-model="autoScroll" 
                label="自动滚动到最新"
              />
              <t-button 
                theme="primary" 
                variant="outline"
                @click="exportLogs"
                :loading="exportingLogs"
              >
                <t-icon name="download" />
                导出日志
              </t-button>
            </div>
          </div>

          <!-- 日志列表 -->
          <div class="logs-container" ref="logsContainer">
            <t-loading :loading="logsLoading">
              <div class="logs-list">
                <div 
                  v-for="log in filteredLogs" 
                  :key="log.id"
                  :class="['log-item', `log-${log.level}`]"
                  @click="selectLog(log)"
                >
                  <div class="log-time">{{ formatTime(log.timestamp) }}</div>
                  <div class="log-level">{{ log.level.toUpperCase() }}</div>
                  <div class="log-message">{{ log.message }}</div>
                  <div class="log-source">{{ log.source }}</div>
                  <t-button 
                    v-if="log.level === 'error'"
                    size="small"
                    theme="danger"
                    variant="text"
                    @click.stop="exportErrorLog(log)"
                  >
                    导出
                  </t-button>
                </div>
              </div>
              
              <div v-if="filteredLogs.length === 0" class="empty-logs">
                <t-icon name="inbox" size="48px" />
                <p>暂无日志数据</p>
              </div>
            </t-loading>
          </div>
        </div>
      </t-tab-panel>

      <!-- 配置 & 导出标签页 -->
      <t-tab-panel value="config_export" label="配置 & 导出">
        <div class="config-export-panel">
          <div class="panel-section">
            <h3>配置管理</h3>
            <div class="config-editor">
              <t-textarea 
                v-model="configContent"
                placeholder="config.json 内容"
                :rows="12"
                @blur="saveConfig"
              />
              <div class="config-actions">
                <t-button @click="resetConfig" variant="outline">重置</t-button>
                <t-button theme="primary" @click="saveConfig" :loading="savingConfig">
                  保存配置
                </t-button>
              </div>
            </div>
          </div>

          <t-divider />

          <div class="panel-section">
            <h3>数据导出</h3>
            <div class="export-form">
              <div class="form-row">
                <t-select 
                  v-model="exportOptions.rooms" 
                  placeholder="选择房间"
                  multiple
                  style="width: 300px;"
                >
                  <t-option 
                    v-for="room in availableRooms" 
                    :key="room.id"
                    :value="room.id" 
                    :label="room.name" 
                  />
                </t-select>
                
                <t-date-range-picker 
                  v-model="exportOptions.timeRange"
                  placeholder="选择时间范围"
                  style="width: 280px;"
                />
              </div>
              
              <div class="form-row">
                <t-select 
                  v-model="exportOptions.format" 
                  placeholder="导出格式"
                  style="width: 150px;"
                >
                  <t-option value="csv" label="CSV" />
                  <t-option value="json" label="JSON" />
                  <t-option value="xlsx" label="Excel" />
                </t-select>
                
                <t-button 
                  theme="primary" 
                  @click="exportData"
                  :loading="exportingData"
                  :disabled="!canExport"
                >
                  <t-icon name="download" />
                  导出数据
                </t-button>
              </div>
            </div>
          </div>
        </div>
      </t-tab-panel>

      <!-- 诊断标签页 -->
      <t-tab-panel value="diagnostics" label="诊断">
        <div class="diagnostics-panel">
          <div class="panel-section">
            <h3>系统诊断</h3>
            <p class="section-desc">生成包含日志、系统信息、插件列表等的诊断包</p>
            
            <div class="diagnostic-form">
              <t-date-range-picker 
                v-model="diagnosticOptions.timeRange"
                placeholder="选择时间范围"
                style="width: 280px;"
              />
              
              <t-checkbox-group v-model="diagnosticOptions.includes">
                <t-checkbox value="logs">系统日志</t-checkbox>
                <t-checkbox value="config">配置文件</t-checkbox>
                <t-checkbox value="plugins">插件信息</t-checkbox>
                <t-checkbox value="database">数据库结构</t-checkbox>
                <t-checkbox value="system">系统信息</t-checkbox>
              </t-checkbox-group>
              
              <t-button 
                theme="primary" 
                size="large"
                @click="generateDiagnostic"
                :loading="generatingDiagnostic"
              >
                <t-icon name="file-zip" />
                生成诊断包
              </t-button>
            </div>
          </div>

          <div v-if="lastDiagnosticPath" class="diagnostic-result">
            <t-alert theme="success" title="诊断包生成成功">
              <p>文件路径: {{ lastDiagnosticPath }}</p>
              <t-button @click="openDiagnosticFolder">打开所在文件夹</t-button>
            </t-alert>
          </div>
        </div>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useRoomStore } from '../stores/room'

// 响应式数据
const activeTab = ref('logs')
const logsContainer = ref<HTMLElement>()

// 日志相关
const logs = ref<LogItem[]>([])
const logsLoading = ref(false)
const autoScroll = ref(true)
const exportingLogs = ref(false)

interface LogItem {
  id: string
  timestamp: number
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  source: string
  details?: any
}

const logFilters = reactive({
  level: '',
  keyword: '',
  timeRange: [] as [string, string] | []
})

// 配置相关
const configContent = ref('')
const savingConfig = ref(false)

// 导出相关
const roomStore = useRoomStore()
const exportingData = ref(false)

const exportOptions = reactive({
  rooms: [] as string[],
  timeRange: [] as [string, string] | [],
  format: 'csv'
})

// 诊断相关
const generatingDiagnostic = ref(false)
const lastDiagnosticPath = ref('')

const diagnosticOptions = reactive({
  timeRange: [] as [string, string] | [],
  includes: ['logs', 'config', 'plugins', 'system'] as string[]
})

// 计算属性
const filteredLogs = computed(() => {
  let result = logs.value

  // 按级别过滤
  if (logFilters.level) {
    result = result.filter(log => log.level === logFilters.level)
  }

  // 按关键词过滤
  if (logFilters.keyword) {
    const keyword = logFilters.keyword.toLowerCase()
    result = result.filter(log => 
      log.message.toLowerCase().includes(keyword) ||
      log.source.toLowerCase().includes(keyword)
    )
  }

  // 按时间范围过滤
  if (logFilters.timeRange.length === 2) {
    const [start, end] = logFilters.timeRange
    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()
    result = result.filter(log => 
      log.timestamp >= startTime && log.timestamp <= endTime
    )
  }

  return result.sort((a, b) => b.timestamp - a.timestamp)
})

const availableRooms = computed(() => {
  return roomStore.rooms.map(room => ({
    id: room.id,
    name: room.title || `房间 ${room.id}`
  }))
})

const canExport = computed(() => {
  return exportOptions.rooms.length > 0 && 
         exportOptions.timeRange.length === 2 &&
         exportOptions.format
})

// 方法
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const refreshLogs = async () => {
  logsLoading.value = true
  try {
    // 模拟获取日志数据
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 生成模拟日志数据
    const mockLogs: LogItem[] = [
      {
        id: '1',
        timestamp: Date.now() - 1000 * 60 * 5,
        level: 'info',
        message: '应用启动成功',
        source: 'main'
      },
      {
        id: '2',
        timestamp: Date.now() - 1000 * 60 * 3,
        level: 'warn',
        message: '检测到网络连接不稳定',
        source: 'network'
      },
      {
        id: '3',
        timestamp: Date.now() - 1000 * 60 * 1,
        level: 'error',
        message: '插件加载失败: plugin-example',
        source: 'plugin',
        details: { pluginId: 'plugin-example', error: 'Module not found' }
      }
    ]
    
    logs.value = mockLogs
    
    if (autoScroll.value) {
      await nextTick()
      scrollToBottom()
    }
  } catch (error) {
    MessagePlugin.error('获取日志失败')
  } finally {
    logsLoading.value = false
  }
}

const selectLog = (log: LogItem) => {
  if (log.details) {
    console.log('Log details:', log.details)
  }
}

const exportLogs = async () => {
  exportingLogs.value = true
  try {
    // 模拟导出日志
    await new Promise(resolve => setTimeout(resolve, 2000))
    MessagePlugin.success('日志导出成功')
  } catch (error) {
    MessagePlugin.error('日志导出失败')
  } finally {
    exportingLogs.value = false
  }
}

const exportErrorLog = async (log: LogItem) => {
  try {
    // 模拟导出单个错误日志
    await new Promise(resolve => setTimeout(resolve, 1000))
    MessagePlugin.success('错误日志导出成功')
  } catch (error) {
    MessagePlugin.error('错误日志导出失败')
  }
}

const scrollToBottom = () => {
  if (logsContainer.value) {
    logsContainer.value.scrollTop = logsContainer.value.scrollHeight
  }
}

// 配置管理方法
const loadConfig = async () => {
  try {
    // 模拟加载配置
    const mockConfig = {
      app: {
        name: 'AcFun Live Toolbox MKII',
        version: '2.0.0'
      },
      network: {
        timeout: 30000,
        retries: 3
      },
      ui: {
        theme: 'auto',
        language: 'zh-CN'
      }
    }
    configContent.value = JSON.stringify(mockConfig, null, 2)
  } catch (error) {
    MessagePlugin.error('加载配置失败')
  }
}

const saveConfig = async () => {
  savingConfig.value = true
  try {
    // 验证 JSON 格式
    JSON.parse(configContent.value)
    
    // 模拟保存配置
    await new Promise(resolve => setTimeout(resolve, 1000))
    MessagePlugin.success('配置保存成功')
  } catch (error) {
    MessagePlugin.error('配置格式错误或保存失败')
  } finally {
    savingConfig.value = false
  }
}

const resetConfig = async () => {
  await loadConfig()
  MessagePlugin.info('配置已重置')
}

// 数据导出方法
const exportData = async () => {
  exportingData.value = true
  try {
    // 模拟数据导出
    await new Promise(resolve => setTimeout(resolve, 3000))
    MessagePlugin.success(`数据导出成功 (${exportOptions.format.toUpperCase()} 格式)`)
  } catch (error) {
    MessagePlugin.error('数据导出失败')
  } finally {
    exportingData.value = false
  }
}

// 诊断方法
const generateDiagnostic = async () => {
  generatingDiagnostic.value = true
  try {
    // 模拟生成诊断包
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    lastDiagnosticPath.value = `C:\\Users\\用户\\Desktop\\diagnostic-${timestamp}.zip`
    
    MessagePlugin.success('诊断包生成成功')
  } catch (error) {
    MessagePlugin.error('诊断包生成失败')
  } finally {
    generatingDiagnostic.value = false
  }
}

const openDiagnosticFolder = () => {
  // 模拟打开文件夹
  MessagePlugin.info('正在打开文件夹...')
}

// 生命周期
onMounted(async () => {
  await refreshLogs()
  await loadConfig()
  await roomStore.loadRooms()
})

// 自动刷新日志
let logRefreshInterval: NodeJS.Timeout | null = null

onMounted(() => {
  logRefreshInterval = setInterval(() => {
    if (activeTab.value === 'logs' && autoScroll.value) {
      refreshLogs()
    }
  }, 30000) // 每30秒刷新一次
})

onUnmounted(() => {
  if (logRefreshInterval) {
    clearInterval(logRefreshInterval)
  }
})
</script>

<style scoped>
.system-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  background: var(--td-bg-color-page);
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin: 0 0 8px 0;
}

.page-description {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin: 0;
}

.system-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.system-tabs :deep(.t-tabs__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.system-tabs :deep(.t-tab-panel) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 日志面板样式 */
.logs-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.logs-filters {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  padding: 16px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.filter-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logs-container {
  flex: 1;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.logs-list {
  flex: 1;
  overflow-y: auto;
  max-height: 500px;
}

.log-item {
  display: grid;
  grid-template-columns: 140px 60px 1fr 120px auto;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--td-border-level-2-color);
  cursor: pointer;
  transition: background-color 0.2s;
  align-items: center;
}

.log-item:hover {
  background: var(--td-bg-color-container-hover);
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  font-family: monospace;
}

.log-level {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  text-align: center;
}

.log-error .log-level {
  background: var(--td-error-color-1);
  color: var(--td-error-color);
}

.log-warn .log-level {
  background: var(--td-warning-color-1);
  color: var(--td-warning-color);
}

.log-info .log-level {
  background: var(--td-success-color-1);
  color: var(--td-success-color);
}

.log-debug .log-level {
  background: var(--td-gray-color-1);
  color: var(--td-gray-color-7);
}

.log-message {
  font-size: 13px;
  color: var(--td-text-color-primary);
  word-break: break-word;
}

.log-source {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  font-family: monospace;
}

.empty-logs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--td-text-color-placeholder);
}

.empty-logs p {
  margin: 12px 0 0 0;
  font-size: 14px;
}

/* 配置导出面板样式 */
.config-export-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel-section {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  padding: 20px;
}

.panel-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin: 0 0 16px 0;
}

.config-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.export-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

/* 诊断面板样式 */
.diagnostics-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-desc {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin: 0 0 16px 0;
}

.diagnostic-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.diagnostic-result {
  margin-top: 16px;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .system-page {
    padding: 16px;
  }
  
  .filter-row {
    flex-wrap: wrap;
  }
  
  .log-item {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .log-item > * {
    grid-column: 1;
  }
  
  .form-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .form-row > * {
    width: 100% !important;
  }
}

@media (max-width: 768px) {
  .page-title {
    font-size: 20px;
  }
  
  .logs-filters {
    padding: 12px;
  }
  
  .panel-section {
    padding: 16px;
  }
  
  .filter-actions {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
}
</style>