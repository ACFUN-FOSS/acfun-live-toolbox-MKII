<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import WujieVue from 'wujie-vue3';
// 使用preload脚本暴露的ipcRenderer
// const { ipcRenderer } = window;


const route = useRoute();
const appId = route.params.appId as string;
const appUrl = ref('');
const loading = ref(true);
const error = ref('');

const handleWujieError = (err: any) => {
  error.value = `子应用加载失败: ${err.message || '未知错误'}`;
  loading.value = false;
};

onMounted(async () => {
  try {
    // 获取应用配置
    const result = await ( window.api as any).app.getInstalledApps();
    if (!result.success) {
      throw new Error(result.error || '获取应用列表失败');
    }

    const app = result.data.find((a: any) => a.id === appId);
    if (!app) {
      throw new Error(`应用 ${appId} 不存在`);
    }

    // 检查是否支持main显示
    if (!app.supportedDisplays?.includes('main')) {
      throw new Error('该应用不支持在主窗口显示');
    }

    // 获取应用URL
    const port = import.meta.env.VITE_DEV_SERVER_PORT || 3000;
    appUrl.value = `http://localhost:${port}/application/${app.name}/main`;
    loading.value = false;
  } catch (err: any) {
    error.value = err.message || '加载应用失败';
    loading.value = false;
  }
});
</script>

<template>
  <div class="app-view-container">
    <div v-if="loading" class="loading-state">
      <t-loading size="large" />加载应用中...
    </div>

    <div v-else-if="error" class="error-state">
      <t-alert theme="error" :message="error" />
    </div>

    <WujieVue
      v-else
      width="100%"
      height="100%"
      name="sub-app-{{ appId }}"
      :url="appUrl"
      :loading="loading"
      @mounted="loading = false"
      @error="handleWujieError"
    ></WujieVue>
  </div>
</template>

<style scoped>
.app-view-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
  position: relative;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  flex-direction: column;
  gap: 16px;
}

.error-state {
  padding: 20px;
}

.app-iframe {
  border: none;
  background-color: white;
}
</style>