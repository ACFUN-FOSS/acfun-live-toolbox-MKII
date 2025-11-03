<template>
  <div class="settings-page">
    <div class="page-header">
      <h2>系统设置</h2>
    </div>

    <div class="settings-content">
      <t-tabs v-model="activeTab" placement="left">
        <t-tab-panel value="general" label="通用设置">
          <div class="settings-section">
            <h3>应用设置</h3>
            <t-form :data="generalSettings" layout="vertical">
              <t-form-item label="启动时自动连接房间">
                <t-switch v-model="generalSettings.autoConnect" />
              </t-form-item>
              <t-form-item label="最小化到系统托盘">
                <t-switch v-model="generalSettings.minimizeToTray" />
              </t-form-item>
              <t-form-item label="开机自启动">
                <t-switch v-model="generalSettings.autoStart" />
              </t-form-item>
              <t-form-item label="检查更新">
                <t-switch v-model="generalSettings.checkUpdates" />
              </t-form-item>
            </t-form>
          </div>
        </t-tab-panel>

        <t-tab-panel value="danmu" label="弹幕设置">
          <div class="settings-section">
            <h3>弹幕显示</h3>
            <t-form :data="danmuSettings" layout="vertical">
              <t-form-item label="显示弹幕">
                <t-switch v-model="danmuSettings.enabled" />
              </t-form-item>
              <t-form-item label="弹幕滚动速度">
                <t-slider 
                  v-model="danmuSettings.scrollSpeed" 
                  :min="1" 
                  :max="10" 
                  :step="1"
                  :marks="{ 1: '慢', 5: '中', 10: '快' }"
                />
              </t-form-item>
              <t-form-item label="最大显示数量">
                <t-input-number 
                  v-model="danmuSettings.maxCount" 
                  :min="10" 
                  :max="100" 
                  :step="10"
                />
              </t-form-item>
              <t-form-item label="过滤重复弹幕">
                <t-switch v-model="danmuSettings.filterDuplicate" />
              </t-form-item>
            </t-form>
          </div>
        </t-tab-panel>

        <t-tab-panel value="plugins" label="插件设置">
          <div class="settings-section">
            <h3>插件管理</h3>
            <t-form :data="pluginSettings" layout="vertical">
              <t-form-item label="启用插件系统">
                <t-switch v-model="pluginSettings.enabled" />
              </t-form-item>
              <t-form-item label="插件安装目录">
                <t-input 
                  v-model="pluginSettings.installPath" 
                  readonly
                  suffix-icon="folder"
                  @suffix-click="selectPluginPath"
                />
              </t-form-item>
              <t-form-item label="允许开发者模式">
                <t-switch v-model="pluginSettings.devMode" />
              </t-form-item>
              <t-form-item label="插件更新检查">
                <t-switch v-model="pluginSettings.autoUpdate" />
              </t-form-item>
            </t-form>
          </div>
        </t-tab-panel>

        <t-tab-panel value="network" label="网络设置">
          <div class="settings-section">
            <h3>网络配置</h3>
            <t-form :data="networkSettings" layout="vertical">
              <t-form-item label="使用代理">
                <t-switch v-model="networkSettings.useProxy" />
              </t-form-item>
              <t-form-item v-if="networkSettings.useProxy" label="代理地址">
                <t-input 
                  v-model="networkSettings.proxyUrl" 
                  placeholder="http://127.0.0.1:8080"
                />
              </t-form-item>
              <t-form-item label="连接超时 (秒)">
                <t-input-number 
                  v-model="networkSettings.timeout" 
                  :min="5" 
                  :max="60" 
                  :step="5"
                />
              </t-form-item>
              <t-form-item label="重连间隔 (秒)">
                <t-input-number 
                  v-model="networkSettings.reconnectInterval" 
                  :min="1" 
                  :max="30" 
                  :step="1"
                />
              </t-form-item>
            </t-form>
          </div>
        </t-tab-panel>

        <t-tab-panel value="data" label="数据管理">
          <div class="settings-section">
            <h3>配置导出</h3>
            <t-form :data="exportOptions" layout="vertical">
              <t-form-item label="导出格式">
                <t-radio-group v-model="exportOptions.format">
                  <t-radio value="json">JSON</t-radio>
                  <t-radio value="csv">CSV</t-radio>
                  <t-radio value="xlsx">Excel</t-radio>
                </t-radio-group>
              </t-form-item>
              <t-form-item label="包含数据">
                <t-checkbox-group v-model="exportOptions.includeData">
                  <t-checkbox value="settings">应用设置</t-checkbox>
                  <t-checkbox value="plugins">插件配置</t-checkbox>
                  <t-checkbox value="rooms">房间信息</t-checkbox>
                  <t-checkbox value="logs">系统日志</t-checkbox>
                </t-checkbox-group>
              </t-form-item>
              <t-form-item>
                <t-button 
                  theme="primary" 
                  :loading="exportingData"
                  :disabled="!canExportData"
                  @click="exportData"
                >
                  <template #icon><t-icon name="download" /></template>
                  导出数据
                </t-button>
              </t-form-item>
            </t-form>

            <h3 style="margin-top: 32px;">配置导入</h3>
            <t-form layout="vertical">
              <t-form-item label="选择配置文件">
                <t-upload
                  v-model="importFiles"
                  :auto-upload="false"
                  accept=".json,.csv,.xlsx"
                  :max="1"
                  theme="file-input"
                  placeholder="选择配置文件"
                />
              </t-form-item>
              <t-form-item>
                <t-button 
                  variant="outline"
                  :loading="importingData"
                  :disabled="importFiles.length === 0"
                  @click="importData"
                >
                  <template #icon><t-icon name="upload" /></template>
                  导入配置
                </t-button>
              </t-form-item>
            </t-form>
          </div>
        </t-tab-panel>

        <t-tab-panel value="diagnostics" label="系统诊断">
          <div class="settings-section">
            <h3>诊断工具</h3>
            <p class="section-desc">
              生成系统诊断包，包含日志、配置和系统信息，用于问题排查和技术支持。
            </p>
            
            <t-form :data="diagnosticOptions" layout="vertical">
              <t-form-item label="包含内容">
                <t-checkbox-group v-model="diagnosticOptions.includeItems">
                  <t-checkbox value="logs">系统日志</t-checkbox>
                  <t-checkbox value="config">应用配置</t-checkbox>
                  <t-checkbox value="plugins">插件信息</t-checkbox>
                  <t-checkbox value="system">系统信息</t-checkbox>
                  <t-checkbox value="network">网络状态</t-checkbox>
                </t-checkbox-group>
              </t-form-item>
              <t-form-item label="日志时间范围">
                <t-date-range-picker 
                  v-model="diagnosticOptions.logTimeRange"
                  format="YYYY-MM-DD HH:mm:ss"
                  :presets="logTimePresets"
                />
              </t-form-item>
              <t-form-item>
                <t-space>
                  <t-button 
                    theme="primary"
                    :loading="generatingDiagnostic"
                    @click="generateDiagnostic"
                  >
                    <template #icon><t-icon name="tools" /></template>
                    生成诊断包
                  </t-button>
                  <t-button 
                    v-if="lastDiagnosticPath"
                    variant="outline"
                    @click="openDiagnosticFolder"
                  >
                    <template #icon><t-icon name="folder-open" /></template>
                    打开文件夹
                  </t-button>
                </t-space>
              </t-form-item>
            </t-form>

            <div v-if="lastDiagnosticPath" class="diagnostic-result">
              <t-alert theme="success" :message="`诊断包已生成：${lastDiagnosticPath}`" />
            </div>
          </div>
        </t-tab-panel>

        <t-tab-panel value="about" label="关于">
          <div class="settings-section">
            <div class="about-content">
              <div class="app-info">
                <h3>AcFun 直播工具箱 MKII</h3>
                <p>版本：{{ appVersion }}</p>
                <p>构建时间：{{ buildTime }}</p>
              </div>
              
              <div class="links">
                <t-button variant="outline" @click="openLink('https://github.com/your-repo')">
                  <template #icon><t-icon name="logo-github" /></template>
                  GitHub
                </t-button>
                <t-button variant="outline" @click="checkForUpdates">
                  <template #icon><t-icon name="refresh" /></template>
                  检查更新
                </t-button>
              </div>

              <div class="system-info">
                <h4>系统信息</h4>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">操作系统：</span>
                    <span class="value">{{ systemInfo.platform }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Node.js：</span>
                    <span class="value">{{ systemInfo.nodeVersion }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Electron：</span>
                    <span class="value">{{ systemInfo.electronVersion }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </t-tab-panel>
      </t-tabs>
    </div>

    <div class="settings-footer">
      <t-button @click="resetSettings" variant="outline">
        重置设置
      </t-button>
      <t-button @click="saveSettings" theme="primary">
        保存设置
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';

const activeTab = ref('general');

const generalSettings = ref({
  autoConnect: true,
  minimizeToTray: false,
  autoStart: false,
  checkUpdates: true
});

const danmuSettings = ref({
  enabled: true,
  scrollSpeed: 5,
  maxCount: 50,
  filterDuplicate: true
});

const pluginSettings = ref({
  enabled: true,
  installPath: '',
  devMode: false,
  autoUpdate: true
});

const networkSettings = ref({
  useProxy: false,
  proxyUrl: '',
  timeout: 10,
  reconnectInterval: 5
});

// 数据导出相关
const exportOptions = ref({
  format: 'json',
  includeData: ['settings', 'plugins']
});

const importFiles = ref([]);
const exportingData = ref(false);
const importingData = ref(false);

const canExportData = computed(() => {
  return exportOptions.value.includeData.length > 0 && exportOptions.value.format;
});

// 系统诊断相关
const diagnosticOptions = ref({
  includeItems: ['logs', 'config', 'system'],
  logTimeRange: []
});

const generatingDiagnostic = ref(false);
const lastDiagnosticPath = ref('');

const logTimePresets = {
  '最近1小时': () => {
    const end = new Date();
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    return [start, end];
  },
  '最近24小时': () => {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return [start, end];
  },
  '最近7天': () => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return [start, end];
  }
};

const appVersion = ref('2.0.0');
const buildTime = ref('2024-01-01 12:00:00');

const systemInfo = ref({
  platform: 'Windows 11',
  nodeVersion: '18.0.0',
  electronVersion: '25.0.0'
});

function selectPluginPath() {
  // TODO: 打开文件夹选择对话框
}

function openLink(url: string) {
  window.open(url, '_blank');
}

function checkForUpdates() {
  // TODO: 检查应用更新
}

function resetSettings() {
  // TODO: 重置所有设置到默认值
}

function saveSettings() {
  // TODO: 保存设置到主进程
}

function loadSettings() {
  // TODO: 从主进程加载设置
}

// 数据导出方法
async function exportData() {
  exportingData.value = true;
  try {
    // 模拟数据导出
    await new Promise(resolve => setTimeout(resolve, 2000));
    MessagePlugin.success(`数据导出成功 (${exportOptions.value.format.toUpperCase()} 格式)`);
  } catch (error) {
    MessagePlugin.error('数据导出失败');
  } finally {
    exportingData.value = false;
  }
}

async function importData() {
  importingData.value = true;
  try {
    // 模拟数据导入
    await new Promise(resolve => setTimeout(resolve, 1500));
    MessagePlugin.success('配置导入成功');
    importFiles.value = [];
  } catch (error) {
    MessagePlugin.error('配置导入失败');
  } finally {
    importingData.value = false;
  }
}

// 系统诊断方法
async function generateDiagnostic() {
  generatingDiagnostic.value = true;
  try {
    // 模拟生成诊断包
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    lastDiagnosticPath.value = `C:\\Users\\用户\\Desktop\\diagnostic-${timestamp}.zip`;
    
    MessagePlugin.success('诊断包生成成功');
  } catch (error) {
    MessagePlugin.error('诊断包生成失败');
  } finally {
    generatingDiagnostic.value = false;
  }
}

function openDiagnosticFolder() {
  // 模拟打开文件夹
  MessagePlugin.info('正在打开文件夹...');
}

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.settings-page {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.settings-content {
  flex: 1;
  overflow: hidden;
}

.settings-section {
  padding: 0 24px;
}

.settings-section h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.about-content {
  max-width: 600px;
}

.app-info {
  margin-bottom: 24px;
}

.app-info h3 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.app-info p {
  margin: 4px 0;
  color: var(--td-text-color-secondary);
}

.links {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
}

.system-info h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--td-border-color);
}

.info-item .label {
  color: var(--td-text-color-secondary);
}

.info-item .value {
  color: var(--td-text-color-primary);
  font-weight: 500;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--td-border-color);
  margin-top: 24px;
}

.section-desc {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.diagnostic-result {
  margin-top: 16px;
}

:deep(.t-tabs__content) {
  height: 100%;
  overflow-y: auto;
}
</style>