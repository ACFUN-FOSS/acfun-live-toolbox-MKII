<template>
  <div class="plugin-frame-page">
    <div class="page-header">
      <h2>插件框架</h2>
      <div class="header-actions">
        <t-button
          theme="primary"
          @click="startAllPlugins"
        >
          <t-icon name="play" />
          启动全部
        </t-button>
        <t-button
          variant="outline"
          @click="stopAllPlugins"
        >
          <t-icon name="stop" />
          停止全部
        </t-button>
        <t-button
          variant="outline"
          @click="refreshFrameStatus"
        >
          <t-icon name="refresh" />
          刷新状态
        </t-button>
      </div>
    </div>

    <!-- 框架状态概览 -->
    <div class="frame-overview">
      <t-card
        class="status-card"
        hover-shadow
      >
        <div class="status-content">
          <div
            class="status-indicator"
            :class="frameStatus"
          >
            <t-icon :name="getFrameStatusIcon()" />
          </div>
          <div class="status-info">
            <div class="status-title">
              框架状态
            </div>
            <div class="status-text">
              {{ getFrameStatusText() }}
            </div>
          </div>
        </div>
      </t-card>

      <t-card
        class="stats-card"
        hover-shadow
      >
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">
              {{ runningPlugins.length }}
            </div>
            <div class="stat-label">
              运行中
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-value">
              {{ totalMemoryUsage }}MB
            </div>
            <div class="stat-label">
              内存使用
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-value">
              {{ totalCpuUsage }}%
            </div>
            <div class="stat-label">
              CPU使用
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-value">
              {{ uptime }}
            </div>
            <div class="stat-label">
              运行时间
            </div>
          </div>
        </div>
      </t-card>
    </div>

    <!-- 插件运行状态 -->
    <t-card
      class="plugin-runtime-card"
      title="插件运行状态"
      hover-shadow
    >
      <div class="runtime-controls">
        <div class="control-group">
          <label>过滤状态:</label>
          <t-radio-group v-model="runtimeFilter">
            <t-radio value="all">
              全部
            </t-radio>
            <t-radio value="running">
              运行中
            </t-radio>
            <t-radio value="stopped">
              已停止
            </t-radio>
            <t-radio value="error">
              错误
            </t-radio>
          </t-radio-group>
        </div>
        
        <div class="control-group">
          <t-checkbox v-model="autoRefresh">
            自动刷新
          </t-checkbox>
          <t-select
            v-model="refreshInterval"
            style="width: 120px;"
            :disabled="!autoRefresh"
          >
            <t-option
              value="1000"
              label="1秒"
            />
            <t-option
              value="3000"
              label="3秒"
            />
            <t-option
              value="5000"
              label="5秒"
            />
            <t-option
              value="10000"
              label="10秒"
            />
          </t-select>
        </div>
      </div>

      <div class="plugin-runtime-list">
        <div 
          v-for="plugin in filteredRuntimePlugins" 
          :key="plugin.id"
          class="runtime-plugin-item"
          :class="{ 
            running: plugin.status === 'active',
            stopped: plugin.status === 'inactive',
            error: plugin.status === 'error'
          }"
        >
          <div class="plugin-basic-info">
            <div class="plugin-icon">
              <img
                v-if="plugin.icon"
                :src="plugin.icon"
                :alt="plugin.name"
              >
              <t-icon
                v-else
                name="plugin"
                size="24px"
              />
            </div>
            <div class="plugin-details">
              <div class="plugin-name">
                {{ plugin.name }}
              </div>
              <div class="plugin-id">
                {{ plugin.id }}
              </div>
            </div>
            <div class="plugin-status">
              <t-tag 
                :theme="getRuntimeStatusTheme(plugin.status)"
                :icon="getRuntimeStatusIcon(plugin.status)"
              >
                {{ getRuntimeStatusText(plugin.status) }}
              </t-tag>
            </div>
          </div>

          <div class="plugin-metrics">
            <div class="metric-item">
              <span class="metric-label">内存:</span>
              <span class="metric-value">{{ plugin.memoryUsage || 0 }}MB</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">CPU:</span>
              <span class="metric-value">{{ plugin.cpuUsage || 0 }}%</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">运行时间:</span>
              <span class="metric-value">{{ formatRuntime(plugin.runtime) }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">事件数:</span>
              <span class="metric-value">{{ plugin.eventCount || 0 }}</span>
            </div>
          </div>

          <div class="plugin-actions">
            <t-button 
              size="small" 
              :theme="plugin.status === 'active' ? 'danger' : 'primary'"
              @click="togglePluginRuntime(plugin)"
            >
              {{ plugin.status === 'active' ? '停止' : '启动' }}
            </t-button>
            <t-button
              size="small"
              variant="outline"
              @click="restartPlugin(plugin)"
            >
              重启
            </t-button>
            <t-button
              size="small"
              variant="outline"
              @click="viewPluginLogs(plugin)"
            >
              日志
            </t-button>
            <t-dropdown :options="getRuntimeMenuOptions(plugin)">
              <t-button
                size="small"
                variant="text"
              >
                <t-icon name="more" />
              </t-button>
            </t-dropdown>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 系统资源监控 -->
    <t-card
      class="resource-monitor-card"
      title="系统资源监控"
      hover-shadow
    >
      <div class="monitor-tabs">
        <t-tabs v-model="monitorTab">
          <t-tab-panel
            value="performance"
            label="性能监控"
          >
            <div class="performance-charts">
              <div class="chart-container">
                <h4>内存使用趋势</h4>
                <div class="chart-placeholder">
                  <t-icon
                    name="chart-line"
                    size="48px"
                  />
                  <p>内存使用图表</p>
                </div>
              </div>
              <div class="chart-container">
                <h4>CPU使用趋势</h4>
                <div class="chart-placeholder">
                  <t-icon
                    name="chart-area"
                    size="48px"
                  />
                  <p>CPU使用图表</p>
                </div>
              </div>
            </div>
          </t-tab-panel>
          
          <t-tab-panel
            value="events"
            label="事件统计"
          >
            <div class="event-stats">
              <div class="event-summary">
                <div class="summary-item">
                  <div class="summary-number">
                    {{ totalEvents }}
                  </div>
                  <div class="summary-label">
                    总事件数
                  </div>
                </div>
                <div class="summary-item">
                  <div class="summary-number">
                    {{ eventsPerSecond }}
                  </div>
                  <div class="summary-label">
                    每秒事件
                  </div>
                </div>
                <div class="summary-item">
                  <div class="summary-number">
                    {{ errorEvents }}
                  </div>
                  <div class="summary-label">
                    错误事件
                  </div>
                </div>
              </div>
              
              <div class="event-chart">
                <h4>事件类型分布</h4>
                <div class="chart-placeholder">
                  <t-icon
                    name="chart-pie"
                    size="48px"
                  />
                  <p>事件分布图表</p>
                </div>
              </div>
            </div>
          </t-tab-panel>
          
          <t-tab-panel
            value="logs"
            label="系统日志"
          >
            <div class="system-logs">
              <div class="log-controls">
                <t-select
                  v-model="logLevel"
                  style="width: 120px;"
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
                <t-button
                  variant="outline"
                  @click="clearLogs"
                >
                  清空日志
                </t-button>
                <t-button
                  variant="outline"
                  @click="exportLogs"
                >
                  导出日志
                </t-button>
              </div>
              
              <div class="log-viewer">
                <div 
                  v-for="(log, index) in filteredLogs" 
                  :key="index"
                  class="log-entry"
                  :class="log.level"
                >
                  <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
                  <span class="log-level">{{ log.level.toUpperCase() }}</span>
                  <span class="log-source">{{ log.source }}</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </t-tab-panel>
        </t-tabs>
      </div>
    </t-card>

    <!-- 插件日志对话框 -->
    <t-dialog 
      v-model:visible="showLogDialog" 
      :title="`插件日志 - ${selectedPlugin?.name}`"
      width="800px"
      :footer="false"
    >
      <div class="plugin-log-viewer">
        <div class="log-header">
          <t-select
            v-model="pluginLogLevel"
            style="width: 120px;"
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
          <t-button
            variant="outline"
            @click="clearPluginLogs"
          >
            清空
          </t-button>
          <t-button
            variant="outline"
            @click="exportPluginLogs"
          >
            导出
          </t-button>
        </div>
        
        <div class="plugin-logs">
          <div 
            v-for="(log, index) in filteredPluginLogs" 
            :key="index"
            class="log-entry"
            :class="log.level"
          >
            <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePluginStore } from '../stores/plugin';
