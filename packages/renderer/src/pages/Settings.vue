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
import { ref, onMounted } from 'vue';

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

:deep(.t-tabs__content) {
  height: 100%;
  overflow-y: auto;
}
</style>