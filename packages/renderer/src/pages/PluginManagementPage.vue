<template>
  <div class="plugin-management-page">
    <div class="page-header">
      <h2>插件管理</h2>
      <div class="header-actions">
        <t-button
          theme="primary"
          @click="showInstallDialog = true"
        >
          <t-icon name="add" />
          安装插件
        </t-button>
        <t-button
          variant="outline"
          @click="refreshPlugins"
        >
          <t-icon name="refresh" />
          刷新
        </t-button>
        <t-button
          variant="outline"
          @click="openPluginFolder"
        >
          <t-icon name="folder" />
          插件目录
        </t-button>
      </div>
    </div>

    <!-- 插件统计 -->
    <div class="plugin-stats">
      <t-card
        class="stat-card"
        hover-shadow
      >
        <div class="stat-content">
          <div class="stat-number">
            {{ pluginStore.plugins.length }}
          </div>
          <div class="stat-label">
            总插件数
          </div>
        </div>
      </t-card>
      <t-card
        class="stat-card"
        hover-shadow
      >
        <div class="stat-content">
          <div class="stat-number">
            {{ pluginStore.activePlugins.length }}
          </div>
          <div class="stat-label">
            已启用
          </div>
        </div>
      </t-card>
      <t-card
        class="stat-card"
        hover-shadow
      >
        <div class="stat-content">
          <div class="stat-number">
            {{ pluginStore.inactivePlugins.length }}
          </div>
          <div class="stat-label">
            已禁用
          </div>
        </div>
      </t-card>
      <t-card
        class="stat-card"
        hover-shadow
      >
        <div class="stat-content">
          <div class="stat-number">
            {{ pluginStore.errorPlugins.length }}
          </div>
          <div class="stat-label">
            错误
          </div>
        </div>
      </t-card>
    </div>

    <!-- 插件过滤器 -->
    <t-card
      class="filter-card"
      title="插件过滤"
      hover-shadow
    >
      <div class="filter-controls">
        <div class="filter-group">
          <label>状态:</label>
          <t-radio-group v-model="statusFilter">
            <t-radio value="all">
              全部
            </t-radio>
            <t-radio value="active">
              已启用
            </t-radio>
            <t-radio value="inactive">
              已禁用
            </t-radio>
            <t-radio value="error">
              错误
            </t-radio>
          </t-radio-group>
        </div>
        
        <div class="filter-group">
          <label>搜索:</label>
          <t-input 
            v-model="searchKeyword" 
            placeholder="搜索插件名称或描述..." 
            clearable
            style="width: 250px;"
          >
            <template #prefix-icon>
              <t-icon name="search" />
            </template>
          </t-input>
        </div>
        
        <div class="filter-group">
          <label>排序:</label>
          <t-select
            v-model="sortBy"
            style="width: 150px;"
          >
            <t-option
              value="name"
              label="名称"
            />
            <t-option
              value="version"
              label="版本"
            />
            <t-option
              value="status"
              label="状态"
            />
            <t-option
              value="installTime"
              label="安装时间"
            />
          </t-select>
        </div>
      </div>
    </t-card>

    <!-- 插件列表 -->
    <t-card
      class="plugin-list-card"
      title="插件列表"
      hover-shadow
    >
      <div
        v-if="pluginStore.isLoading"
        class="loading-state"
      >
        <t-loading />
        <span>加载插件列表中...</span>
      </div>

      <div
        v-else-if="filteredPlugins.length === 0"
        class="empty-state"
      >
        <t-icon
          name="plugin"
          size="48px"
        />
        <p>{{ searchKeyword ? '未找到匹配的插件' : '暂无插件' }}</p>
        <t-button
          v-if="!searchKeyword"
          theme="primary"
          @click="showInstallDialog = true"
        >
          安装第一个插件
        </t-button>
      </div>

      <div
        v-else
        class="plugin-grid"
      >
        <div 
          v-for="plugin in filteredPlugins" 
          :key="plugin.id"
          class="plugin-card"
          :class="{ 
            active: plugin.status === 'active',
            inactive: plugin.status === 'inactive',
            error: plugin.status === 'error'
          }"
        >
          <div class="plugin-header">
            <div class="plugin-icon">
              <img
                v-if="plugin.icon"
                :src="plugin.icon"
                :alt="plugin.name"
              >
              <t-icon
                v-else
                name="plugin"
                size="32px"
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
                :theme="getStatusTheme(plugin.status)"
                :icon="getStatusIcon(plugin.status)"
              >
                {{ getStatusText(plugin.status) }}
              </t-tag>
            </div>
          </div>

          <div class="plugin-description">
            {{ plugin.description || '暂无描述' }}
          </div>

          <div class="plugin-meta">
            <div class="meta-item">
              <t-icon name="user" />
              <span>{{ plugin.author || '未知作者' }}</span>
            </div>
            <div class="meta-item">
              <t-icon name="time" />
              <span>{{ formatInstallTime(plugin.installTime) }}</span>
            </div>
          </div>

          <div class="plugin-actions">
            <t-button 
              size="small" 
              :theme="plugin.status === 'active' ? 'danger' : 'primary'"
              @click="togglePlugin(plugin)"
            >
              {{ plugin.status === 'active' ? '禁用' : '启用' }}
            </t-button>
            <t-button
              size="small"
              variant="outline"
              @click="configurePlugin(plugin)"
            >
              配置
            </t-button>
            <t-dropdown :options="getPluginMenuOptions(plugin)">
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

    <!-- 安装插件对话框 -->
    <t-dialog 
      v-model:visible="showInstallDialog" 
      title="安装插件" 
      width="600px"
      @confirm="installPlugin"
      @cancel="resetInstallForm"
    >
      <t-tabs v-model="installMethod">
        <t-tab-panel
          value="file"
          label="本地文件"
        >
          <div class="install-form">
            <t-form
              ref="installFormRef"
              :data="installForm"
              :rules="installFormRules"
              layout="vertical"
            >
              <t-form-item
                label="插件文件"
                name="file"
              >
                <t-upload
                  v-model="installForm.files"
                  theme="file"
                  accept=".zip,.tar.gz,.tgz"
                  :max="1"
                  :auto-upload="false"
                  placeholder="选择插件压缩包"
                />
              </t-form-item>
            </t-form>
          </div>
        </t-tab-panel>
        
        <t-tab-panel
          value="url"
          label="在线安装"
        >
          <div class="install-form">
            <t-form
              ref="installFormRef"
              :data="installForm"
              :rules="installFormRules"
              layout="vertical"
            >
              <t-form-item
                label="插件URL"
                name="url"
              >
                <t-input 
                  v-model="installForm.url" 
                  placeholder="输入插件下载链接或Git仓库地址"
                />
              </t-form-item>
            </t-form>
          </div>
        </t-tab-panel>
        
        <t-tab-panel
          value="store"
          label="插件商店"
        >
          <div class="plugin-store">
            <t-input 
              v-model="storeSearchKeyword" 
              placeholder="搜索插件商店..." 
              clearable
            >
              <template #prefix-icon>
                <t-icon name="search" />
              </template>
            </t-input>
            
            <div class="store-plugins">
              <div 
                v-for="storePlugin in filteredStorePlugins" 
                :key="storePlugin.id"
                class="store-plugin-item"
              >
                <div class="store-plugin-info">
                  <div class="store-plugin-name">
                    {{ storePlugin.name }}
                  </div>
                  <div class="store-plugin-description">
                    {{ storePlugin.description }}
                  </div>
                  <div class="store-plugin-meta">
                    <span>{{ storePlugin.author }}</span>
                    <span>v{{ storePlugin.version }}</span>
                    <span>{{ storePlugin.downloads }} 下载</span>
                  </div>
                </div>
                <div class="store-plugin-actions">
                  <t-button
                    size="small"
                    theme="primary"
                    @click="installStorePlugin(storePlugin)"
                  >
                    安装
                  </t-button>
                </div>
              </div>
            </div>
          </div>
        </t-tab-panel>
      </t-tabs>
    </t-dialog>

    <!-- 插件配置对话框 -->
    <t-dialog 
      v-model:visible="showConfigDialog" 
      :title="`配置插件 - ${selectedPlugin?.name}`"
      width="700px"
      @confirm="savePluginConfig"
    >
      <div
        v-if="selectedPlugin"
        class="plugin-config"
      >
        <t-form
          :data="pluginConfig"
          layout="vertical"
        >
          <t-form-item 
            v-for="(config, key) in selectedPlugin.config" 
            :key="key"
            :label="config.label || key"
          >
            <component 
              :is="getConfigComponent(config.type)"
              v-model="pluginConfig[key]"
              v-bind="getConfigProps(config)"
            />
            <template
              v-if="config.description"
              #help
            >
              <span>{{ config.description }}</span>
            </template>
          </t-form-item>
        </t-form>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePluginStore } from '../stores/plugin';
