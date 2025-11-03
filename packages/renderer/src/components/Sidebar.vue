<template>
  <div class="sidebar">
    <!-- 主导航菜单 -->
    <div class="main-nav">
      <t-menu 
        v-model="activeMenu"
        :collapsed="collapsed"
        theme="light"
        width="100%"
        @change="handleMenuChange"
      >
        <!-- 首页 -->
        <t-menu-item
          value="home"
          @click="navigateTo('/home')"
        >
          <template #icon>
            <t-icon name="home" />
          </template>
          首页
        </t-menu-item>
        
        <!-- 直播功能 -->
        <t-submenu
          value="live"
          title="直播功能"
        >
          <template #icon>
            <t-icon name="video" />
          </template>
          <t-menu-item
            value="live-room"
            @click="navigateTo('/live/room')"
          >
            <template #icon>
              <t-icon name="desktop" />
            </template>
            房间管理
          </t-menu-item>
          <t-menu-item
            value="live-danmu"
            @click="navigateTo('/live/danmu')"
          >
            <template #icon>
              <t-icon name="chat" />
            </template>
            弹幕管理
          </t-menu-item>
        </t-submenu>
        
        <!-- 插件管理 -->
        <t-submenu
          value="plugins"
          title="插件管理"
        >
          <template #icon>
            <t-icon name="app" />
          </template>
          <t-menu-item
            value="plugin-management"
            @click="navigateTo('/plugins/management')"
          >
            <template #icon>
              <t-icon name="setting" />
            </template>
            插件管理
          </t-menu-item>
        </t-submenu>
        
        <!-- 系统功能 -->
        <t-submenu
          value="system"
          title="系统功能"
        >
          <template #icon>
            <t-icon name="tools" />
          </template>
          <t-menu-item
            value="system-settings"
            @click="navigateTo('/system/settings')"
          >
            <template #icon>
              <t-icon name="setting-1" />
            </template>
            系统设置
          </t-menu-item>
          <t-menu-item
            value="system-console"
            @click="navigateTo('/system/console')"
          >
            <template #icon>
              <t-icon name="code" />
            </template>
            控制台
          </t-menu-item>
          <t-menu-item
            value="system-develop"
            @click="navigateTo('/system/develop')"
          >
            <template #icon>
              <t-icon name="bug" />
            </template>
            开发工具
          </t-menu-item>
        </t-submenu>
      </t-menu>
    </div>
    
    <!-- 分隔线 -->
    <t-divider v-if="dynamicPlugins.length > 0" />
    
    <!-- 动态插件导航 -->
    <div
      v-if="dynamicPlugins.length > 0"
      class="plugin-nav"
    >
      <div class="plugin-nav-header">
        <t-icon
          name="plugin"
          class="plugin-icon"
        />
        <span
          v-if="!collapsed"
          class="plugin-title"
        >插件导航</span>
      </div>
      
      <div class="plugin-list">
        <div 
          v-for="plugin in dynamicPlugins" 
          :key="plugin.id"
          class="plugin-item"
          :class="{ 'active': activePlugin === plugin.id }"
          @click="openPlugin(plugin)"
        >
          <div class="plugin-info">
            <img 
              v-if="plugin.icon" 
              :src="plugin.icon" 
              :alt="plugin.name"
              class="plugin-avatar"
            >
            <t-icon
              v-else
              name="app"
              class="plugin-default-icon"
            />
            <div
              v-if="!collapsed"
              class="plugin-details"
            >
              <div class="plugin-name">
                {{ plugin.name }}
              </div>
              <div class="plugin-version">
                v{{ plugin.version }}
              </div>
            </div>
          </div>
          
          <!-- 插件状态指示器 -->
          <div class="plugin-status">
            <t-badge 
              :dot="true" 
              :color="getPluginStatusColor(plugin.status)"
              :title="getPluginStatusText(plugin.status)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { usePluginStore } from '../stores/plugin';
import { useSidebarStore } from '../stores/sidebar';

interface DynamicPlugin {
  id: string;
  name: string;
  version: string;
  icon?: string;
  status: 'active' | 'inactive' | 'error' | 'loading';
  route?: string;
  sidebarDisplay?: {
    show: boolean;
    order?: number;
    group?: string;
  };
}

const router = useRouter();
const route = useRoute();
const pluginStore = usePluginStore();
const sidebarStore = useSidebarStore();

const activeMenu = ref('home');
const activePlugin = ref<string | null>(null);
const collapsed = computed(() => sidebarStore.collapsed);

// 获取需要在侧边栏显示的动态插件
const dynamicPlugins = computed<DynamicPlugin[]>(() => {
  return pluginStore.plugins
    .filter(plugin => plugin.sidebarDisplay?.show)
    .sort((a, b) => (a.sidebarDisplay?.order || 999) - (b.sidebarDisplay?.order || 999));
});

// 监听路由变化，更新活跃菜单项
watch(() => route.path, (newPath) => {
  updateActiveMenu(newPath);
}, { immediate: true });

