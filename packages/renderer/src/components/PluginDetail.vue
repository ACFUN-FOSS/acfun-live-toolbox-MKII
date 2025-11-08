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
            @error="handleIconError()"
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
              <template v-if="plugin && plugin.config && Object.keys(plugin.config).length">
                <t-form
                  :data="pluginConfig"
                  layout="vertical"
                >
                  <t-form-item
                    v-for="(configItem, key) in plugin.config"
                    :key="key"
                    :label="configItem.label || key"
                  >
                    <component
                      :is="getConfigComponent(configItem.type)"
                      v-model="pluginConfig[key]"
                      v-bind="getConfigProps(configItem)"
                    />
                    <template v-if="configItem.description" #help>
                      <span>{{ configItem.description }}</span>
                    </template>
                  </t-form-item>
                </t-form>
                <div class="settings-actions" style="margin-top: 12px;">
                  <t-button
                    theme="primary"
                    :disabled="!plugin"
                    @click="savePluginConfig"
                  >
                    保存设置
                  </t-button>
                </div>
              </template>
              <template v-else>
                <t-alert theme="info" message="该插件未提供可配置项" />
              </template>
            </div>
          </t-tab-panel>
          
          <t-tab-panel
            v-if="isDebugPlugin"
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
                    :key="(log.timestamp ?? index) + '-' + (log.message?.length ?? 0)"
                    :class="['log-item', 'log-' + normalizeLogLevel(log.level), 'log-row']"
                  >
                    <div class="log-row-left">
                      <t-tag 
                        :theme="getLogLevelTheme(log.level)" 
                        size="small"
                      >
                        {{ getLogLevelLabel(log.level) }}
                      </t-tag>
                    </div>
                    <div class="log-row-middle">
                      <span class="log-message single-line">{{ log.message }}</span>
                      <t-button 
                        v-if="shouldShowMore(log)"
                        size="small"
                        variant="text"
                        @click="openLogDetail(log)"
                      >
                        更多
                      </t-button>
                    </div>
                    <div class="log-row-right">
                      <span class="log-time">{{ formatTime(log.timestamp) }}</span>
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
      <t-alert 
        theme="error" 
        message="插件不存在：请检查插件ID是否正确"
      />
      <div style="margin-top: 12px;">
        <t-button @click="$emit('back')">
          返回插件列表
        </t-button>
      </div>
    </div>

    <!-- 卸载确认对话框 -->
    <t-dialog
      v-model:visible="showUninstallDialog"
      header="确认卸载"
      :confirm-btn="{ loading: uninstalling }"
      :destroy-on-close="true"
      @confirm="uninstallPlugin"
      @close="onUninstallDialogClosed"
    >
      <p>确定要卸载插件 <strong>{{ plugin?.name }}</strong> 吗？</p>
      <p class="warning-text">
        此操作不可撤销，插件的所有数据将被删除。
      </p>
    </t-dialog>

    <!-- 日志详情对话框 -->
    <t-dialog
      v-model:visible="showLogDetailDialog"
      header="日志详情"
      width="700px"
      :confirm-btn="false"
      :cancel-btn="{ content: '关闭' }"
      @cancel="closeLogDetail"
      :destroy-on-close="true"
    >
      <div class="log-detail">
        <div style="margin-bottom: 8px; display:flex; align-items:center; gap:8px;">
          <t-tag :theme="logDetail ? getLogLevelTheme(logDetail.level) : 'default'" size="small">
            {{ logDetail ? getLogLevelLabel(logDetail.level) : '' }}
          </t-tag>
          <span class="log-time">{{ logDetail ? formatTime(logDetail.timestamp) : '' }}</span>
        </div>
        <div class="log-message-full" style="white-space: pre-wrap; word-break: break-word;">
          {{ logDetail?.message }}
        </div>
        <div v-if="logDetail?.context" class="log-context-full" style="margin-top:12px;">
          <t-collapse>
            <t-collapse-panel header="上下文">
              <pre style="background: var(--td-bg-color-component); padding:8px; border-radius:4px; overflow:auto;">
{{ JSON.stringify(logDetail?.context, null, 2) }}
              </pre>
            </t-collapse-panel>
          </t-collapse>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import PluginDevTools from './PluginDevTools.vue';
import { usePluginStore } from '../stores/plugin';
import type { PluginInfo } from '../stores/plugin';

