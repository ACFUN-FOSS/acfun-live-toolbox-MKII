<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Card, List, Skeleton, Message, Empty } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';

// 小程序状态
const isLoading = ref(true);
const miniPrograms = ref([]);
const errorMsg = ref('');

// 获取小程序列表
const fetchMiniPrograms = async () => {
  try {
    isLoading.value = true;
    const data = await ipcRenderer.invoke('miniprogram:getList');
    miniPrograms.value = data;
    errorMsg.value = '';
  } catch (error) {
    errorMsg.value = `获取小程序列表失败: ${error instanceof Error ? error.message : String(error)}`;
    Message.error(errorMsg.value);
  } finally {
    isLoading.value = false;
  }
};

// 启动小程序
const launchMiniProgram = async (programId: string) => {
  try {
    await ipcRenderer.invoke('miniprogram:launch', programId);
    Message.success('小程序启动成功');
  } catch (error) {
    Message.error(`启动小程序失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 页面加载时获取小程序列表
onMounted(() => {
  fetchMiniPrograms();
});
</script>

<template>
  <div class="miniprogram-center">
    <div class="page-header">
      <h1>小程序中心</h1>
      <p>发现并管理可用的小程序扩展</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container">
      <Skeleton class="skeleton-card" repeat="6" />
    </div>

    <!-- 错误状态 -->
    <div v-else-if="errorMsg" class="error-container">
      <Empty description="{{ errorMsg }}" />
    </div>

    <!-- 小程序列表 -->
    <div v-else class="program-grid">
      <Card
        v-for="program in miniPrograms"
        :key="program.id"
        class="program-card"
        @click="launchMiniProgram(program.id)"
      >
        <div class="program-icon">
          <img :src="program.icon" alt="{{ program.name }}" />
        </div>
        <div class="program-info">
          <h3 class="program-name">{{ program.name }}</h3>
          <p class="program-desc">{{ program.description }}</p>
          <div class="program-meta">
            <span class="version">v{{ program.version }}</span>
            <span class="author">{{ program.author }}</span>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.miniprogram-center {
  padding: 20px;
  background-color: #0f172a; /* 页面背景色 - UI规范 */
  min-height: 100vh;
}

.page-header {
  margin-bottom: 30px;
  color: #f8fafc; /* 主要文本色 - UI规范 */
}

.page-header h1 {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 8px;
}

.page-header p {
  color: #cbd5e1; /* 次要文本色 - UI规范 */
  font-size: 16px;
}

.loading-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.skeleton-card {
  height: 200px;
  background-color: #1e293b; /* 卡片背景色 - UI规范 */
  border-radius: 4px; /* 统一圆角 - UI规范 */
}

.error-container {
  margin-top: 50px;
}

.program-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.program-card {
  background-color: #1e293b; /* 卡片背景色 - UI规范 */
  border-radius: 4px; /* 统一圆角 - UI规范 */
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: none;
}

.program-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.program-icon {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.program-icon img {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}

.program-info {
  padding: 0 20px 20px;
}

.program-name {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
  color: #f8fafc; /* 主要文本色 - UI规范 */
}

.program-desc {
  font-size: 14px;
  color: #cbd5e1; /* 次要文本色 - UI规范 */
  margin-bottom: 12px;
  line-height: 1.5;
}

.program-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8; /* 辅助文本色 - UI规范 */
}
</style>