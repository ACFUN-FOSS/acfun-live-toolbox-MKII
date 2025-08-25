<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Card, Statistic, Row, Col, Avatar } from 'tdesign-vue-next';

// 房间信息
const roomInfo = ref<{
  cover: string,
  title: string,
  category: string,
  subCategory: string,
  duration: string
}>({
  cover: 'https://picsum.photos/300/200',
  title: '未设置标题',
  category: '未分类',
  subCategory: '未分类',
  duration: '00:00:00'
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

// 推流状态
const streamStatus = ref<{
  isLive: boolean,
  statusText: string,
  bitrate: string,
  fps: number
}>({
  isLive: false,
  statusText: '未开播',
  bitrate: '0 Kbps',
  fps: 0
});

// 模拟更新数据
let updateInterval: number;

// 页面加载时获取数据
onMounted(() => {
  // 模拟从API获取初始数据
  setTimeout(() => {
    roomInfo.value = {
      cover: 'https://picsum.photos/300/200',
      title: 'ACFUN直播工具箱演示',
      category: '科技',
      subCategory: '软件应用',
      duration: '00:25:36'
    };

    statsData.value = {
      viewerCount: 1280,
      likeCount: 56800,
      bananaCount: 12500,
      acCoinCount: 8960
    };

    streamStatus.value = {
      isLive: true,
      statusText: '直播中',
      bitrate: '3500 Kbps',
      fps: 30
    };

    // 模拟实时数据更新
    updateInterval = window.setInterval(() => {
      statsData.value.viewerCount = Math.floor(statsData.value.viewerCount * (0.99 + Math.random() * 0.02));
      statsData.value.likeCount += Math.floor(Math.random() * 10);
      statsData.value.bananaCount += Math.floor(Math.random() * 3);
      statsData.value.acCoinCount += Math.floor(Math.random() * 2);
    }, 5000);
  }, 1000);
});

// 页面卸载时清除定时器
onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>

<template>
  <div class="stream-monitor-container">
    <h1 class="page-title">直播监控</h1>

    <!-- 房间信息区域 -->
    <Card class="room-info-card">
      <div class="room-info-content">
        <div class="cover-container">
          <img :src="roomInfo.cover" alt="房间封面" class="room-cover">
          <div class="live-badge" v-if="streamStatus.isLive">
            <div class="live-dot"></div>
            <span class="live-text">{{ streamStatus.statusText }}</span>
          </div>
        </div>
        <div class="info-container">
          <h2 class="room-title">{{ roomInfo.title }}</h2>
          <div class="room-category">
            {{ roomInfo.category }} > {{ roomInfo.subCategory }}
          </div>
          <div class="room-stats">
            <div class="stat-item">
              <span class="stat-label">已播时长:</span>
              <span class="stat-value">{{ roomInfo.duration }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">比特率:</span>
              <span class="stat-value">{{ streamStatus.bitrate }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">帧率:</span>
              <span class="stat-value">{{ streamStatus.fps }} FPS</span>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- 数据统计区域 -->
    <Row gutter="20" class="stats-row">
      <Col span="6">
        <Card class="stats-card">
          <Statistic
            title="观众数"
            :value="statsData.viewerCount"
            :value-style="{ color: '#1890ff' }"
          />
        </Card>
      </Col>
      <Col span="6">
        <Card class="stats-card">
          <Statistic
            title="点赞数"
            :value="statsData.likeCount"
            :value-style="{ color: '#f7ba1e' }"
            format="{value.toLocaleString()}"
          />
        </Card>
      </Col>
      <Col span="6">
        <Card class="stats-card">
          <Statistic
            title="香蕉数"
            :value="statsData.bananaCount"
            :value-style="{ color: '#722ed1' }"
            format="{value.toLocaleString()}"
          />
        </Card>
      </Col>
      <Col span="6">
        <Card class="stats-card">
          <Statistic
            title="AC币"
            :value="statsData.acCoinCount"
            :value-style="{ color: '#f5222d' }"
            format="{value.toLocaleString()}"
          />
        </Card>
      </Col>
    </Row>

    <!-- 更多数据区域 -->
    <Card class="more-data-card">
      <h2 class="section-title">更多数据统计</h2>
      <div class="chart-container">
        <!-- 这里应该是图表组件，暂时用占位符表示 -->
        <div class="chart-placeholder">
          <p>观众增长趋势图表</p>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.stream-monitor-container {
  padding: 20px;
  background-color: #0f172a; /* 页面背景色 - UI规范 */
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 30px;
  color: #f8fafc; /* 主要文本色 - UI规范 */
}

.room-info-card {
  margin-bottom: 20px;
}

.room-info-content {
  display: flex;
}

.cover-container {
  position: relative;
  width: 300px;
  height: 200px;
  margin-right: 20px;
}

.room-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px; /* 统一圆角 - UI规范 */
}

.live-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  background-color: #52c41a; /* 在线/成功状态色 - UI规范 */
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.live-dot {
  width: 8px;
  height: 8px;
  background-color: #fff;
  border-radius: 50%;
  margin-right: 5px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.live-text {
  font-weight: bold;
}

.info-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
.room-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #f8fafc; /* 主要文本色 - UI规范 */
} white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-category {
  color: #cbd5e1; /* 次要文本色 - UI规范 */
  margin-bottom: 15px;
}

.room-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 12px;
  color: #cbd5e1; /*次要文本色 - UI规范 */
  margin-bottom:4px;
}

.stat-value {
  font-size: 14px;
 font-weight: bold;
 color: #f8fafc; /* 主要文本色 - UI规范 */
}

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.more-data-card {
  height: 300px;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #f8fafc; /* 主要文本色 - UI规范 */
}

.chart-container {
  height: calc(100% - 40px);
  display: flex;
  justify-content: center;
  align-items: center;
}

.chart-placeholder {
 width: 100%;
 height:100%;
 display: flex;
 justify-content: center;
 align-items: center;
 background-color: #1e293b; /* 卡片背景色 - UI规范 */
 border-radius:4px; /* 统一圆角 - UI规范 */
 color: #cbd5e1; /* 次要文本色 - UI规范 */
}
</style>