import type { PluginInfo } from '../stores/plugin';

const pluginStore = usePluginStore();

// 响应式状态
const searchKeyword = ref('');
const statusFilter = ref('all');
const sortBy = ref('name');
const showInstallDialog = ref(false);
const showConfigDialog = ref(false);
const selectedPlugin = ref<PluginInfo | null>(null);
const pluginConfig = ref<Record<string, any>>({});

// 安装相关状态
const installMethod = ref('file');
const installForm = ref({
  files: [],
  url: ''
});
const installFormRef = ref();
const installFormRules = {
  file: [{ required: true, message: '请选择插件文件', type: 'error' }],
  url: [{ required: true, message: '请输入插件URL', type: 'error' }]
};

// 插件商店状态
const storeSearchKeyword = ref('');
const storePlugins = ref([
  {
    id: 'danmu-filter',
    name: '弹幕过滤器',
    description: '高级弹幕过滤和管理工具',
    author: 'AcFun Team',
    version: '1.2.0',
    downloads: 1250,
    category: 'danmu'
  },
  {
    id: 'gift-tracker',
    name: '礼物统计',
    description: '实时礼物统计和分析工具',
    author: 'Community',
    version: '2.1.0',
    downloads: 890,
    category: 'analytics'
  },
  {
    id: 'auto-reply',
    name: '自动回复',
    description: '智能弹幕自动回复系统',
    author: 'Bot Studio',
    version: '1.0.5',
    downloads: 2100,
    category: 'automation'
  }
]);

