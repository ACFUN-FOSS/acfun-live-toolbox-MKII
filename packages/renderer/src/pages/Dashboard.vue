<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Card, Row, Col, Statistic, Message, Skeleton } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';

// 状态数据
const welcomeMessage = ref('欢迎使用 ACFUN 直播工具箱');
const userInfo = ref<{ name: string, avatar: string }>({
  name: '未登录',
  avatar: 'https://picsum.photos/200'
});

// 统计数据
const statsData = ref<{
  viewerCount: number,
  likeCount: number,
  bananaCount: number,
  acCoinCount: number
}>({
  viewerCount: 0,
  likeCount: 0,
  bananaCount: 0,
  acCoinCount: 0
});

// 动态内容块
const dynamicBlocks = ref<Array<{
  title: string,
  type: 'string' | 'list' | 'html',
  content: string | string[]
}>>([]);

// 加载状态
const isLoading = ref(true);
const errorMessage = ref('');

// 定时器ID
let updateTimer: number | null = null;

// 获取仪表盘数据
const fetchDashboardData = async () => {
  try {
    isLoading.value = true;
    errorMessage.value = '';

    // 调用API获取用户信息
    const userData = await ipcRenderer.invoke('user:getUserInfo');
    if (userData) {
      userInfo.value = {
        name: userData.name || 'ACFUN主播',
        avatar: userData.avatar || 'https://picsum.photos/200'
      };
    }

    // 调用API获取统计数据
    const statsResult = await ipcRenderer.invoke('dashboard:getStats');
if (statsResult.success) {
  statsData.value = {
    viewerCount: statsResult.data.viewerCount || 0,
    likeCount: statsResult.data.likeCount || 0,
    bananaCount: statsResult.data.bananaCount || 0,
    acCoinCount: statsResult.data.acCoinCount || 0
  };
} else {
  throw new Error(statsResult.error || '获取统计数据失败');
}

    // 调用API获取动态内容块
    const blocksResult = await ipcRenderer.invoke('dashboard:getDynamicBlocks');
if (blocksResult.success) {
  dynamicBlocks.value = blocksResult.data;
} else {
  throw new Error(blocksResult.error || '获取动态内容失败');
}
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    errorMessage.value = '获取数据失败，请稍后重试';
    Message.error('获取仪表盘数据失败');
  } finally {
    isLoading.value = false;
  }
};

// 页面加载时获取数据
onMounted(() => {
  // 立即获取数据
  fetchDashboardData();

  // 设置定时器，每30秒更新一次数据
  updateTimer = window.setInterval(fetchDashboardData, 30000);
});

// 页面卸载时清除定时器
onUnmounted(() => {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
});
</script>

<template>
  <div class="dashboard-container">
    <!-- 加载状态 -->
    <Skeleton v-if="isLoading" class="loading-skeleton" :animated="true">
      <div class="welcome-area-skeleton"></div>
      <div class="stats-row-skeleton">
        <div class="stats-card-skeleton"></div>
        <div class="stats-card-skeleton"></div>
        <div class="stats-card-skeleton"></div>
        <div class="stats-card-skeleton"></div>
      </div>
      <div class="dynamic-blocks-skeleton">
        <div class="dynamic-card-skeleton"></div>
        <div class="dynamic-card-skeleton"></div>
      </div>
    </Skeleton>

    <!-- 错误提示 -->
    <div v-else-if="errorMessage" class="error-container">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <div class="error-text">{{ errorMessage }}</div>
        <button class="retry-button" @click="fetchDashboardData">重试</button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div v-else class="content-area">
      <!-- 欢迎区域 -->
      <div class="welcome-area row-frame">
        <div class="welcome-text">
          <h1>{{ welcomeMessage }}</h1>
          <p>你好, {{ userInfo.name }} 👋</p>
        </div>
        <div class="user-avatar">
          <img :src="userInfo.avatar" alt="用户头像" class="avatar-img">
        </div>
      </div>

      <!-- 统计数据区域 -->
      <Row gutter="20" class="stats-row row-frame">
        <Col xs="24" sm="12" md="6">
          <Card class="stats-card">
            <Statistic
              title="观众数"
              :value="statsData.viewerCount"
              :value-style="{ color: 'var(--td-brand-color)' }"
            />
          </Card>
        </Col>
        <Col xs="24" sm="12" md="6">
          <Card class="stats-card">
            <Statistic
              title="点赞数"
              :value="statsData.likeCount"
              :value-style="{ color: 'var(--td-warning-color)' }"
            />
          </Card>
        </Col>
        <Col xs="24" sm="12" md="6">
          <Card class="stats-card">
            <Statistic
              title="香蕉数"
              :value="statsData.bananaCount"
              :value-style="{ color: 'var(--td-purple-color)' }"
            />
          </Card>
        </Col>
        <Col xs="24" sm="12" md="6">
          <Card class="stats-card">
            <Statistic
              title="AC币"
              :value="statsData.acCoinCount"
              :value-style="{ color: 'var(--td-danger-color)' }"
            />
          </Card>
        </Col>
      </Row>

      <!-- 动态内容块区域 -->
      <div class="dynamic-blocks">
        <template v-for="(block, index) in dynamicBlocks" :key="index">
          <Card class="dynamic-card" :title="block.title">
            <template v-if="block.type === 'string'">
              <p>{{ block.content }}</p>
            </template>
            <template v-else-if="block.type === 'list'">
              <ul class="block-list">
                <li v-for="(item, i) in block.content" :key="i">{{ item }}</li>
              </ul>
            </template>
            <template v-else-if="block.type === 'html'">
              <div v-html="block.content"></div>
            </template>
          </Card>
        </template>
      </div>

      <!-- 背景图片 -->
      <div class="background-image"></div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  position: relative;
  height: 100%;
  overflow: hidden;
  background-color: #0f172a; /* 深色主题背景色 */
}

