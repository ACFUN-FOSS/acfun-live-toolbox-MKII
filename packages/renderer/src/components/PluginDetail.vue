<template>
  <div class="plugin-detail">
    <div
      v-if="loading"
      class="loading-state"
    >
      <t-loading
        size="large"
        text="加载中..."
      />
    </div>
    
    <div
      v-else-if="plugin"
      class="plugin-content"
    >
      <!-- 插件头部信息 -->
      <div class="plugin-header">
        <div class="plugin-icon">
          <img
            v-if="plugin.icon"
            :src="plugin.icon"
            :alt="plugin.name"
          >
          <t-icon
            v-else
            name="app"
            size="48px"
          />
        </div>
        <div class="plugin-info">
          <h2 class="plugin-name">
            {{ plugin.name }}
          </h2>
          <div class="plugin-meta">
            <t-tag
              theme="primary"
              variant="light"
            >
              v{{ plugin.version }}
            </t-tag>
            <t-tag
              v-if="plugin.author"
              theme="default"
              variant="light"
            >
              {{ plugin.author }}
            </t-tag>
            <t-tag
              :theme="plugin.enabled ? 'success' : 'warning'"
              variant="light"
            >
              {{ plugin.enabled ? '已启用' : '已禁用' }}
            </t-tag>
          </div>
          <p
            v-if="plugin.description"
            class="plugin-description"
          >
            {{ plugin.description }}
          </p>
        </div>
        <div class="plugin-actions">
          <t-button 
            :theme="plugin.enabled ? 'default' : 'primary'"
            :loading="toggling"
            @click="togglePlugin"
          >
            {{ plugin.enabled ? '禁用' : '启用' }}
          </t-button>
          <t-button 
            theme="danger" 
            variant="outline"
            :disabled="plugin.enabled"
            @click="showUninstallDialog = true"
          >
            卸载
          </t-button>
        </div>
      </div>

      <!-- 插件详细信息 -->
      <div class="plugin-details">
        <t-tabs v-model="activeTab">
          <t-tab-panel
            value="info"
            label="基本信息"
          >
            <div class="info-section">
              <div class="info-item">
                <label>插件ID：</label>
                <span>{{ plugin.id }}</span>
              </div>
              <div class="info-item">
                <label>版本：</label>
                <span>{{ plugin.version }}</span>
              </div>
              <div
                v-if="plugin.author"
                class="info-item"
              >
                <label>作者：</label>
                <span>{{ plugin.author }}</span>
              </div>
              <div
                v-if="plugin.homepage"
                class="info-item"
              >
                <label>主页：</label>
                <t-link
                  :href="plugin.homepage"
                  target="_blank"
                >
                  {{ plugin.homepage }}
                </t-link>
              </div>
              <div class="info-item">
                <label>状态：</label>
                <t-tag :theme="plugin.enabled ? 'success' : 'warning'">
                  {{ plugin.enabled ? '已启用' : '已禁用' }}
                </t-tag>
              </div>
            </div>
          </t-tab-panel>
          
          <t-tab-panel
            value="settings"
            label="设置"
          >
            <div class="settings-section">
              <t-alert
                theme="info"
                message="插件设置功能正在开发中..."
              />
            </div>
          </t-tab-panel>
          
          <t-tab-panel
            value="devtools"
            label="开发工具"
          >
            <div class="devtools-section">
              <PluginDevTools 
                :plugin-id="plugin.id"
                @config-saved="handleDevConfigSaved"
                @debug-started="handleDebugStarted"
                @debug-stopped="handleDebugStopped"
              />
            </div>
          </t-tab-panel>
          
          <t-tab-panel
            value="logs"
            label="日志"
          >
            <div class="logs-section">
              <div class="logs-header">
                <t-button
                  size="small"
                  :loading="logsLoading"
                  @click="loadLogs"
                >
                  刷新日志
                </t-button>
                <t-select 
                  v-model="logLevel" 
                  placeholder="日志级别"
                  style="width: 120px;"
                  @change="filterLogs"
                >
                  <t-option
                    value="all"
                    label="全部"
                  />
                  <t-option
                    value="error"
                    label="错误"
                  />
                  <t-option
                    value="warn"
                    label="警告"
                  />
                  <t-option
                    value="info"
                    label="信息"
                  />
                  <t-option
                    value="debug"
                    label="调试"
                  />
                </t-select>
              </div>
              
              <div class="logs-content">
                <div
                  v-if="logsLoading"
                  class="logs-loading"
                >
                  <t-loading
                    size="small"
                    text="加载日志中..."
                  />
                </div>
                <div
                  v-else-if="filteredLogs.length === 0"
                  class="logs-empty"
                >
                  <t-empty description="暂无日志记录" />
                </div>
                <div
                  v-else
                  class="logs-list"
                >
                  <div 
                    v-for="(log, index) in filteredLogs" 
                    :key="index"
                    :class="['log-item', `log-${log.level}`]"
                  >
                    <div class="log-header">
                      <t-tag 
                        :theme="getLogLevelTheme(log.level)" 
                        size="small"
                      >
                        {{ log.level.toUpperCase() }}
                      </t-tag>
                      <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                    </div>
                    <div class="log-message">
                      {{ log.message }}
                    </div>
                    <div
                      v-if="log.context"
                      class="log-context"
                    >
                      <pre>{{ JSON.stringify(log.context, null, 2) }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </t-tab-panel>
          
          <t-tab-panel
            value="errors"
            label="错误管理"
          >
            <div class="errors-section">
              <div class="errors-header">
                <t-button
                  size="small"
                  :loading="errorsLoading"
                  @click="loadErrorHistory"
                >
                  刷新错误历史
                </t-button>
                <t-button 
                  size="small" 
                  theme="warning"
                  :disabled="!errorHistory.length"
                  @click="resetErrorCount"
                >
                  重置错误计数
                </t-button>
              </div>
              
              <div class="errors-content">
                <div
                  v-if="errorsLoading"
                  class="errors-loading"
                >
                  <t-loading
                    size="small"
                    text="加载错误历史中..."
                  />
                </div>
                <div
                  v-else-if="errorHistory.length === 0"
                  class="errors-empty"
                >
                  <t-empty description="暂无错误记录" />
                </div>
                <div
                  v-else
                  class="errors-list"
                >
                  <div 
                    v-for="(error, index) in errorHistory" 
                    :key="index"
                    class="error-item"
                  >
                    <div class="error-header">
                      <t-tag
                        theme="danger"
                        size="small"
                      >
                        {{ error.type }}
                      </t-tag>
                      <span class="error-time">{{ formatTime(error.timestamp) }}</span>
                      <t-button 
                        v-if="error.recoveryAction" 
                        size="small"
                        theme="primary"
                        variant="text"
                        @click="executeRecovery(error)"
                      >
                        恢复操作
                      </t-button>
                    </div>
                    <div class="error-message">
                      {{ error.message }}
                    </div>
                    <div
                      v-if="error.context"
                      class="error-context"
                    >
                      <t-collapse>
                        <t-collapse-panel header="详细信息">
                          <pre>{{ JSON.stringify(error.context, null, 2) }}</pre>
                        </t-collapse-panel>
                      </t-collapse>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </t-tab-panel>
        </t-tabs>
      </div>
    </div>

    <div
      v-else
      class="error-state"
    >
      <t-result
        theme="error"
        title="插件不存在"
        description="请检查插件ID是否正确"
      >
        <template #extra>
          <t-button @click="$emit('back')">
            返回插件列表
          </t-button>
        </template>
      </t-result>
    </div>

    <!-- 卸载确认对话框 -->
    <t-dialog
      v-model:visible="showUninstallDialog"
      header="确认卸载"
      :confirm-btn="{ loading: uninstalling }"
      @confirm="uninstallPlugin"
    >
      <p>确定要卸载插件 <strong>{{ plugin?.name }}</strong> 吗？</p>
      <p class="warning-text">
        此操作不可撤销，插件的所有数据将被删除。
      </p>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import PluginDevTools from './PluginDevTools.vue';

interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  author?: string;
  homepage?: string;
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
}

