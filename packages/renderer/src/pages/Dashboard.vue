<template>
  <div class="dashboard-container">
    <!-- 顶部导航栏 -->
    <header class="dashboard-header">
      <div class="logo-container">
        <img src="/assets/images/logo.png" alt="ACFUN直播工具箱" class="logo">
        <h1 class="app-name">ACFUN直播工具箱</h1>
      </div>
      <div class="user-info" v-if="userInfo">
        <img :src="userInfo.avatar" alt="用户头像" class="avatar">
        <span class="username">{{ userInfo.username }}</span>
        <button @click="logout" class="logout-btn">退出登录</button>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="dashboard-content">
      <!-- 直播状态卡片 -->
      <div class="status-card" :class="{ 'live': isLive }">
        <div class="status-indicator">{{ isLive ? '直播中' : '未开播' }}</div>
        <h2 class="live-title">{{ liveTitle || '未设置标题' }}</h2>
        <div class="viewers-count">{{ viewersCount }} 观众</div>
        <button @click="toggleLive" class="action-btn">{{ isLive ? '结束直播' : '开始直播' }}</button>
      </div>

      <!-- 数据统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-title">今日观看人数</div>
          <div class="stat-value">{{ todayViews }}</div>
          <div class="stat-change">{{ todayViewsChange > 0 ? '+' : '' }}{{ todayViewsChange }}% 较昨日</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">今日新增粉丝</div>
          <div class="stat-value">{{ todayFollowers }}</div>
          <div class="stat-change">{{ todayFollowersChange > 0 ? '+' : '' }}{{ todayFollowersChange }}% 较昨日</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">今日收入</div>
          <div class="stat-value">{{ todayIncome }} 元</div>
          <div class="stat-change">{{ todayIncomeChange > 0 ? '+' : '' }}{{ todayIncomeChange }}% 较昨日</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">直播时长</div>
          <div class="stat-value">{{ liveDuration }}</div>
          <div class="stat-change">{{ liveDurationChange > 0 ? '+' : '' }}{{ liveDurationChange }}% 较昨日</div>
        </div>
      </div>

      <!-- 快捷操作区域 -->
      <div class="quick-actions">
        <button class="action-card" @click="openLiveSettings">
          <div class="action-icon"><i class="fas fa-cog"></i></div>
          <div class="action-text">直播设置</div>
        </button>
        <button class="action-card" @click="openDanmuSettings">
          <div class="action-icon"><i class="fas fa-comment-dots"></i></div>
          <div class="action-text">弹幕管理</div>
        </button>
        <button class="action-card" @click="openAppsCenter">
          <div class="action-icon"><i class="fas fa-th"></i></div>
          <div class="action-text">应用中心</div>
        </button>
        <button class="action-card" @click="openSystemSettings">
          <div class="action-icon"><i class="fas fa-sliders-h"></i></div>
          <div class="action-text">系统设置</div>
        </button>
      </div>

      <!-- 最近直播记录 -->
      <div class="recent-lives">
        <h2 class="section-title">最近直播记录</h2>
        <div class="live-records">
          <div v-if="liveRecords.length === 0" class="no-data">暂无直播记录</div>
          <div v-else class="live-record" v-for="record in liveRecords" :key="record.id">
            <div class="record-date">{{ record.date }}</div>
            <div class="record-title">{{ record.title }}</div>
            <div class="record-duration">{{ record.duration }}</div>
            <div class="record-views">{{ record.views }} 观看</div>
            <div class="record-income">{{ record.income }} 元</div>
          </div>
        </div>
      </div>
    </main>

    <!-- 底部状态栏 -->
    <footer class="dashboard-footer">
      <div class="system-info">
        <span>系统状态: {{ systemStatus }}</span>
        <span>CPU使用率: {{ cpuUsage }}%</span>
        <span>内存使用率: {{ memoryUsage }}%</span>
      </div>
      <div class="version-info">版本 {{ appVersion }}</div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

// 状态定义
const userInfo = ref<any>(null);
const isLive = ref(false);
const liveTitle = ref('');
const viewersCount = ref(0);
const todayViews = ref(0);
const todayViewsChange = ref(0);
const todayFollowers = ref(0);
const todayFollowersChange = ref(0);
const todayIncome = ref(0);
const todayIncomeChange = ref(0);
const liveDuration = ref('00:00:00');
const liveDurationChange = ref(0);
const liveRecords = ref<any[]>([]);
const systemStatus = ref('正常');
const cpuUsage = ref(0);
const memoryUsage = ref(0);
const appVersion = ref('1.0.0');

const router = useRouter();

// 初始化数据
onMounted(async () => {
  // 获取用户信息
  const userInfoResult = await window.api.auth.getUserInfo();
  if (userInfoResult.success) {
    userInfo.value = userInfoResult.data;
  } else {
    // 未登录，跳转到登录页面
    router.push('/login');
  }

  // 获取应用版本
  appVersion.value = window.api.versions.appVersion || '1.0.0';

  // 模拟数据加载
  await loadDashboardData();

  // 启动系统监控
  startSystemMonitor();

  // 监听登出事件
  window.api.auth.onLogout(() => {
    router.push('/login');
  });
});

