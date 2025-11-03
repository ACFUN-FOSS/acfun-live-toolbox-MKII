<template>
  <div class="central-plugin-container">
    <!-- 系统页面容器 -->
    <div v-if="isSystemPage" class="system-page-container">
      <component :is="systemComponent" />
    </div>

    <!-- 插件容器 -->
    <div v-else-if="currentPlugin" class="plugin-container">
      <div class="plugin-header">
        <div class="plugin-info">
          <h3>{{ currentPlugin.name }}</h3>
          <span class="plugin-version">v{{ currentPlugin.version }}</span>
        </div>
        <div class="plugin-actions">
          <t-button 
            size="small" 
            variant="outline"
            @click="reloadPlugin"
            :loading="isReloading"
          >
            <template #icon><t-icon name="refresh" /></template>
            刷新
          </t-button>
        </div>
      </div>
      
      <div class="plugin-content" ref="pluginContentRef">
        <!-- Wujie 微前端容器 -->
        <WujieVue
          v-if="currentPlugin && pluginUrl"
          :key="pluginKey"
          :name="currentPlugin.id"
          :url="pluginUrl"
          :sync="false"
          :fetch="customFetch"
          :props="pluginProps"
          @beforeLoad="onPluginBeforeLoad"
          @beforeMount="onPluginBeforeMount"
          @afterMount="onPluginAfterMount"
          @beforeUnmount="onPluginBeforeUnmount"
          @afterUnmount="onPluginAfterUnmount"
          @loadError="onPluginLoadError"
        />
        
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-state">
          <t-loading size="large" text="正在加载插件..." />
        </div>
        
        <!-- 错误状态 -->
        <div v-if="loadError" class="error-state">
          <div class="error-icon">
            <t-icon name="error-circle" size="48px" />
          </div>
          <h3>插件加载失败</h3>
          <p>{{ loadError }}</p>
          <t-button theme="primary" @click="reloadPlugin">
            重新加载
          </t-button>
        </div>
      </div>
    </div>

    <!-- 默认欢迎页面 -->
    <div v-else class="welcome-page">
      <div class="welcome-content">
        <div class="welcome-icon">
          <t-icon name="app" size="64px" />
        </div>
        <h2>欢迎使用 AcFun 直播工具箱</h2>
        <p>从左侧选择一个插件开始使用，或者安装新的插件来扩展功能。</p>
        <div class="quick-actions">
          <t-button theme="primary" @click="$emit('showInstaller')">
            <template #icon><t-icon name="add" /></template>
            安装插件
          </t-button>
          <t-button variant="outline" @click="$emit('systemNavigation', 'rooms')">
            <template #icon><t-icon name="home" /></template>
            房间管理
          </t-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import WujieVue from 'wujie-vue3';

interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  routes?: string[];
  entryUrl?: string;
}

const props = defineProps<{
  currentPlugin: Plugin | null;
  systemPage?: string;
}>();

const emit = defineEmits<{
  showInstaller: [];
  systemNavigation: [route: string];
  pluginEvent: [event: { type: string; data: any }];
}>();

// 系统页面组件映射
const systemComponents = {
  rooms: defineAsyncComponent(() => import('../pages/LiveRoomPage.vue')),
  settings: defineAsyncComponent(() => import('../pages/Settings.vue')),
  events: defineAsyncComponent(() => import('../pages/EventsHistory.vue')),
  stats: defineAsyncComponent(() => import('../pages/Stats.vue')),
  'api-docs': defineAsyncComponent(() => import('../pages/ApiDocs.vue')),
  console: defineAsyncComponent(() => import('../pages/Console.vue')),
  overlay: defineAsyncComponent(() => import('../pages/Overlay.vue'))
};

const pluginContentRef = ref<HTMLElement>();
const isLoading = ref(false);
const isReloading = ref(false);
const loadError = ref<string>('');
const pluginKey = ref(0);

const isSystemPage = computed(() => !!props.systemPage);
const systemComponent = computed(() => {
  return props.systemPage ? systemComponents[props.systemPage as keyof typeof systemComponents] : null;
});

const pluginUrl = computed(() => {
  if (!props.currentPlugin) return '';
  
  // 构建插件 URL - 实际应该从插件配置获取
  const baseUrl = `http://localhost:3000/plugins/${props.currentPlugin.id}`;
  return props.currentPlugin.entryUrl || `${baseUrl}/index.html`;
});

const pluginProps = computed(() => ({
  // 传递给插件的属性
  pluginId: props.currentPlugin?.id,
  version: props.currentPlugin?.version,
  // API 桥接对象
  api: {
    // 提供给插件的 API 方法
    sendMessage: (message: any) => {
      emit('pluginEvent', { type: 'message', data: message });
    },
    getConfig: () => {
      // TODO: 从主进程获取插件配置
      return {};
    },
    setConfig: (config: any) => {
      // TODO: 保存插件配置到主进程
      console.log('Plugin config update:', config);
    }
  }
}));

// 自定义 fetch 函数，用于插件资源请求
function customFetch(url: string, options?: RequestInit) {
  // 可以在这里添加认证、代理等逻辑
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'X-Plugin-Token': 'your-plugin-token' // 插件认证令牌
    }
  });
}

// 插件生命周期事件处理
function onPluginBeforeLoad() {
  isLoading.value = true;
  loadError.value = '';
}

function onPluginBeforeMount() {
  // Plugin is about to mount
}

function onPluginAfterMount() {
  isLoading.value = false;
  isReloading.value = false;
  
  // 通知插件已加载
  emit('pluginEvent', { 
    type: 'mounted', 
    data: { pluginId: props.currentPlugin?.id } 
  });
}

function onPluginBeforeUnmount() {
  // Plugin is about to unmount
}

function onPluginAfterUnmount() {
  // Plugin has been unmounted
}

function onPluginLoadError(error: Error) {
  isLoading.value = false;
  isReloading.value = false;
  loadError.value = error.message || '未知错误';
  console.error('Plugin load error:', error);
}

function reloadPlugin() {
  if (!props.currentPlugin) return;
  
  isReloading.value = true;
  loadError.value = '';
  
  // 强制重新加载插件
  pluginKey.value++;
}

// 监听插件变化
watch(() => props.currentPlugin, (newPlugin, oldPlugin) => {
  if (newPlugin?.id !== oldPlugin?.id) {
    loadError.value = '';
    pluginKey.value++;
  }
}, { immediate: true });
</script>

<style scoped>
.central-plugin-container {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-page);
}

.welcome-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.welcome-content {
  text-align: center;
  max-width: 400px;
}

.welcome-icon {
  margin-bottom: 24px;
  color: var(--td-brand-color);
}

.welcome-content h2 {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.welcome-content p {
  margin: 0 0 32px 0;
  font-size: 16px;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}

.quick-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.system-page-container {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.plugin-container {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plugin-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--td-border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--td-bg-color-container);
}

.plugin-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plugin-info h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.plugin-version {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-component);
  padding: 2px 8px;
  border-radius: 12px;
}

.plugin-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.loading-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--td-bg-color-page);
}

.error-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--td-bg-color-page);
}

.error-icon {
  margin-bottom: 16px;
  color: var(--td-error-color);
}

.error-state h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: var(--td-text-color-primary);
}

.error-state p {
  margin: 0 0 24px 0;
  color: var(--td-text-color-secondary);
  text-align: center;
}

/* Wujie 容器样式 */
:deep(.wujie-container) {
  width: 100%;
  height: 100%;
}

:deep(.wujie-container iframe) {
  width: 100%;
  height: 100%;
  border: none;
}
</style>