// 计算属性
const filteredPlugins = computed(() => {
  let plugins = pluginStore.plugins;

  // 状态过滤
  if (statusFilter.value !== 'all') {
    plugins = plugins.filter(plugin => plugin.status === statusFilter.value);
  }

  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    plugins = plugins.filter(plugin => 
      plugin.name.toLowerCase().includes(keyword) ||
      plugin.description?.toLowerCase().includes(keyword) ||
      plugin.author?.toLowerCase().includes(keyword)
    );
  }

  // 排序
  plugins.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'version':
        return a.version.localeCompare(b.version);
      case 'status':
        return a.status.localeCompare(b.status);
      case 'installTime':
        const aTime = a.installTime instanceof Date ? a.installTime.getTime() : (a.installTime || 0);
        const bTime = b.installTime instanceof Date ? b.installTime.getTime() : (b.installTime || 0);
        return bTime - aTime;
      default:
        return 0;
    }
  });

  return plugins;
});

const filteredStorePlugins = computed(() => {
  if (!storeSearchKeyword.value) return storePlugins.value;
  
  const keyword = storeSearchKeyword.value.toLowerCase();
  return storePlugins.value.filter(plugin => 
    plugin.name.toLowerCase().includes(keyword) ||
    plugin.description.toLowerCase().includes(keyword)
  );
});

// 方法
const refreshPlugins = async () => {
  await pluginStore.refreshPlugins();
};

const getStatusTheme = (status: string) => {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'default';
    case 'error': return 'danger';
    default: return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return 'check-circle';
    case 'inactive': return 'close-circle';
    case 'error': return 'error-circle';
    default: return 'help-circle';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'active': return '已启用';
    case 'inactive': return '已禁用';
    case 'error': return '错误';
    default: return '未知';
  }
};

const formatInstallTime = (timestamp: Date | number | undefined) => {
  if (!timestamp) return '未知';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleDateString();
};

const togglePlugin = async (plugin: PluginInfo) => {
  try {
    await pluginStore.togglePlugin(plugin.id, !plugin.enabled);
  } catch (error) {
    console.error('切换插件状态失败:', error);
  }
};

const configurePlugin = (plugin: PluginInfo) => {
  selectedPlugin.value = plugin;
  pluginConfig.value = { ...plugin.config };
  showConfigDialog.value = true;
};

const getPluginMenuOptions = (plugin: PluginInfo) => [
  {
    content: '查看详情',
    value: 'details',
    onClick: () => viewPluginDetails(plugin)
  },
  {
    content: '重新加载',
    value: 'reload',
    onClick: () => reloadPlugin(plugin)
  },
  {
    content: '导出配置',
    value: 'export',
    onClick: () => exportPluginConfig(plugin)
  },
  {
    content: '卸载插件',
    value: 'uninstall',
    theme: 'error',
    onClick: () => uninstallPlugin(plugin)
  }
];

