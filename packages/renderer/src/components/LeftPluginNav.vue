<template>
  <div class="left-plugin-nav">
    <div class="nav-header">
      <div class="nav-title">
        <t-button 
          v-if="currentView === 'detail'" 
          theme="default" 
          variant="text" 
          size="small"
          @click="goBack"
        >
          <t-icon name="chevron-left" />
        </t-button>
        <h3>{{ currentView === 'detail' ? '插件详情' : '插件管理' }}</h3>
      </div>
      <t-button 
        v-if="currentView === 'list'"
        theme="primary" 
        size="small" 
        :disabled="installing"
        class="install-btn"
        @click="showInstaller = true"
      >
        <template #icon>
          <t-icon name="add" />
        </template>
        安装插件
      </t-button>
    </div>

    <!-- 插件列表 -->
    <div
      v-if="currentView === 'list'"
      class="plugin-list"
    >
      <div
        v-if="loading"
        class="loading-state"
      >
        <t-loading
          size="large"
          text="加载插件中..."
        />
      </div>
      
      <div
        v-else-if="plugins.length === 0"
        class="empty-state"
      >
        <t-empty description="暂无插件">
          <template #image>
            <t-icon
              name="app"
              size="48px"
            />
          </template>
          <template #action>
            <t-button
              theme="primary"
              @click="showInstaller = true"
            >
              安装第一个插件
            </t-button>
          </template>
        </t-empty>
      </div>
      
      <div
        v-else
        class="plugin-items"
      >
        <div 
          v-for="plugin in plugins" 
          :key="plugin.id"
          class="plugin-item"
          :class="{ active: activePluginId === plugin.id }"
          @click="selectPlugin(plugin.id)"
        >
          <div class="plugin-icon">
            <img
              v-if="plugin.icon"
              :src="plugin.icon"
              :alt="plugin.name"
            >
            <t-icon
              v-else
              name="app"
              size="24px"
            />
          </div>
          <div class="plugin-info">
            <div class="plugin-name">
              {{ plugin.name }}
            </div>
            <div class="plugin-version">
              v{{ plugin.version }}
            </div>
          </div>
          <div class="plugin-status">
            <t-tag 
              :theme="plugin.enabled ? 'success' : 'default'" 
              size="small"
              variant="light"
            >
              {{ plugin.enabled ? '已启用' : '已禁用' }}
            </t-tag>
          </div>
          <div class="plugin-actions">
            <t-button
              theme="default"
              variant="text"
              size="small"
              @click.stop="viewPluginDetail(plugin.id)"
            >
              <t-icon name="chevron-right" />
            </t-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 插件详情 -->
    <div
      v-else-if="currentView === 'detail'"
      class="plugin-detail-container"
    >
      <PluginDetail 
        :plugin-id="selectedPluginId"
        @back="goBack"
        @plugin-updated="handlePluginUpdated"
      />
    </div>

    <div class="system-shortcuts">
      <div class="section-title">
        系统功能
      </div>
      <div 
        class="shortcut-item"
        @click="navigateToSystem('rooms')"
      >
        <t-icon name="home" />
        <span>房间管理</span>
      </div>
      <div 
        class="shortcut-item"
        @click="navigateToSystem('settings')"
      >
        <t-icon name="setting" />
        <span>系统设置</span>
      </div>
      <div 
        class="shortcut-item"
        @click="navigateToSystem('events')"
      >
        <t-icon name="time" />
        <span>事件历史</span>
      </div>
      <div 
        class="shortcut-item"
        @click="navigateToSystem('stats')"
      >
        <t-icon name="chart" />
        <span>数据统计</span>
      </div>
      <div 
        class="shortcut-item"
        @click="navigateToSystem('api-docs')"
      >
        <t-icon name="api" />
        <span>API 文档</span>
      </div>
      <div 
        class="shortcut-item"
        @click="navigateToSystem('console')"
      >
        <t-icon name="terminal" />
        <span>控制台</span>
      </div>
    </div>

    <!-- 插件安装对话框 -->
    <t-dialog
      v-model:visible="showInstaller"
      header="安装插件"
      width="500px"
      @confirm="installPlugin"
    >
      <div class="installer-content">
        <t-upload
          v-model="uploadFiles"
          theme="file-input"
          accept=".zip,.tar.gz"
          :auto-upload="false"
          placeholder="选择插件文件 (.zip, .tar.gz)"
        />
        <div
          v-if="installStatus"
          class="install-status"
          :class="installStatus.type"
        >
          {{ installStatus.message }}
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PluginDetail from './PluginDetail.vue';

interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  author?: string;
  homepage?: string;
  routes?: string[];
}

interface InstallStatus {
  type: 'success' | 'error' | 'loading';
  message: string;
}

const emit = defineEmits<{
  pluginSelected: [plugin: Plugin];
  systemNavigation: [route: string];
}>();

