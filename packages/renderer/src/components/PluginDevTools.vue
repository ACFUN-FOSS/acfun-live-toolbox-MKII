<template>
  <div class="plugin-dev-tools">
    <div class="dev-tools-header">
      <h3>插件开发工具</h3>
      <p class="description">
        配置外部Vue/React项目进行插件开发和调试
      </p>
    </div>

    <div class="dev-tools-content">
      <!-- 外部项目配置 -->
      <div class="config-section">
        <h4>外部项目配置</h4>
        
        <div class="form-group">
          <label>项目URL地址：</label>
          <t-input
            v-model="config.projectUrl"
            placeholder="http://localhost:3000"
            @blur="validateUrl"
          />
          <div
            v-if="urlError"
            class="error-message"
          >
            {{ urlError }}
          </div>
          <div class="help-text">
            输入您的Vue/React开发服务器地址
          </div>
        </div>

        <div class="form-group">
          <label>Node.js代码路径：</label>
          <div class="path-input-group">
            <t-input
              v-model="config.nodePath"
              placeholder="C:\path\to\your\plugin\backend"
              readonly
            />
            <t-button
              variant="outline"
              @click="selectNodePath"
            >
              选择目录
            </t-button>
          </div>
          <div class="help-text">
            选择包含Node.js后端代码的目录
          </div>
        </div>

        <div class="form-group">
          <label>插件ID：</label>
          <t-input
            v-model="config.pluginId"
            placeholder="my-dev-plugin"
          />
          <div class="help-text">
            用于标识开发中的插件
          </div>
        </div>
      </div>

      <!-- 调试选项 -->
      <div class="config-section">
        <h4>调试选项</h4>
        
        <div class="checkbox-group">
          <t-checkbox v-model="config.hotReload">
            启用热重载
          </t-checkbox>
          <div class="help-text">
            文件变化时自动重新加载插件
          </div>
        </div>

        <div class="checkbox-group">
          <t-checkbox v-model="config.debugMode">
            调试模式
          </t-checkbox>
          <div class="help-text">
            启用详细的调试日志输出
          </div>
        </div>

        <div class="checkbox-group">
          <t-checkbox v-model="config.autoConnect">
            自动连接
          </t-checkbox>
          <div class="help-text">
            启动时自动连接到外部项目
          </div>
        </div>
      </div>

      <!-- 状态显示 -->
      <div class="status-section">
        <h4>连接状态</h4>
        
        <div class="status-item">
          <span class="status-label">前端项目：</span>
          <t-tag :theme="frontendStatus.connected ? 'success' : 'default'">
            {{ frontendStatus.connected ? '已连接' : '未连接' }}
          </t-tag>
          <span
            v-if="frontendStatus.url"
            class="status-url"
          >{{ frontendStatus.url }}</span>
        </div>

        <div class="status-item">
          <span class="status-label">后端代码：</span>
          <t-tag :theme="backendStatus.loaded ? 'success' : 'default'">
            {{ backendStatus.loaded ? '已加载' : '未加载' }}
          </t-tag>
          <span
            v-if="backendStatus.path"
            class="status-path"
          >{{ backendStatus.path }}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions-section">
        <t-button 
          theme="primary" 
          :loading="starting"
          :disabled="!canStart"
          @click="startDebugging"
        >
          开始调试
        </t-button>
        
        <t-button 
          :disabled="!isDebugging"
          @click="stopDebugging"
        >
          停止调试
        </t-button>
        
        <t-button 
          variant="outline"
          :loading="testing"
          @click="testConnection"
        >
          测试连接
        </t-button>
        
        <t-button 
          variant="outline"
          :loading="saving"
          @click="saveConfig"
        >
          保存配置
        </t-button>
      </div>

      <!-- 日志输出 -->
      <div
        v-if="config.debugMode"
        class="logs-section"
      >
        <h4>调试日志</h4>
        <div class="logs-container">
          <div 
            v-for="(log, index) in debugLogs" 
            :key="index"
            class="log-entry"
            :class="log.level"
          >
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
        <div class="logs-actions">
          <t-button
            size="small"
            @click="clearLogs"
          >
            清空日志
          </t-button>
          <t-button
            size="small"
            variant="outline"
            @click="exportLogs"
          >
            导出日志
          </t-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

