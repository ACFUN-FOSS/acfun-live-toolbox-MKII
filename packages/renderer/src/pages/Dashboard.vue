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
          <div class="stat-change" :data-positive="todayViewsChange > 0">{{ todayViewsChange > 0 ? '+' : '' }}{{ todayViewsChange }}% 较昨日</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">今日新增粉丝</div>
          <div class="stat-value">{{ todayFollowers }}</div>
          <div class="stat-change" :data-positive="todayFollowersChange > 0">{{ todayFollowersChange > 0 ? '+' : '' }}{{ todayFollowersChange }}% 较昨日</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">今日收入</div>
          <div class="stat-value">{{ todayIncome }} 元</div>
          <div class="stat-change" :data-positive="todayIncomeChange > 0">{{ todayIncomeChange > 0 ? '+' : '' }}{{ todayIncomeChange }}% 较昨日</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">直播时长</div>
          <div class="stat-value">{{ liveDuration }}</div>
          <div class="stat-change" :data-positive="liveDurationChange > 0">{{ liveDurationChange > 0 ? '+' : '' }}{{ liveDurationChange }}% 较昨日</div>
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
  try {
    const userInfoResult = await window.api.auth.getUserInfo();
    userInfo.value = userInfoResult;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    // 未登录或获取失败，跳转到登录页面
    router.push('/login');
  }

  // 获取应用版本
  appVersion.value = window.api.versions.appVersion || '1.0.0';

  // 加载真实数据
  await loadDashboardData();

  // 启动系统监控
  startSystemMonitor();

  // 监听登出事件
  const logoutListener = () => {
    router.push('/login');
  };
  window.api.auth.onLogout(logoutListener);

  // 监听认证状态变化事件
  const authStatusListener = (status: any) => {
    console.log('认证状态变化:', status);
    if (!status.isAuthenticated) {
      router.push('/login');
    } else if (status.userInfo) {
      userInfo.value = status.userInfo;
    }
  };
  window.api.auth.onAuthStatusChanged(authStatusListener);

  // 监听统计数据更新事件
  const statsListener = (stats: any) => {
    updateDashboardStats(stats);
  };
  window.api.stats.onStatsUpdated(statsListener);

  // 监听直播状态更新事件
  const liveStatusListener = (status: any) => {
    isLive.value = status.isLive;
    liveTitle.value = status.title;
    viewersCount.value = status.viewers;
  };
  window.api.live.onStatusChange(liveStatusListener);

  // 存储监听器以便后续清理
  (window as any).dashboardListeners = {
    logout: logoutListener,
    authStatus: authStatusListener,
    stats: statsListener,
    liveStatus: liveStatusListener
  };
});

// 清理
onUnmounted(() => {
  const listeners = (window as any).dashboardListeners;
  if (listeners) {
    window.api.auth.off('auth:logout', listeners.logout);
    window.api.auth.off('auth:status-changed', listeners.authStatus);
    window.api.stats.off('stats:stats-updated', listeners.stats);
    window.api.live.off('live:status-change', listeners.liveStatus);
  }
  stopSystemMonitor();
});

// 加载仪表盘数据
async function loadDashboardData() {
  try {
    // 获取今日统计数据
    const todayStats = await window.api.stats.getToday();
    if (todayStats.success) {
      todayViews.value = todayStats.data.views;
      todayFollowers.value = todayStats.data.followers;
      todayIncome.value = todayStats.data.income;
      liveDuration.value = todayStats.data.duration;
    }

    // 获取对比数据
    const comparisonStats = await window.api.stats.getComparison();
    if (comparisonStats.success) {
      todayViewsChange.value = comparisonStats.data.viewsChange;
      todayFollowersChange.value = comparisonStats.data.followersChange;
      todayIncomeChange.value = comparisonStats.data.incomeChange;
      liveDurationChange.value = comparisonStats.data.durationChange;
    }

    // 获取直播历史记录
    const history = await window.api.live.getHistory();
    if (history.success) {
      liveRecords.value = history.data.records;
    }

    // 获取当前直播状态
    const liveStatus = await window.api.live.getStatus();
    if (liveStatus.success) {
      isLive.value = liveStatus.data.isLive;
      liveTitle.value = liveStatus.data.title;
      viewersCount.value = liveStatus.data.viewers;
    }
  } catch (error) {
    console.error('加载仪表盘数据失败:', error);
  }
}

// 更新仪表盘统计数据
function updateDashboardStats(stats: any) {
  todayViews.value = stats.today.views;
  todayFollowers.value = stats.today.followers;
  todayIncome.value = stats.today.income;
  liveDuration.value = stats.today.duration;
  todayViewsChange.value = stats.comparison.viewsChange;
  todayFollowersChange.value = stats.comparison.followersChange;
  todayIncomeChange.value = stats.comparison.incomeChange;
  liveDurationChange.value = stats.comparison.durationChange;
}

// 切换直播状态
async function toggleLive() {
  try {
    if (isLive.value) {
      // 结束直播
      const result = await window.api.live.end();
      if (result.success) {
        isLive.value = false;
        viewersCount.value = 0;
      } else {
        alert('结束直播失败: ' + result.message);
      }
    } else {
      // 开始直播
      const result = await window.api.live.start({
        title: liveTitle.value || '未命名直播'
      });
      if (result.success) {
        isLive.value = true;
        viewersCount.value = 0;
      } else {
        alert('开始直播失败: ' + result.message);
      }
    }
  } catch (error) {
    console.error('切换直播状态失败:', error);
    alert('操作失败，请重试');
  }
}

// 登出
async function logout() {
  try {
    await window.api.auth.logout();
    // 登出成功后，认证状态变化事件会触发并导航到登录页
  } catch (error) {
    console.error('登出失败:', error);
    alert('登出失败: ' + (error instanceof Error ? error.message : '未知错误'));
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