import type { PluginInfo } from '../stores/plugin';

const pluginStore = usePluginStore();

// 响应式状态
const frameStatus = ref<'active' | 'inactive' | 'error'>('inactive');
const runtimeFilter = ref('all');
const autoRefresh = ref(true);
const refreshInterval = ref('3000');
const monitorTab = ref('performance');
const logLevel = ref('all');
const pluginLogLevel = ref('all');
const showLogDialog = ref(false);
const selectedPlugin = ref<PluginInfo | null>(null);

// 性能数据
const totalMemoryUsage = ref(0);
const totalCpuUsage = ref(0);
const uptime = ref('00:00:00');
const totalEvents = ref(0);
const eventsPerSecond = ref(0);
const errorEvents = ref(0);

// 运行时插件数据
const runtimePlugins = ref<Array<PluginInfo & {
  status: 'active' | 'inactive' | 'error';
  memoryUsage?: number;
  cpuUsage?: number;
  runtime?: number;
  eventCount?: number;
}>>([]);

// 日志数据
const systemLogs = ref<Array<{
  timestamp: number;
  level: 'error' | 'warn' | 'info' | 'debug';
  source: string;
  message: string;
}>>([]);

const pluginLogs = ref<Array<{
  timestamp: number;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
}>>([]);

// 定时器
let refreshTimer: NodeJS.Timeout | null = null;