interface ErrorEntry {
  type: string;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
  recoveryAction?: string;
}

interface Props {
  pluginId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  back: [];
  pluginUpdated: [plugin: Plugin];
}>();

const plugin = ref<Plugin | null>(null);
const loading = ref(true);
const toggling = ref(false);
const uninstalling = ref(false);
const showUninstallDialog = ref(false);
const activeTab = ref('info');

// 日志相关
const logs = ref<LogEntry[]>([]);
const filteredLogs = ref<LogEntry[]>([]);
const logsLoading = ref(false);
const logLevel = ref('all');

// 错误管理相关
const errorHistory = ref<ErrorEntry[]>([]);
const errorsLoading = ref(false);

async function loadPlugin() {
  if (!props.pluginId) return;
  
  loading.value = true;
  try {
    const result = await window.electronApi.plugin.get(props.pluginId);
    if ('plugin' in result) {
      plugin.value = result.plugin;
    } else {
      console.error('Failed to load plugin:', result.error);
      plugin.value = null;
    }
  } catch (error) {
    console.error('Error loading plugin:', error);
    plugin.value = null;
  } finally {
    loading.value = false;
  }
}

async function togglePlugin() {
  if (!plugin.value) return;
  
  toggling.value = true;
  try {
    const result = plugin.value.enabled 
      ? await window.electronApi.plugin.disable(plugin.value.id)
      : await window.electronApi.plugin.enable(plugin.value.id);
    
    if ('success' in result && result.success) {
      plugin.value.enabled = !plugin.value.enabled;
      emit('pluginUpdated', plugin.value);
    } else {
      console.error(`Failed to toggle plugin:`, result.error);
    }
  } catch (error) {
    console.error('Error toggling plugin:', error);
  } finally {
    toggling.value = false;
  }
}