const viewPluginDetails = (_plugin: PluginInfo) => {
  // TODO: 实现插件详情查看
};

const reloadPlugin = async (plugin: PluginInfo) => {
  try {
    await pluginStore.reloadPlugin(plugin.id);
  } catch (error) {
    console.error('重新加载插件失败:', error);
  }
};

const exportPluginConfig = (plugin: PluginInfo) => {
  const config = JSON.stringify(plugin.config, null, 2);
  const blob = new Blob([config], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plugin.id}_config.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const uninstallPlugin = async (plugin: PluginInfo) => {
  try {
    await pluginStore.uninstallPlugin(plugin.id);
  } catch (error) {
    console.error('卸载插件失败:', error);
  }
};

const installPlugin = async () => {
  const valid = await installFormRef.value?.validate();
  if (!valid) return false;

  try {
    if (installMethod.value === 'file') {
      // 安装本地文件
      const file = installForm.value.files[0];
      await pluginStore.installPlugin(file);
    } else if (installMethod.value === 'url') {
      // 从URL安装
      await pluginStore.installPluginFromUrl(installForm.value.url);
    }
    
    showInstallDialog.value = false;
    resetInstallForm();
    await refreshPlugins();
  } catch (error) {
    console.error('安装插件失败:', error);
  }
};

const installStorePlugin = async (storePlugin: any) => {
  try {
    await pluginStore.installPluginFromStore(storePlugin.id);
    await refreshPlugins();
  } catch (error) {
    console.error('从商店安装插件失败:', error);
  }
};

const resetInstallForm = () => {
  installForm.value = {
    files: [],
    url: ''
  };
  installFormRef.value?.clearValidate();
};

const savePluginConfig = async () => {
  if (!selectedPlugin.value) return;
  
  try {
    await pluginStore.updatePluginConfig(selectedPlugin.value.id, pluginConfig.value);
    showConfigDialog.value = false;
  } catch (error) {
    console.error('保存插件配置失败:', error);
  }
};

const getConfigComponent = (type: string) => {
  switch (type) {
    case 'boolean': return 't-switch';
    case 'number': return 't-input-number';
    case 'select': return 't-select';
    case 'textarea': return 't-textarea';
    default: return 't-input';
  }
};

const getConfigProps = (config: any) => {
  const props: any = {};
  
  if (config.type === 'select' && config.options) {
    props.options = config.options;
  }
  
  if (config.type === 'number') {
    props.min = config.min;
    props.max = config.max;
    props.step = config.step;
  }
  
  if (config.placeholder) {
    props.placeholder = config.placeholder;
  }
  
  return props;
};

const openPluginFolder = () => {
  // TODO: 打开插件目录
};

// 生命周期
onMounted(() => {
  pluginStore.loadPlugins();
});
</script>

<style scoped>
.plugin-management-page {
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

.plugin-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  min-height: 80px;
}

.stat-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60px;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: var(--td-brand-color);
}

.stat-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-top: 4px;
}

.filter-card {
  flex-shrink: 0;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  white-space: nowrap;
}

.plugin-list-card {
  flex: 1;
  min-height: 0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--td-text-color-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--td-text-color-secondary);
}

.empty-state p {
  margin: 16px 0;
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  max-height: 500px;
  overflow-y: auto;
}

.plugin-card {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 16px;
  background-color: var(--td-bg-color-container);
  transition: all 0.2s;
}

.plugin-card:hover {
  border-color: var(--td-brand-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.plugin-card.active {
  border-color: var(--td-success-color);
}

.plugin-card.error {
  border-color: var(--td-error-color);
}

.plugin-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.plugin-icon {
  width: 40px;
  height: 40px;
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

.plugin-info {
  flex: 1;
  min-width: 0;
}

.plugin-name {
  font-weight: 500;
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-version {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.plugin-description {
  color: var(--td-text-color-secondary);
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.plugin-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.plugin-actions {
  display: flex;
  gap: 8px;
}

.install-form {
  padding: 16px 0;
}

.plugin-store {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 400px;
}

.store-plugins {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.store-plugin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  background-color: var(--td-bg-color-container);
}

.store-plugin-info {
  flex: 1;
  min-width: 0;
}

.store-plugin-name {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.store-plugin-description {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin: 4px 0;
}

.store-plugin-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.plugin-config {
  max-height: 400px;
  overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .plugin-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .plugin-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
  
  .filter-controls {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .plugin-stats {
    grid-template-columns: 1fr;
  }
  
  .plugin-grid {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>