interface DevConfig {
  projectUrl: string;
  nodePath: string;
  pluginId: string;
  hotReload: boolean;
  debugMode: boolean;
  autoConnect: boolean;
}

interface ConnectionStatus {
  connected: boolean;
  url?: string;
}

interface BackendStatus {
  loaded: boolean;
  path?: string;
}

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
}

const config = ref<DevConfig>({
  projectUrl: 'http://localhost:3000',
  nodePath: '',
  pluginId: '',
  hotReload: true,
  debugMode: false,
  autoConnect: false
});

const frontendStatus = ref<ConnectionStatus>({ connected: false });
const backendStatus = ref<BackendStatus>({ loaded: false });
const debugLogs = ref<LogEntry[]>([]);

const urlError = ref('');
const starting = ref(false);
const testing = ref(false);
const saving = ref(false);
const isDebugging = ref(false);

const canStart = computed(() => {
  return config.value.projectUrl && 
         config.value.nodePath && 
         config.value.pluginId && 
         !urlError.value;
});

function validateUrl() {
  urlError.value = '';
  if (config.value.projectUrl) {
    try {
      new URL(config.value.projectUrl);
    } catch {
      urlError.value = '请输入有效的URL地址';
    }
  }
}

async function selectNodePath() {
  try {
    const result = await window.electronApi.dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择Node.js代码目录'
    });
    
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      config.value.nodePath = result.filePaths[0];
    }
  } catch (error) {
    addLog('error', `选择目录失败: ${error}`);
  }
}

