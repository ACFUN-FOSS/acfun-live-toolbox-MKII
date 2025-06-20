<script setup lang="ts">
// 使用preload脚本暴露的ipcRenderer
const { ipcRenderer } = window;

import {
  Menu as TMenu,
  MenuItem as TMenuItem,
  Icon,
  MenuGroup as TMenuGroup,
} from "tdesign-vue-next";
import { ref, onMounted,onUnmounted } from "vue";
import { useRouter } from 'vue-router';
const selectedKeys = ref("home");
const installedApps = ref([]);
const router = useRouter();

const collapsed = ref<boolean>(false);

const handleCollapse = () => {
  collapsed.value = !collapsed.value;
};

// 获取已安装应用列表 - 添加重试机制确保数据加载完成
const getInstalledApps = async (attempt = 1) => {
  try {
    const response = await window.api.app.getInstalledApps();
    if (response.success) {
      // 过滤出有supportedDisplays的应用
      const filteredApps = response.data.filter(app => 
        app.supportedDisplays && app.supportedDisplays.length > 0
      );
      installedApps.value = filteredApps;
      
      // 如果没有应用且未超过最大尝试次数，1秒后重试
      if (filteredApps.length === 0 && attempt < 3) {
        setTimeout(() => getInstalledApps(attempt + 1), 1000);
      }
    }
  } catch (error) {
    console.error('Failed to get installed apps (attempt ' + attempt + '):', error);
    // 出错时重试，最多3次
    if (attempt < 3) {
      setTimeout(() => getInstalledApps(attempt + 1), 1000);
    }
  }
};

// 处理应用点击事件
const handleAppClick = async (app) => {
  selectedKeys.value = `app-${app.id}`;
  const { supportedDisplays } = app;

  if (!supportedDisplays || supportedDisplays.length === 0) return;

  // 判断显示方式，优先main
  if (supportedDisplays.includes('main')) {
    router.push({ name: 'app-view', params: { appId: app.id } });
  } else if (supportedDisplays.includes('client')) {
    await ipcRenderer.invoke('app:startApp', app.id, 'client');
  }
};

// 组件挂载时获取应用列表并监听主进程事件
onMounted(() => {
    // 监听主进程发送的应用数据就绪事件
    const handleAppsReady = () => {
      getInstalledApps();
    };
    window.api.app.on('apps-ready', handleAppsReady);

    // 初始获取
    getInstalledApps();

  // 组件卸载时移除事件监听
  onUnmounted(() => {
    ipcRenderer.removeListener('apps-ready', handleAppsReady);
  });
});
</script>

<template>
  <div class="sidebar-container" :class="{ collapsed }">
    <!-- 添加折叠状态类绑定 -->
    <TMenu
     v-model="selectedKeys"
      class="sidebar-menu"
      :collapsed="collapsed"
      :width="200"
      :collapsed-width="64"
      :multiple="false"
    >
      <!-- 未命名分组 -->
      <TMenuItem value="home" :to="{ name: 'home' }">
        <template #icon>
          <Icon name="home" />
        </template>
        <span class="menu-text">首页</span>
      </TMenuItem>

      <!-- 应用分组 -->
      <TMenuGroup title="应用">
        <TMenuItem value="market">
          <template #icon>
            <Icon name="shop" />
          </template>
          <span class="menu-text">应用市场</span>
        </TMenuItem>

        <!-- 动态渲染已安装应用 -->
        <TMenuItem
          v-for="app in installedApps"
          :key="app.id"
          :value="'app-' + app.id"
          @click="handleAppClick(app)"
        >
          <template #icon>
            <Icon name="application" />
          </template>
          <span class="menu-text">{{ app.name }}</span>
        </TMenuItem>
      </TMenuGroup>

      <!-- 其它分组 -->
      <TMenuGroup title="其它">
        <TMenuItem value="settings">
          <template #icon>
            <Icon name="setting" />
          </template>
          <span class="menu-text">设置</span>
        </TMenuItem>
        <TMenuItem value="develop">
          <template #icon>
            <Icon name="system-code" />
          </template>
          <span class="menu-text">开发</span>
        </TMenuItem>
      </TMenuGroup>

      <!-- 操作按钮区域 -->
      <template #operations>
        <TButton
          class="t-demo-collapse-btn"
          variant="text"
          shape="square"
          @click="handleCollapse"
        >
          <Icon :name="collapsed ? 'menu-unfold' : 'menu-fold'" />
        </TButton>
      </template>
    </TMenu>
  </div>
</template>

<style scoped>
.sidebar-container {
  height: 100%;
  background-color: var(--td-bg-color-secondary);
  color: var(--td-text-color-primary);
  overflow: hidden;
  display: block !important;
  visibility: visible !important;
}

/* 深色模式特定样式 */
/* 已通过全局CSS变量实现主题适配，无需单独设置 */
/* 侧边栏背景色继承自父容器的 --td-bg-color-secondary */

.sidebar-menu {
  height: 100%;
  width: 100%;
  border-right: none;
  padding-top: 20px;
  box-sizing: border-box;
}
</style>