// 计算属性
const runningPlugins = computed(() => 
  runtimePlugins.value.filter(plugin => plugin.status === 'active')
);

const filteredRuntimePlugins = computed(() => {
  if (runtimeFilter.value === 'all') return runtimePlugins.value;
  return runtimePlugins.value.filter(plugin => plugin.status === runtimeFilter.value);
});

const filteredLogs = computed(() => {
  if (logLevel.value === 'all') return systemLogs.value;
  return systemLogs.value.filter(log => log.level === logLevel.value);
});

const filteredPluginLogs = computed(() => {
  if (pluginLogLevel.value === 'all') return pluginLogs.value;
  return pluginLogs.value.filter(log => log.level === pluginLogLevel.value);
});

// 方法
const getFrameStatusIcon = () => {
  switch (frameStatus.value) {
    case 'active': return 'check-circle';
    case 'inactive': return 'stop-circle';
    case 'error': return 'error-circle';
    default: return 'help-circle';
  }
};

const getFrameStatusText = () => {
  switch (frameStatus.value) {
    case 'active': return '运行中';
    case 'inactive': return '已停止';
    case 'error': return '错误状态';
    default: return '未知状态';
  }
};

const getRuntimeStatusTheme = (status: string) => {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'default';
    case 'error': return 'danger';
    default: return 'default';
  }
};

const getRuntimeStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return 'play-circle';
    case 'inactive': return 'stop-circle';
    case 'error': return 'error-circle';
    default: return 'help-circle';
  }
};

const getRuntimeStatusText = (status: string) => {
  switch (status) {
    case 'active': return '运行中';
    case 'inactive': return '已停止';
    case 'error': return '错误';
    default: return '未知';
  }
};