async function uninstallPlugin() {
  if (!plugin.value) return;
  
  uninstalling.value = true;
  try {
    const result = await window.electronApi.plugin.uninstall(plugin.value.id);
    if ('success' in result && result.success) {
      showUninstallDialog.value = false;
      emit('back');
    } else {
      console.error('Failed to uninstall plugin:', result.error);
    }
  } catch (error) {
    console.error('Error uninstalling plugin:', error);
  } finally {
    uninstalling.value = false;
  }
}

// 日志相关方法
async function loadLogs() {
  if (!props.pluginId) return;
  
  logsLoading.value = true;
  try {
    const result = await window.electronApi.plugin.logs(props.pluginId, 100);
    if ('logs' in result) {
      logs.value = result.logs || [];
      filterLogs();
    } else {
      console.error('Failed to load logs:', result.error);
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  } finally {
    logsLoading.value = false;
  }
}

function filterLogs() {
  if (logLevel.value === 'all') {
    filteredLogs.value = logs.value;
  } else {
    filteredLogs.value = logs.value.filter(log => log.level === logLevel.value);
  }
}

function getLogLevelTheme(level: string) {
  switch (level) {
    case 'error': return 'danger';
    case 'warn': return 'warning';
    case 'info': return 'primary';
    case 'debug': return 'default';
    default: return 'default';
  }
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

// 错误管理相关方法
async function loadErrorHistory() {
  if (!props.pluginId) return;
  
  errorsLoading.value = true;
  try {
    const result = await window.electronApi.plugin.errorHistory(props.pluginId);
    if ('errors' in result) {
      errorHistory.value = result.errors || [];
    } else {
      console.error('Failed to load error history:', result.error);
    }
  } catch (error) {
    console.error('Error loading error history:', error);
  } finally {
    errorsLoading.value = false;
  }
}

async function resetErrorCount() {
  if (!props.pluginId) return;
  
  try {
    const result = await window.electronApi.plugin.resetErrorCount(props.pluginId);
    if ('success' in result && result.success) {
      await loadErrorHistory(); // 重新加载错误历史
    } else {
      console.error('Failed to reset error count:', result.error);
    }
  } catch (error) {
    console.error('Error resetting error count:', error);
  }
}

async function executeRecovery(error: ErrorEntry) {
  if (!error.recoveryAction) return;
  
  try {
    const result = await window.electronApi.plugin.recovery(props.pluginId, error.recoveryAction);
    if ('success' in result && result.success) {
      await loadErrorHistory(); // 重新加载错误历史
      await loadPlugin(); // 重新加载插件信息
    } else {
      console.error('Failed to execute recovery:', result.error);
    }
  } catch (error) {
    console.error('Error executing recovery:', error);
  }
}

// 监听标签页切换，自动加载相应数据
watch(activeTab, (newTab) => {
  if (newTab === 'logs' && logs.value.length === 0) {
    loadLogs();
  } else if (newTab === 'errors' && errorHistory.value.length === 0) {
    loadErrorHistory();
  }
});

watch(() => props.pluginId, () => {
  loadPlugin();
}, { immediate: true });

// 开发工具相关方法
function handleDevConfigSaved() {
  console.log('Development config saved for plugin:', props.pluginId);
}

function handleDebugStarted() {
  console.log('Debug started for plugin:', props.pluginId);
  // 刷新日志以显示调试信息
  if (activeTab.value === 'logs') {
    loadLogs();
  }
}

function handleDebugStopped() {
  console.log('Debug stopped for plugin:', props.pluginId);
  // 刷新日志
  if (activeTab.value === 'logs') {
    loadLogs();
  }
}

onMounted(() => {
  loadPlugin();
});
</script>

<style scoped>
.plugin-detail {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.plugin-header {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 32px;
  padding: 24px;
  background: var(--td-bg-color-container);
  border-radius: 12px;
  border: 1px solid var(--td-border-color);
}

.plugin-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: var(--td-bg-color-component);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.plugin-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.plugin-info {
  flex: 1;
}

.plugin-name {
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.plugin-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.plugin-description {
  margin: 0;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}

.plugin-actions {
  display: flex;
  gap: 12px;
  flex-direction: column;
}

.plugin-details {
  background: var(--td-bg-color-container);
  border-radius: 12px;
  border: 1px solid var(--td-border-color);
  overflow: hidden;
}

.info-section {
  padding: 24px;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item label {
  width: 100px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
}

.info-item span {
  color: var(--td-text-color-primary);
}

.settings-section,
.logs-section,
.errors-section {
  padding: 24px;
}

.logs-header,
.errors-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--td-border-color);
}

.logs-content,
.errors-content {
  max-height: 400px;
  overflow-y: auto;
}

.logs-list,
.errors-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-item,
.error-item {
  padding: 12px;
  background: var(--td-bg-color-container);
  border-radius: 8px;
  border: 1px solid var(--td-border-color);
}

.log-header,
.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.log-time,
.error-time {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin-left: auto;
}

.log-message,
.error-message {
  font-size: 14px;
  color: var(--td-text-color-primary);
  line-height: 1.5;
}

.log-context,
.error-context {
  margin-top: 8px;
}

.log-context pre,
.error-context pre {
  background: var(--td-bg-color-component);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  margin: 0;
}

.log-error {
  border-left: 3px solid var(--td-error-color);
}

.log-warn {
  border-left: 3px solid var(--td-warning-color);
}

.log-info {
  border-left: 3px solid var(--td-brand-color);
}

.log-debug {
  border-left: 3px solid var(--td-text-color-placeholder);
}

.logs-loading,
.logs-empty,
.errors-loading,
.errors-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--td-text-color-placeholder);
}

.warning-text {
  color: var(--td-warning-color);
  font-size: 14px;
  margin: 8px 0 0 0;
}

.devtools-section {
  padding: 0;
}
</style>