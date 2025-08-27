<template>
  <div class="stream-monitoring-container">
    <t-card class="page-card">
      <div class="layout-row">
        <!-- 房间信息区域 -->
        <div class="room-info-section">
          <div class="cover-container">
            <img :src="roomInfo.coverUrl" alt="直播封面" class="room-cover" />
          </div>
          <div class="room-details">
            <t-marquee class="room-title" :scrollable="true">{{ roomInfo.title }}</t-marquee>
            <div class="room-category">
              <t-tag>{{ roomInfo.category }}</t-tag>
              <t-tag variant="outline">{{ roomInfo.subCategory }}</t-tag>
            </div>
            <div class="stream-duration">
              <t-icon name="clock-circle" /> 已播时长: {{ formatDuration(roomInfo.duration) }}
            </div>
          </div>
        </div>

        <!-- 数据统计区域 -->
        <div class="stats-section">
          <t-statistic-card class="stat-card" title="观众数" :value="stats.viewers" />
          <t-statistic-card class="stat-card" title="点赞数" :value="stats.likes" />
          <t-statistic-card class="stat-card" title="香蕉数" :value="stats.bananas" />
          <t-statistic-card class="stat-card" title="AC币" :value="stats.acCoins" />
        </div>
      </div>

      <!-- 状态监控区域 -->
      <div class="status-section">
        <t-descriptions title="推流状态监控" layout="horizontal" :column="3">
          <t-descriptions-item label="推流状态">
            <t-badge :status="streamStatus === 'live' ? 'success' : 'error'" :text="getStatusText(streamStatus)" />
          </t-descriptions-item>
          <t-descriptions-item label="连接状态">
            <t-badge :status="connectionStatus === 'connected' ? 'success' : 'error'" :text="getConnectionText(connectionStatus)" />
          </t-descriptions-item>
          <t-descriptions-item label="码率">
            {{ stats.bitrate }} kbps
          </t-descriptions-item>
        </t-descriptions>
      </div>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { TCard, TStatisticCard, TBadge, TDescriptions, TIcon, TTag, TMarquee } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';

interface RoomInfo {
  coverUrl: string;
  title: string;
  category: string;
  subCategory: string;
  duration: number;
}

interface StreamStats {
  viewers: number;
  likes: number;
  bananas: number;
  acCoins: number;
  bitrate: number;
}

// 房间信息状态
const roomInfo = ref<RoomInfo>({
  coverUrl: 'https://picsum.photos/400/225',
  title: '示例直播标题 - 这是一个较长的标题用于测试滚动效果',
  category: '游戏',
  subCategory: 'MOBA',
  duration: 12500
});

// 统计数据状态
const stats = ref<StreamStats>({
  viewers: 1280,
  likes: 5642,
  bananas: 328,
  acCoins: 1560,
  bitrate: 2500
});

// 推流状态 (live, offline, reconnecting)
const streamStatus = ref<'live' | 'offline' | 'reconnecting'>('live');

// 连接状态 (connected, disconnected, connecting)
const connectionStatus = ref<'connected' | 'disconnected' | 'connecting'>('connected');

// 格式化时长 (秒 -> HH:MM:SS)
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
};

// 获取推流状态文本
const getStatusText = (status: string): string => {
  const statusMap = {
    'live': '直播中',
    'offline': '已离线',
    'reconnecting': '重连中'
};
  return statusMap[status] || '未知';
};

// 获取连接状态文本
const getConnectionText = (status: string): string => {
  const connMap = {
    'connected': '已连接',
    'disconnected': '已断开',
    'connecting': '连接中'
};
  return connMap[status] || '未知';
};

// 模拟实时数据更新
onMounted(() => {
  const updateInterval = setInterval(() => {
    // 随机更新部分统计数据模拟实时变化
    stats.value.viewers = Math.max(1000, stats.value.viewers + Math.floor(Math.random() * 50) - 20);
    stats.value.likes += Math.floor(Math.random() * 10);
    stats.value.bitrate = Math.floor(Math.random() * 500) + 2000;
  }, 5000);

  // 组件卸载时清除定时器
  onUnmounted(() => clearInterval(updateInterval));
});
</script>

<style scoped>
.stream-monitoring-container {
 padding: 20px;
}

.layout-row {
 display: flex;
 gap: 20px;
 margin-bottom: 20px;
}

.room-info-section {
 flex: 1;
 display: flex;
 gap: 16px;
}

.cover-container {
 width: 200px;
 height: 112px;
 border-radius: var(--t-radius-small);
 overflow: hidden;
}

.room-cover {
 width: 100%;
 height: 100%;
 object-fit: cover;
}

.room-details {
 flex: 1;
 min-width: 0;
}

.room-title {
 font-size: 18px;
 font-weight: 600;
 margin-bottom: 8px;
 color: var(--t-color-text-primary);
}

.room-category {
 display: flex;
 gap: 8px;
 margin-bottom: 8px;
}

.stream-duration {
 color: var(--t-color-text-secondary);
 font-size: 14px;
 display: flex;
 align-items: center;
 gap: 4px;
}

.stats-section {
 flex: 1;
 display: grid;
 grid-template-columns: repeat(2, 1fr);
 gap: 16px;
}

.stat-card {
 height: 100%;
}

.status-section {
 margin-top: 20px;
}
</style>