const formatRuntime = (runtime: number | undefined) => {
  if (!runtime) return '00:00:00';
  
  const hours = Math.floor(runtime / 3600000);
  const minutes = Math.floor((runtime % 3600000) / 60000);
  const seconds = Math.floor((runtime % 60000) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatLogTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};

const startAllPlugins = async () => {
  try {
    await pluginStore.startAllPlugins();
    frameStatus.value = 'active';
    await refreshFrameStatus();
  } catch (error) {
    console.error('启动所有插件失败:', error);
    frameStatus.value = 'error';
  }
};

const stopAllPlugins = async () => {
  try {
    await pluginStore.stopAllPlugins();
    frameStatus.value = 'inactive';
    await refreshFrameStatus();
  } catch (error) {
    console.error('停止所有插件失败:', error);
  }
};

const refreshFrameStatus = async () => {
  try {
    // 更新运行时插件状态
    const plugins = await pluginStore.getRuntimePlugins();
    // 过滤掉loading状态的插件，因为运行时插件不应该有loading状态，并进行类型转换
    runtimePlugins.value = plugins.filter(p => p.status !== 'loading') as any;
    
    // 更新性能数据
    const performance = await pluginStore.getPerformanceData();
    if (performance && typeof performance === 'object') {
      totalMemoryUsage.value = (performance as any).memory || 0;
      totalCpuUsage.value = (performance as any).cpu || 0;
      uptime.value = formatRuntime((performance as any).uptime || 0);
    } else {
      totalMemoryUsage.value = 0;
      totalCpuUsage.value = 0;
      uptime.value = formatRuntime(0);
    }
    
    // 更新事件统计
    const eventStats = await pluginStore.getEventStats();
    if ('totalErrors' in eventStats) {
      // 这是错误统计
      errorEvents.value = eventStats.totalErrors || 0;
      totalEvents.value = 0; // 暂时设为0，因为API不提供总事件数
      eventsPerSecond.value = 0; // 暂时设为0，因为API不提供每秒事件数
    } else if ('totalEvents' in eventStats) {
      // 这是事件统计
      totalEvents.value = eventStats.totalEvents || 0;
      eventsPerSecond.value = eventStats.eventsPerSecond || 0;
      errorEvents.value = eventStats.errorRate || 0;
    } else {
      // 空对象或错误情况
      totalEvents.value = 0;
      eventsPerSecond.value = 0;
      errorEvents.value = 0;
    }
    
    // 更新系统日志
    const logs = await pluginStore.getSystemLogs();
    systemLogs.value = logs;
    
  } catch (error) {
    console.error('刷新框架状态失败:', error);
  }
};

const togglePluginRuntime = async (plugin: PluginInfo) => {
  try {
    if (plugin.status === 'active') {
      await pluginStore.stopPlugin(plugin.id);
    } else {
      await pluginStore.startPlugin(plugin.id);
    }
    await refreshFrameStatus();
  } catch (error) {
    console.error('切换插件运行状态失败:', error);
  }
};

const restartPlugin = async (plugin: PluginInfo) => {
  try {
    await pluginStore.restartPlugin(plugin.id);
    await refreshFrameStatus();
  } catch (error) {
    console.error('重启插件失败:', error);
  }
};

const viewPluginLogs = async (plugin: PluginInfo) => {
  selectedPlugin.value = plugin;
  try {
    const logs = await pluginStore.getPluginLogs(plugin.id);
    pluginLogs.value = logs;
    showLogDialog.value = true;
  } catch (error) {
    console.error('获取插件日志失败:', error);
  }
};

const getRuntimeMenuOptions = (plugin: PluginInfo) => [
  {
    content: '查看详情',
    value: 'details',
    onClick: () => viewPluginDetails(plugin)
  },
  {
    content: '性能分析',
    value: 'performance',
    onClick: () => analyzePluginPerformance(plugin)
  },
  {
    content: '调试模式',
    value: 'debug',
    onClick: () => toggleDebugMode(plugin)
  },
  {
    content: '强制停止',
    value: 'kill',
    theme: 'error',
    onClick: () => killPlugin(plugin)
  }
];

const viewPluginDetails = (_plugin: PluginInfo) => {
  // TODO: 实现插件详情查看
};

const analyzePluginPerformance = (_plugin: PluginInfo) => {
  // TODO: 实现插件性能分析
};

const toggleDebugMode = async (plugin: PluginInfo) => {
  try {
    await pluginStore.toggleDebugMode(plugin.id);
  } catch (error) {
    console.error('切换调试模式失败:', error);
  }
};

const killPlugin = async (plugin: PluginInfo) => {
  try {
    await pluginStore.killPlugin(plugin.id);
    await refreshFrameStatus();
  } catch (error) {
    console.error('强制停止插件失败:', error);
  }
};

const clearLogs = () => {
  systemLogs.value = [];
};

const exportLogs = () => {
  const logs = systemLogs.value.map(log => 
    `[${formatLogTime(log.timestamp)}] ${log.level.toUpperCase()} ${log.source}: ${log.message}`
  ).join('\n');
  
  const blob = new Blob([logs], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `system_logs_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const clearPluginLogs = () => {
  pluginLogs.value = [];
};

const exportPluginLogs = () => {
  if (!selectedPlugin.value) return;
  
  const logs = pluginLogs.value.map(log => 
    `[${formatLogTime(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`
  ).join('\n');
  
  const blob = new Blob([logs], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${selectedPlugin.value.id}_logs_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const startAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  if (autoRefresh.value) {
    refreshTimer = setInterval(() => {
      refreshFrameStatus();
    }, parseInt(refreshInterval.value));
  }
};

// 监听自动刷新设置变化
const watchAutoRefresh = () => {
  startAutoRefresh();
};

// 生命周期
onMounted(() => {
  refreshFrameStatus();
  startAutoRefresh();
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});

// 监听变化
import { watch } from 'vue';
watch([autoRefresh, refreshInterval], watchAutoRefresh);
</script>

<style scoped>
.plugin-frame-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  margin: 0;
  color: var(--td-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.frame-overview {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
}

.status-card {
  min-height: 120px;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
  padding: 16px;
}

.status-indicator {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.status-indicator.running {
  background-color: var(--td-success-color-1);
  color: var(--td-success-color);
}

.status-indicator.stopped {
  background-color: var(--td-gray-color-1);
  color: var(--td-gray-color-6);
}

.status-indicator.error {
  background-color: var(--td-error-color-1);
  color: var(--td-error-color);
}

.status-info {
  flex: 1;
}

.status-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
}

.status-text {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.stats-card {
  min-height: 120px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 16px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: var(--td-brand-color);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.plugin-runtime-card {
  flex: 1;
  min-height: 0;
}

.runtime-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 16px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-group label {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  white-space: nowrap;
}

.plugin-runtime-list {
  max-height: 400px;
  overflow-y: auto;
}

.runtime-plugin-item {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background-color: var(--td-bg-color-container);
  transition: all 0.2s;
}

.runtime-plugin-item:hover {
  border-color: var(--td-brand-color);
}

.runtime-plugin-item.running {
  border-left: 4px solid var(--td-success-color);
}

.runtime-plugin-item.error {
  border-left: 4px solid var(--td-error-color);
}

.plugin-basic-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.plugin-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plugin-icon img {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
}

.plugin-details {
  flex: 1;
  min-width: 0;
}

.plugin-name {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.plugin-id {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  font-family: monospace;
}

.plugin-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 12px;
  padding: 12px;
  background-color: var(--td-bg-color-container-hover);
  border-radius: 6px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.metric-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.metric-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.plugin-actions {
  display: flex;
  gap: 8px;
}

.resource-monitor-card {
  flex-shrink: 0;
}

.monitor-tabs {
  min-height: 300px;
}

.performance-charts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.chart-container {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 16px;
  background-color: var(--td-bg-color-container);
}

.chart-container h4 {
  margin: 0 0 16px 0;
  color: var(--td-text-color-primary);
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--td-text-color-placeholder);
}

.event-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.summary-item {
  text-align: center;
  padding: 16px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  background-color: var(--td-bg-color-container);
}

.summary-number {
  font-size: 24px;
  font-weight: bold;
  color: var(--td-brand-color);
  margin-bottom: 4px;
}

.summary-label {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.event-chart {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 16px;
  background-color: var(--td-bg-color-container);
}

.event-chart h4 {
  margin: 0 0 16px 0;
  color: var(--td-text-color-primary);
}

.system-logs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.log-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.log-viewer {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  background-color: var(--td-bg-color-container);
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  font-family: monospace;
  font-size: 12px;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.error {
  background-color: var(--td-error-color-1);
}

.log-entry.warn {
  background-color: var(--td-warning-color-1);
}

.log-entry.info {
  background-color: var(--td-brand-color-1);
}

.log-time {
  color: var(--td-text-color-placeholder);
  white-space: nowrap;
}

.log-level {
  color: var(--td-text-color-secondary);
  font-weight: bold;
  min-width: 50px;
}

.log-source {
  color: var(--td-brand-color);
  min-width: 80px;
}

.log-message {
  color: var(--td-text-color-primary);
  flex: 1;
  word-break: break-all;
}

.plugin-log-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.log-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.plugin-logs {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  background-color: var(--td-bg-color-container);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .frame-overview {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .performance-charts {
    grid-template-columns: 1fr;
  }
  
  .event-summary {
    grid-template-columns: 1fr;
  }
  
  .plugin-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .runtime-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .plugin-metrics {
    grid-template-columns: 1fr;
  }
  
  .plugin-actions {
    flex-wrap: wrap;
  }
}
</style>