.loading-skeleton {
  padding: 20px;
  height: 100%;
}

.welcome-area-skeleton {
  height: 120px;
  margin-bottom: 20px;
  border-radius: var(--td-radius-medium);
  border-left: 4px solid var(--td-brand-color);
  background-color: var(--td-bg-color-container);
}

.stats-row-skeleton {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stats-card-skeleton {
  flex: 1;
  height: 120px;
  border-radius: 4px; /* 统一圆角 - UI规范 */
  background-color: #1e293b; /* 卡片背景色 - UI规范 */
  background: linear-gradient(90deg, #1e293b 25%, #2d3748 50%, #1e293b 75%);
  background-size: 200% 100%;
  animation: skeleton-loading infinite;
}
@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.dynamic-blocks-skeleton {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dynamic-card-skeleton {
  height: 150px;
  border-radius: 4px; /* 统一圆角 - UI规范 */
  background-color: #1e293b; /* 卡片背景色 - UI规范 */
}

.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  background-color: var(--td-bg-color-container);
  border-radius: var(--td-radius-medium);
  box-shadow: var(--td-shadow-2);
}

.error-icon {
  font-size: 48px;
  margin-bottom: 20px;
  color: var(--td-warning-color);
}

.error-text {
  font-size: 16px;
  color: #f8fafc; /* 主要文本色 */
  margin-bottom: 20px;
  text-align: center;
}

.retry-button {
  background-color: var(--td-brand-color);
  padding: 8px 16px;
  color: white;
  border: none;
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  transition: background-color 0.3s;
}

.retry-button:hover {
  background-color: var(--td-brand-color-hover)
}

.content-area {
  padding: 20px;
}

.welcome-area {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  margin-bottom: 20px;
  background-color: #1e293b; /* 卡片背景色 - UI规范 */
  border-radius: 4px; /* 统一圆角 - UI规范 */
}

.welcome-text h1 {
 font-size: 24px;
 font-weight: bold;
 margin-bottom: 8px;
 color: #f8fafc; /* 主要文本色 - UI规范 */
}

.welcome-text p {
  font-size: 16px;
  color: #cbd5e1; /* 次要文本色 */
}

.user-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: var(--td-shadow-2);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
 height:120px;
 display: flex;
 flex-direction: column;
 justify-content: center;
 background-color: var(--td-bg-color-container);
 border-radius: var(--td-radius-medium);
 box-shadow: var(--td-shadow-4);
 box-shadow: var(--td-shadow-2);
 transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
 overflow: hidden;
 position: relative;
 border: 1px solid var(--td-border-color);
}

.stats-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  transform: translateY(-5px);
  box-shadow: var(--td-shadow-3);
}

.dynamic-blocks {
 display: flex;
 flex-direction: column;
 gap: 20px;
 padding: 16px;
 border: 1px solid var(--td-border-color);
 border-radius: var(--td-radius-medium);
 box-shadow: var(--td-shadow-4);
}

.dynamic-card {
  background-color: var(--td-bg-color-container);
  border-radius: var(--td-radius-medium);
  box-shadow: var(--td-shadow-4);
  transition: transform 0.3s, box-shadow 0.3s;
}
.dynamic-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}

.block-list {
  list-style-type: none;
  padding: 0;
}

.block-list li {
  padding: 8px 0;
  border-bottom: 1px solid var(--td-border-color);
}

.block-list li:last-child {
  border-bottom: none;
}

.background-image {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 300px;
  height: 300px;
  background-image: var(--td-bg-image);
  background-size: cover;
  background-position: center;
  opacity: var(--td-bg-opacity);
  right: 0;
  left: auto;
  z-index: -1;
}

/* 响应式设计 */
@media screen and (max-width:768px) {
  .welcome-area {
    flex-direction: column;
    text-align: center;
    gap: 16px;
    padding:16px;
}
.stats-row {flex-direction: column;}
.stats-card {width:100%; margin-bottom:16px;}
.dynamic-blocks {padding:0;}
}
@media screen and (max-width:480px) {
.welcome-text h1 {font-size:20px;}
.stats-card {height:100px;}
.background-image {width:200px;height:200px;}
}
</style>