const plugins = ref<Plugin[]>([]);
const activePluginId = ref<string>('');
const showInstaller = ref(false);
const uploadFiles = ref<File[]>([]);
const installStatus = ref<InstallStatus | null>(null);
const loading = ref(true);
const installing = ref(false);

// 新增：视图管理
const currentView = ref<'list' | 'detail'>('list');
const selectedPluginId = ref<string>('');

async function loadPlugins() {
  loading.value = true;
  try {
    const result = await window.electronApi.plugin.list();
    if ('plugins' in result) {
      plugins.value = result.plugins.map(plugin => ({
        ...plugin,
        icon: undefined, // 暂时不支持图标
        routes: [`/plugin/${plugin.id}`] // 默认路由
      }));
    } else {
      console.error('Failed to load plugins:', result.error);
    }
  } catch (error) {
    console.error('Error loading plugins:', error);
  } finally {
    loading.value = false;
  }
}

function selectPlugin(pluginId: string) {
  activePluginId.value = pluginId;
}

// 查看插件详情
function viewPluginDetail(pluginId: string) {
  selectedPluginId.value = pluginId;
  currentView.value = 'detail';
}

// 返回插件列表
function goBack() {
  currentView.value = 'list';
  selectedPluginId.value = '';
}

// 处理插件更新
function handlePluginUpdated(updatedPlugin: Plugin) {
  const index = plugins.value.findIndex(p => p.id === updatedPlugin.id);
  if (index !== -1) {
    plugins.value[index] = updatedPlugin;
  }
}



function navigateToSystem(route: string) {
  activePluginId.value = '';
  emit('systemNavigation', route);
}

async function installPlugin() {
  if (uploadFiles.value.length === 0) {
    installStatus.value = { type: 'error', message: '请选择插件文件' };
    return;
  }

  installing.value = true;
  installStatus.value = { type: 'loading', message: '正在安装插件...' };

  try {
    const file = uploadFiles.value[0];
    
    // 创建临时文件路径（实际实现中可能需要更复杂的文件处理）
    const result = await window.electronApi.plugin.install({
      filePath: file.name, // 注意：在实际应用中需要处理文件上传
      overwrite: false
    });
    
    if (result && result.success) {
      installStatus.value = { type: 'success', message: '插件安装成功！' };
      
      // 重新加载插件列表
      await loadPlugins();
      
      setTimeout(() => {
        showInstaller.value = false;
        installStatus.value = null;
        uploadFiles.value = [];
      }, 1500);
    } else {
      installStatus.value = { type: 'error', message: '插件安装失败：' + ((result && (result as any).error) || '未知错误') };
    }
    
  } catch (error) {
    installStatus.value = { type: 'error', message: '插件安装失败：' + (error as Error).message };
  } finally {
    installing.value = false;
  }
}

onMounted(() => {
  loadPlugins();
});
</script>

<style scoped>
.left-plugin-nav {
  width: 280px;
  height: 100%;
  background: var(--td-bg-color-container);
  border-right: 1px solid var(--td-border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav-header {
  padding: 16px;
  border-bottom: 1px solid var(--td-border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.install-btn {
  font-size: 12px;
}

.plugin-list {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.plugin-detail-container {
  flex: 1;
  overflow-y: auto;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--td-text-color-secondary);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.empty-state {
  text-align: center;
  color: var(--td-text-color-placeholder);
  font-size: 14px;
  padding: 24px 0;
}

.plugin-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--td-border-color-light);
}

.plugin-item:hover {
  background: var(--td-bg-color-container-hover);
}

.plugin-item.active {
  background: var(--td-brand-color-light);
  border-left: 3px solid var(--td-brand-color);
}

.plugin-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--td-bg-color-component);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
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
  min-width: 0;
}

.plugin-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plugin-version {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.plugin-status {
  margin-right: 8px;
}

.plugin-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.system-shortcuts {
  padding: 16px;
  border-top: 1px solid var(--td-border-color);
}

.shortcut-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 4px;
}

.shortcut-item:hover {
  background: var(--td-bg-color-container-hover);
}

.shortcut-item .t-icon {
  margin-right: 8px;
  color: var(--td-text-color-secondary);
}

.shortcut-item span {
  font-size: 14px;
  color: var(--td-text-color-primary);
}

.installer-content {
  padding: 16px 0;
}

.install-status {
  margin-top: 16px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.install-status.success {
  background: var(--td-success-color-1);
  color: var(--td-success-color);
  border: 1px solid var(--td-success-color-3);
}

.install-status.error {
  background: var(--td-error-color-1);
  color: var(--td-error-color);
  border: 1px solid var(--td-error-color-3);
}

.install-status.loading {
  background: var(--td-warning-color-1);
  color: var(--td-warning-color);
  border: 1px solid var(--td-warning-color-3);
}
</style>