interface LogEntry {
  level: string | number;
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
  pluginUpdated: [plugin: PluginInfo];
}>();
const pluginStore = usePluginStore();
const plugin = ref<PluginInfo | null>(null);
const loading = ref(true);
const toggling = ref(false);
const uninstalling = ref(false);
const showUninstallDialog = ref(false);
const activeTab = ref('info');
const isDebugPlugin = ref(false);
const pluginConfig = ref<Record<string, any>>({});

// 日志相关
const logs = ref<LogEntry[]>([]);
const filteredLogs = ref<LogEntry[]>([]);
const logsLoading = ref(false);
const logLevel = ref('all');
const showLogDetailDialog = ref(false);
const logDetail = ref<LogEntry | null>(null);


async function loadPlugin() {
  if (!props.pluginId) return;
  loading.value = true;
  try {
    let p = pluginStore.getPluginById(props.pluginId);
    if (!p) {
      await pluginStore.refreshPlugins();
      p = pluginStore.getPluginById(props.pluginId);
    }
    plugin.value = p || null;
    // 加载调试状态：优先使用 getDebugStatus；回退到 loadDevConfig
    await updateDebugStatus();
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
    await pluginStore.togglePlugin(plugin.value.id, !plugin.value.enabled);
    await pluginStore.refreshPlugins();
    const p = pluginStore.getPluginById(plugin.value.id);
    if (p) {
      plugin.value = p;
      emit('pluginUpdated', p);
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
    await pluginStore.uninstallPlugin(plugin.value.id);
    showUninstallDialog.value = false;
    // 等待对话框关闭动画与销毁，避免与父级卸载竞争造成 vnode 空指针
    await nextTick();
    setTimeout(() => {
      emit('back');
    }, 0);
  } catch (error) {
    console.error('Error uninstalling plugin:', error);
  } finally {
    uninstalling.value = false;
  }
}

function onUninstallDialogClosed() {
  showUninstallDialog.value = false;
}

function handleIconError() {
  if (plugin.value) {
    try {
      plugin.value.icon = '' as any;
    } catch (e) {
      console.warn('[PluginDetail] 图标加载失败，使用默认图标:', e);
    }
  }
}

// 日志相关方法
async function loadLogs() {
  if (!props.pluginId) return;
  
  logsLoading.value = true;
  try {
    const result = await window.electronApi.plugin.logs(props.pluginId, 100);
    if (result && result.success) {
      logs.value = (result.data as any[]) || [];
      filterLogs();
    } else {
      console.error('Failed to load logs:', result && (result as any).error);
    }
  } catch (error) {
    console.error('Error loading logs:', error);
  } finally {
    logsLoading.value = false;
  }
}

function filterLogs() {
  const sorted = [...logs.value].sort((a: any, b: any) => {
    const ta = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
    const tb = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
    return tb - ta; // 倒序：最新在前
  });
  if (logLevel.value === 'all') {
    filteredLogs.value = sorted;
  } else {
    filteredLogs.value = sorted.filter(log => normalizeLogLevel(log.level) === logLevel.value);
  }
}

function normalizeLogLevel(level: any): 'error' | 'warn' | 'info' | 'debug' {
  if (typeof level === 'string') {
    const l = level.trim().toLowerCase();
    if (l === 'error' || l === 'err' || l === 'e') return 'error';
    if (l === 'warn' || l === 'warning' || l === 'w') return 'warn';
    if (l === 'info' || l === 'log' || l === 'i') return 'info';
    if (l === 'debug' || l === 'trace' || l === 'd') return 'debug';
    return 'info';
  }
  if (typeof level === 'number') {
    // Common numeric mapping: 40+=error, 30+=warn, 20+=info, else debug
    if (level >= 40) return 'error';
    if (level >= 30) return 'warn';
    if (level >= 20) return 'info';
    return 'debug';
  }
  return 'info';
}

function getLogLevelTheme(level: any) {
  switch (normalizeLogLevel(level)) {
    case 'error': return 'danger';
    case 'warn': return 'warning';
    case 'info': return 'primary';
    case 'debug': return 'default';
    default: return 'default';
  }
}

function getLogLevelLabel(level: any) {
  switch (normalizeLogLevel(level)) {
    case 'error': return 'ERROR';
    case 'warn': return 'WARN';
    case 'info': return 'INFO';
    case 'debug': return 'DEBUG';
    default: return 'INFO';
  }
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function shouldShowMore(log: LogEntry) {
  const len = (log.message || '').length;
  return len > 120 || !!log.context;
}

function openLogDetail(log: LogEntry) {
  logDetail.value = log;
  showLogDetailDialog.value = true;
}

function closeLogDetail() {
  showLogDetailDialog.value = false;
  logDetail.value = null;
}

// 监听标签页切换，自动加载相应数据
watch(activeTab, (newTab) => {
  if (newTab === 'logs' && logs.value.length === 0) {
    loadLogs();
  }
});

watch(() => props.pluginId, () => {
  loadPlugin();
}, { immediate: true });

// 当调试状态变为非调试时，如果当前在“开发工具”页，则回退到“基本信息”
watch(isDebugPlugin, (val) => {
  if (!val && activeTab.value === 'devtools') {
    activeTab.value = 'info';
  }
});

// 调试状态检测函数
async function updateDebugStatus() {
  try {
    const id = props.pluginId;
    // 优先使用 getDebugStatus（若已在 preload 暴露）
    const hasGetDebug = !!(window as any)?.electronApi?.plugin?.getDebugStatus;
    if (hasGetDebug) {
      const res = await (window as any).electronApi.plugin.getDebugStatus(id);
      isDebugPlugin.value = !!(res && 'success' in res && res.success && res.data && (res.data.debugActive || res.data.hotReloadEnabled || res.data.config));
      return;
    }
    // 回退方案：读取单个插件的 devtools 配置
    const res = await (window as any).electronApi.plugin.loadDevConfig(id);
    isDebugPlugin.value = !!(res && 'success' in res && res.success && res.data);
  } catch (e) {
    console.warn('[devtools] updateDebugStatus failed:', e);
    isDebugPlugin.value = false;
  }
}

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

  // 设置表单：根据 schema 提取初始值
  function derivePluginConfigFromSchema(source: Record<string, any> | undefined) {
    const cfg: Record<string, any> = {};
    const schema = source || {};
    for (const key in schema) {
      const item = (schema as any)[key];
      if (item && typeof item === 'object') {
        if ('value' in item) cfg[key] = item.value;
        else if ('default' in item) cfg[key] = item.default;
        else if (item.type === 'boolean') cfg[key] = false;
        else if (item.type === 'number') cfg[key] = 0;
        else cfg[key] = '';
      } else {
        cfg[key] = item as any;
      }
    }
    return cfg;
  }

  // 详情加载后或插件变化时，初始化设置表单（融合已保存配置）
  async function initPluginConfigFromSchemaWithSaved(newVal: any) {
    const base = derivePluginConfigFromSchema(newVal?.config);
    const id = newVal?.id || props.pluginId;
    if (!id || !window.electronApi?.plugin?.getConfig) {
      pluginConfig.value = base;
      return;
    }
    try {
      const res = await window.electronApi.plugin.getConfig(id);
      if (res && res.success) {
        pluginConfig.value = { ...base, ...(res.data || {}) };
      } else {
        pluginConfig.value = base;
        if (res && (res as any).error) {
          console.warn('[plugin] 获取已保存配置失败:', (res as any).error);
        }
      }
    } catch (err) {
      console.error('[plugin] 获取已保存配置异常:', err);
      pluginConfig.value = base;
    }
  }

  watch(plugin, (newVal) => {
    if (newVal) {
      initPluginConfigFromSchemaWithSaved(newVal);
    } else {
      pluginConfig.value = {};
    }
  });

  // 设置页控件类型映射与属性提取（与管理页保持一致）
  function getConfigComponent(type: string) {
    switch (type) {
      case 'boolean': return 't-switch';
      case 'number': return 't-input-number';
      case 'select': return 't-select';
      case 'textarea': return 't-textarea';
      case 'text': return 't-input';
      default: return 't-input';
    }
  }

  function getConfigProps(config: any) {
    const props: any = {};
    if (config?.type === 'select' && config.options) {
      props.options = config.options;
    }
    if (config?.type === 'number') {
      props.min = config.min;
      props.max = config.max;
      props.step = config.step;
    }
    if (config?.placeholder) {
      props.placeholder = config.placeholder;
    }
    return props;
  }

  async function savePluginConfig() {
    if (!plugin.value) return;
    try {
      await pluginStore.updatePluginConfig(plugin.value.id, pluginConfig.value);
    } catch (error) {
      console.error('保存插件配置失败:', error);
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

/* 单行日志布局 */
.log-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
}
.log-row-left { display: flex; align-items: center; }
.log-row-middle { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.log-row-right { display: flex; align-items: center; justify-content: flex-end; }

.single-line {
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
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
