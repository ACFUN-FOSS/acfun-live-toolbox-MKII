<template>
  <div class="dashboard-container">
    <!-- 欢迎信息区域 -->
    <div class="welcome-section">
      <div class="welcome-content">
        <h1 class="welcome-title">
          欢迎回来，{{ username }}！
          <span class="welcome-time">{{ greetingTime }}</span>
        </h1>
        <p class="welcome-desc">今天是 {{ currentDate }}，祝您直播顺利！</p>
      </div>
      <div class="welcome-bg"></div>
    </div>

    <!-- 核心数据概览 -->
    <div class="data-overview">
      <h2 class="section-title">核心数据概览</h2>
      <div class="data-cards">
        <!-- 观众人数卡片 -->
        <t-card class="data-card" hover shadow>
          <div class="data-card-content">
            <div class="data-info">
              <p class="data-label">当前观众</p>
              <h3 class="data-value">{{ viewerCount }}</h3>
              <p class="data-change"><t-icon name="trending-up" class="trend-icon" /> {{ viewerChange }}%</p>
            </div>
            <div class="data-icon">
              <t-icon name="user-group" size="48" />
            </div>
          </div>
        </t-card>

        <!-- 礼物收入卡片 -->
        <t-card class="data-card" hover shadow>
          <div class="data-card-content">
            <div class="data-info">
              <p class="data-label">礼物收入</p>
              <h3 class="data-value">{{ giftAmount }} 元</h3>
              <p class="data-change"><t-icon name="trending-up" class="trend-icon" /> {{ giftChange }}%</p>
            </div>
            <div class="data-icon">
              <t-icon name="gift" size="48" />
            </div>
          </div>
        </t-card>

        <!-- 弹幕数量卡片 -->
        <t-card class="data-card" hover shadow>
          <div class="data-card-content">
            <div class="data-info">
              <p class="data-label">弹幕数量</p>
              <h3 class="data-value">{{ danmakuCount }}</h3>
              <p class="data-change"><t-icon name="trending-down" class="trend-icon down" /> {{ danmakuChange }}%</p>
            </div>
            <div class="data-icon">
              <t-icon name="message" size="48" />
            </div>
          </div>
        </t-card>

        <!-- 直播时长卡片 -->
        <t-card class="data-card" hover shadow>
          <div class="data-card-content">
            <div class="data-info">
              <p class="data-label">直播时长</p>
              <h3 class="data-value">{{ liveDuration }}</h3>
              <p class="data-change">今日已直播 {{ todayLiveDuration }}</p>
            </div>
            <div class="data-icon">
              <t-icon name="clock" size="48" />
            </div>
          </div>
        </t-card>
      </div>
    </div>

    <!-- 背景视觉效果 -->
    <div class="background-effect"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Card, Icon } from 'tdesign-vue-next';
import { UserGroup, Gift, Message, Clock, TrendingUp, TrendingDown } from '@tdesign/icons-vue-next';
import { ipcRenderer } from 'electron';

// 组件注册
const UserGroupIcon = UserGroup;
const GiftIcon = Gift;
const MessageIcon = Message;
const ClockIcon = Clock;
const TrendingUpIcon = TrendingUp;
const TrendingDownIcon = TrendingDown;

// 状态管理
const username = ref('主播');
const greetingTime = ref('');
const currentDate = ref('');
const viewerCount = ref('0');
const viewerChange = ref('0');
const giftAmount = ref('0');
giftChange = ref('0');
const danmakuCount = ref('0');
const danmakuChange = ref('0');
const liveDuration = ref('00:00:00');
const todayLiveDuration = ref('00:00:00');

// 计算当前时间段问候语
const getGreetingTime = () => {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了';
};

// 格式化当前日期
const formatDate = () => {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  };
  return date.toLocaleDateString('zh-CN', options);
};

// 获取用户信息
const getUserInfo = async () => {
  try {
    const session = JSON.parse(localStorage.getItem('session') || sessionStorage.getItem('session') || '{}');
    if (session.username) {
      username.value = session.username;
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
};

// 获取核心数据
const fetchCoreData = async () => {
  try {
    // 模拟数据请求，实际项目中应替换为真实API调用
    const data = await ipcRenderer.invoke('getDashboardData');
    viewerCount.value = data.viewerCount || '0';
    viewerChange.value = data.viewerChange || '0';
    giftAmount.value = data.giftAmount || '0';
    giftChange.value = data.giftChange || '0';
    danmakuCount.value = data.danmakuCount || '0';
    danmakuChange.value = data.danmakuChange || '0';
    liveDuration.value = data.liveDuration || '00:00:00';
    todayLiveDuration.value = data.todayLiveDuration || '00:00:00';
  } catch (error) {
    console.error('获取核心数据失败:', error);
  }
};

// 初始化
onMounted(async () => {
  greetingTime.value = getGreetingTime();
  currentDate.value = formatDate();
  await getUserInfo();
  await fetchCoreData();

  // 定时刷新数据
  const interval = setInterval(fetchCoreData, 5000);
  // 组件卸载时清除定时器
  onUnmounted(() => clearInterval(interval));
});
</script>

<style scoped>
.dashboard-container {
  position: relative;
  min-height: 100vh;
  padding: 20px;
}

/* 欢迎信息区域 */
.welcome-section {
  position: relative;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 30px;
}

.welcome-content {
  position: relative;
  z-index: 1;
  padding: 40px 30px;
  color: #fff;
}

.welcome-title {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.welcome-time {
  font-size: 16px;
  font-weight: normal;
  margin-left: 15px;
  opacity: 0.9;
}

.welcome-desc {
  font-size: 16px;
  opacity: 0.9;
}

.welcome-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #165DFF 0%, #0E42D2 100%);
  z-index: 0;
}

/* 数据概览区域 */
.data-overview {
  margin-bottom: 30px;
}

.section-title {
  font-size: 18px;
  margin-bottom: 16px;
  color: #1D2129;
  font-weight: 600;
}

.data-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.data-card {
  height: 100%;
  transition: transform 0.3s ease;
}

.data-card:hover {
  transform: translateY(-5px);
}

.data-card-content {
  display: flex;
  align-items: center;
  padding: 20px;
}

.data-info {
  flex: 1;
}

.data-label {
  font-size: 14px;
  color: #6B7280;
  margin-bottom: 4px;
}

.data-value {
  font-size: 28px;
  font-weight: 600;
  color: #1D2129;
  margin-bottom: 4px;
}

.data-change {
  font-size: 14px;
  display: flex;
  align-items: center;
}

.trend-icon {
  margin-right: 4px;
  font-size: 14px;
}

.trend-icon.down {
  color: #F53F3F;
}

.data-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #F0F5FF;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #165DFF;
}

/* 背景视觉效果 */
.background-effect {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(22,93,255,0.05) 0%, rgba(255,255,255,0) 70%);
  z-index: -1;
  pointer-events: none;
}
</style>