// 清理
onUnmounted(() => {
  window.api.auth.off('auth:logout');
  stopSystemMonitor();
});

// 加载仪表盘数据
async function loadDashboardData() {
  // 模拟API请求延迟
  await new Promise(resolve => setTimeout(resolve, 500));

  // 模拟数据
  isLive.value = false;
  liveTitle.value = '测试直播标题';
  viewersCount.value = 128;
  todayViews.value = 1532;
  todayViewsChange.value = 12;
  todayFollowers.value = 56;
  todayFollowersChange.value = 8;
  todayIncome.value = 256.8;
  todayIncomeChange.value = 23;
  liveDuration.value = '02:35:42';
  liveDurationChange.value = -5;

  // 模拟直播记录
  liveRecords.value = [
    {
      id: 1,
      date: '2023-07-15',
      title: '测试直播1',
      duration: '02:35:42',
      views: 1532,
      income: 256.8
    },
    {
      id: 2,
      date: '2023-07-14',
      title: '测试直播2',
      duration: '03:12:56',
      views: 1368,
      income: 207.5
    },
    {
      id: 3,
      date: '2023-07-13',
      title: '测试直播3',
      duration: '01:45:23',
      views: 987,
      income: 156.3
    }
  ];
}

// 切换直播状态
async function toggleLive() {
  isLive.value = !isLive.value;
  if (isLive.value) {
    // 开始直播逻辑
    liveTitle.value = liveTitle.value || '未命名直播';
    viewersCount.value = 0;
    // 实际应用中，这里应该调用直播API开始直播
  } else {
    // 结束直播逻辑
    // 实际应用中，这里应该调用直播API结束直播
  }
}

// 登出
async function logout() {
  const result = await window.api.auth.logout();
  if (result.success) {
    router.push('/login');
  }
}

// 系统监控
let systemMonitorInterval: number;

function startSystemMonitor() {
  systemMonitorInterval = window.setInterval(() => {
    // 模拟系统监控数据
    cpuUsage.value = Math.floor(Math.random() * 100);
    memoryUsage.value = Math.floor(Math.random() * 100);
  }, 5000);
}

function stopSystemMonitor() {
  clearInterval(systemMonitorInterval);
}

// 快捷操作函数
function openLiveSettings() {
  // 打开直播设置
  router.push('/live-settings');
}

function openDanmuSettings() {
  // 打开弹幕设置
  router.push('/danmu-settings');
}

function openAppsCenter() {
  // 打开应用中心
  router.push('/apps-center');
}

function openSystemSettings() {
  // 打开系统设置
  router.push('/system-settings');
}
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #1f2937;
  color: #f9fafb;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: #374151;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.app-name {
  font-size: 20px;
  font-weight: 600;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.username {
  font-size: 16px;
}

.logout-btn {
  padding: 6px 12px;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-btn:hover {
  background-color: #dc2626;
}

.dashboard-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.status-card {
  background-color: #374151;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.status-card.live {
  border-left: 4px solid #ef4444;
}

.status-indicator {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
}

.status-card.live .status-indicator {
  background-color: #ef4444;
  color: white;
}

.status-card:not(.live) .status-indicator {
  background-color: #4b5563;
  color: #d1d5db;
}

.live-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 12px;
}

.viewers-count {
  font-size: 18px;
  color: #9ca3af;
  margin-bottom: 16px;
}

.action-btn {
  padding: 10px 20px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background-color: #2563eb;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background-color: #374151;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.stat-title {
  font-size: 14px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.stat-change {
  font-size: 14px;
}

.stat-change[data-positive] {
  color: #10b981;
}

.stat-change[data-negative] {
  color: #ef4444;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.action-card {
  background-color: #374151;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.2s;
  border: none;
  color: #f9fafb;
}

.action-card:hover {
  background-color: #4b5563;
  transform: translateY(-2px);
}

.action-icon {
  font-size: 24px;
  color: #3b82f6;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.recent-lives {
  background-color: #374151;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.live-records {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.live-record {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr 1fr;
  padding: 12px;
  border-radius: 4px;
  background-color: #4b5563;
}

.no-data {
  text-align: center;
  padding: 24px;
  color: #9ca3af;
}

.dashboard-footer {
  padding: 16px 24px;
  background-color: #374151;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #9ca3af;
}

.system-info {
  display: flex;
  gap: 16px;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .live-record {
    grid-template-columns: 1fr 2fr 1fr;
  }

  .dashboard-footer {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .quick-actions {
    grid-template-columns: 1fr 1fr;
  }

  .live-record {
    grid-template-columns: 1fr;
  }
}
</style>