async function testConnection() {
  testing.value = true;
  
  try {
    // 测试前端连接
    const response = await fetch(config.value.projectUrl);
    if (response.ok) {
      frontendStatus.value = { connected: true, url: config.value.projectUrl };
      addLog('info', '前端项目连接成功');
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    frontendStatus.value = { connected: false };
    addLog('error', `前端项目连接失败: ${error}`);
  }
  
  // 测试后端路径
  if (config.value.nodePath) {
    try {
      const exists = await window.electronApi.fs.exists(config.value.nodePath);
      if (exists) {
        backendStatus.value = { loaded: true, path: config.value.nodePath };
        addLog('info', '后端代码路径有效');
      } else {
        throw new Error('路径不存在');
      }
    } catch (error) {
      backendStatus.value = { loaded: false };
      addLog('error', `后端路径验证失败: ${error}`);
    }
  }
  
  testing.value = false;
}

async function startDebugging() {
  starting.value = true;
  
  try {
    // 保存配置
    await saveConfig();
    
    // 启动调试会话
    const debugSession = {
      pluginId: config.value.pluginId,
      frontendUrl: config.value.projectUrl,
      backendPath: config.value.nodePath,
      hotReload: config.value.hotReload,
      debugMode: config.value.debugMode
    };
    
    await window.electronApi.plugin.startDebugSession(debugSession);
    
    isDebugging.value = true;
    addLog('info', '调试会话已启动');
    
    // 如果启用热重载，开始监听文件变化
    if (config.value.hotReload) {
      await window.electronApi.plugin.enableHotReload(config.value.pluginId);
      addLog('info', '热重载已启用');
    }
    
  } catch (error) {
    addLog('error', `启动调试失败: ${error}`);
  } finally {
    starting.value = false;
  }
}

async function stopDebugging() {
  try {
    await window.electronApi.plugin.stopDebugSession(config.value.pluginId);
    isDebugging.value = false;
    addLog('info', '调试会话已停止');
  } catch (error) {
    addLog('error', `停止调试失败: ${error}`);
  }
}

async function saveConfig() {
  saving.value = true;
  
  try {
    await window.electronApi.plugin.saveDevConfig(config.value);
    addLog('info', '配置已保存');
  } catch (error) {
    addLog('error', `保存配置失败: ${error}`);
  } finally {
    saving.value = false;
  }
}

async function loadConfig() {
  try {
    const result = await window.electronApi.plugin.loadDevConfig();
    if (result && (result as any).success) {
      const savedConfig = (result as any).data || {};
      config.value = { ...config.value, ...savedConfig };
    } else if (result && (result as any).error) {
      addLog('error', `加载配置失败: ${(result as any).error}`);
    }
  } catch (error) {
    addLog('error', `加载配置失败: ${error}`);
  }
}

function addLog(level: LogEntry['level'], message: string) {
  debugLogs.value.push({
    level,
    message,
    timestamp: Date.now()
  });
  
  // 限制日志数量
  if (debugLogs.value.length > 100) {
    debugLogs.value = debugLogs.value.slice(-100);
  }
}

function clearLogs() {
  debugLogs.value = [];
}

function exportLogs() {
  const logsText = debugLogs.value
    .map(log => `[${formatTime(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`)
    .join('\n');
  
  const blob = new Blob([logsText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plugin-dev-logs-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

onMounted(async () => {
  await loadConfig();
  
  // 如果启用自动连接，尝试连接
  if (config.value.autoConnect) {
    await testConnection();
  }
});

onUnmounted(() => {
  // 清理资源
  if (isDebugging.value) {
    stopDebugging();
  }
});
</script>

<style scoped>
.plugin-dev-tools {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.dev-tools-header {
  margin-bottom: 32px;
}

.dev-tools-header h3 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.description {
  margin: 0;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.config-section {
  margin-bottom: 32px;
  padding: 20px;
  background: var(--td-bg-color-container);
  border-radius: 12px;
  border: 1px solid var(--td-border-color);
}

.config-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.path-input-group {
  display: flex;
  gap: 8px;
}

.path-input-group .t-input {
  flex: 1;
}

.help-text {
  margin-top: 4px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.error-message {
  margin-top: 4px;
  font-size: 12px;
  color: var(--td-error-color);
}

.checkbox-group {
  margin-bottom: 16px;
}

.checkbox-group:last-child {
  margin-bottom: 0;
}

.status-section {
  margin-bottom: 32px;
  padding: 20px;
  background: var(--td-bg-color-container);
  border-radius: 12px;
  border: 1px solid var(--td-border-color);
}

.status-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.status-item:last-child {
  margin-bottom: 0;
}

.status-label {
  min-width: 80px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
}

.status-url,
.status-path {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  font-family: monospace;
}

.actions-section {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.logs-section {
  padding: 20px;
  background: var(--td-bg-color-container);
  border-radius: 12px;
  border: 1px solid var(--td-border-color);
}

.logs-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.logs-container {
  max-height: 300px;
  overflow-y: auto;
  background: var(--td-bg-color-page);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  font-family: monospace;
  font-size: 12px;
}

.log-entry {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  line-height: 1.4;
}

.log-entry:last-child {
  margin-bottom: 0;
}

.log-time {
  color: var(--td-text-color-placeholder);
  min-width: 80px;
}

.log-level {
  min-width: 50px;
  font-weight: 600;
}

.log-entry.info .log-level {
  color: var(--td-success-color);
}

.log-entry.warn .log-level {
  color: var(--td-warning-color);
}

.log-entry.error .log-level {
  color: var(--td-error-color);
}

.log-entry.debug .log-level {
  color: var(--td-text-color-placeholder);
}

.log-message {
  flex: 1;
  color: var(--td-text-color-primary);
}

.logs-actions {
  display: flex;
  gap: 8px;
}
</style>