function updateActiveMenu(path: string) {
  if (path.startsWith('/home')) {
    activeMenu.value = 'home';
    activePlugin.value = null;
  } else if (path.startsWith('/live/room')) {
    activeMenu.value = 'live-room';
    activePlugin.value = null;
  } else if (path.startsWith('/live/danmu')) {
    activeMenu.value = 'live-danmu';
    activePlugin.value = null;
  } else if (path.startsWith('/plugins/management')) {
    activeMenu.value = 'plugin-management';
    activePlugin.value = null;
  } else if (path.startsWith('/system/settings')) {
    activeMenu.value = 'system-settings';
    activePlugin.value = null;
  } else if (path.startsWith('/system/console')) {
    activeMenu.value = 'system-console';
    activePlugin.value = null;
  } else if (path.startsWith('/system/develop')) {
    activeMenu.value = 'system-develop';
    activePlugin.value = null;
  } else if (path.startsWith('/plugins/frame/')) {
    // 动态插件路由
    const pluginId = path.split('/plugins/frame/')[1];
    activeMenu.value = '';
    activePlugin.value = pluginId;
  } else {
    activeMenu.value = '';
    activePlugin.value = null;
  }
}

function handleMenuChange(value: string) {
  console.log('Menu changed:', value);
}

function navigateTo(path: string) {
  router.push(path);
}

function openPlugin(plugin: DynamicPlugin) {
  if (plugin.route) {
    router.push(plugin.route);
  } else {
    // 默认使用插件框架路由
    router.push(`/plugins/frame/${plugin.id}`);
  }
}

function getPluginStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'default';
    case 'error':
      return 'error';
    case 'loading':
      return 'warning';
    default:
      return 'default';
  }
}

function getPluginStatusText(status: string): string {
  switch (status) {
    case 'active':
      return '运行中';
    case 'inactive':
      return '已停止';
    case 'error':
      return '错误';
    case 'loading':
      return '加载中';
    default:
      return '未知';
  }
}



// 键盘快捷键支持
function handleKeyboardShortcut(event: KeyboardEvent) {
  if (event.altKey) {
    switch (event.key) {
      case '1':
        event.preventDefault();
        navigateTo('/home');
        break;
      case '2':
        event.preventDefault();
        navigateTo('/live/room');
        break;
      case '3':
        event.preventDefault();
        navigateTo('/plugins/management');
        break;
      case '4':
        event.preventDefault();
        navigateTo('/system/settings');
        break;
      case '5':
        event.preventDefault();
        navigateTo('/system/console');
        break;
    }
  }
}

onMounted(() => {
  // 注册键盘快捷键
  document.addEventListener('keydown', handleKeyboardShortcut);
  
  // 加载插件列表
  pluginStore.loadPlugins();
});
</script>

<style scoped>
.sidebar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--td-bg-color-container);
  border-right: 1px solid var(--td-border-level-1-color);
}

.main-nav {
  flex: 1;
  overflow-y: auto;
}

.plugin-nav {
  padding: 8px 0;
}

.plugin-nav-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  font-weight: 500;
}

.plugin-icon {
  font-size: 14px;
}

.plugin-title {
  flex: 1;
}

.plugin-list {
  padding: 0 8px;
}

.plugin-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin: 2px 0;
  border-radius: var(--td-radius-default);
  cursor: pointer;
  transition: all 0.2s;
}

.plugin-item:hover {
  background-color: var(--td-bg-color-component-hover);
}

.plugin-item.active {
  background-color: var(--td-brand-color-light);
  color: var(--td-brand-color);
}

.plugin-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.plugin-avatar {
  width: 20px;
  height: 20px;
  border-radius: var(--td-radius-small);
  object-fit: cover;
}

.plugin-default-icon {
  font-size: 16px;
  color: var(--td-text-color-placeholder);
}

.plugin-details {
  flex: 1;
  min-width: 0;
}

.plugin-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-version {
  font-size: 10px;
  color: var(--td-text-color-placeholder);
  margin-top: 1px;
}

.plugin-status {
  margin-left: 8px;
}



/* 折叠状态样式调整 */
:deep(.t-menu--collapsed) {
  .plugin-nav-header {
    justify-content: center;
    padding: 8px;
  }
  
  .plugin-title {
    display: none;
  }
  
  .plugin-details {
    display: none;
  }
  
  .plugin-item {
    justify-content: center;
    padding: 8px;
  }
  
  .plugin-status {
    display: none;
  }
}

/* 自定义滚动条 */
.main-nav::-webkit-scrollbar,
.plugin-list::-webkit-scrollbar {
  width: 4px;
}

.main-nav::-webkit-scrollbar-track,
.plugin-list::-webkit-scrollbar-track {
  background: transparent;
}

.main-nav::-webkit-scrollbar-thumb,
.plugin-list::-webkit-scrollbar-thumb {
  background-color: var(--td-scrollbar-color);
  border-radius: 2px;
}

.main-nav::-webkit-scrollbar-thumb:hover,
.plugin-list::-webkit-scrollbar-thumb:hover {
  background-color: var(--td-scrollbar-hover-color);
}
</style>