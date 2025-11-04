<template>
  <div class="live-danmu-page">
    <div class="page-header">
      <h2>弹幕管理</h2>
      <div class="header-actions">
        <t-select 
          v-model="selectedRoomId" 
          placeholder="选择房间"
          style="width: 200px;"
          @change="switchRoom"
        >
          <t-option 
            v-for="room in roomStore.liveRooms" 
            :key="room.liveId"
            :value="room.liveId"
            :label="`${room.streamer?.userName} (${room.liveId})`"
          />
        </t-select>
        <t-button
          variant="outline"
          @click="clearDanmu"
        >
          <t-icon name="delete" />
          清空弹幕
        </t-button>
        <t-button
          variant="outline"
          @click="exportDanmu"
        >
          <t-icon name="download" />
          导出
        </t-button>
      </div>
    </div>

    <!-- 弹幕统计 -->
    <div class="danmu-stats">
      <t-card
        class="stat-card"
        hover-shadow
      >
        <div class="stat-content">
          <div class="stat-number">
            {{ danmuList.length }}
          </div>
          <div class="stat-label">
            总弹幕数
          </div>
        </div>
      </t-card>
      <t-card
        class="stat-card"
        hover-shadow
      >
        <div class="stat-content">
          <div class="stat-number">
            {{ commentCount }}
          </div>
          <div class="stat-label">
            评论
          </div>
        </div>
      </t-card>
      <t-card
        class="stat-card"
        hover-shadow
      >
        <div class="stat-content">
          <div class="stat-number">
            {{ giftCount }}
          </div>
          <div class="stat-label">
            礼物
          </div>
        </div>
      </t-card>
      <t-card
        class="stat-card"
        hover-shadow
      >
        <div class="stat-content">
          <div class="stat-number">
            {{ likeCount }}
          </div>
          <div class="stat-label">
            点赞
          </div>
        </div>
      </t-card>
    </div>

    <!-- 弹幕过滤器 -->
    <t-card
      class="filter-card"
      title="弹幕过滤"
      hover-shadow
    >
      <div class="filter-controls">
        <div class="filter-group">
          <label>事件类型:</label>
          <t-checkbox-group v-model="activeFilters">
            <t-checkbox value="comment">
              评论
            </t-checkbox>
            <t-checkbox value="gift">
              礼物
            </t-checkbox>
            <t-checkbox value="like">
              点赞
            </t-checkbox>
            <t-checkbox value="enter_room">
              进入
            </t-checkbox>
            <t-checkbox value="follow">
              关注
            </t-checkbox>
            <t-checkbox value="system">
              系统
            </t-checkbox>
          </t-checkbox-group>
        </div>
        
        <div class="filter-group">
          <label>关键词过滤:</label>
          <t-input 
            v-model="keywordFilter" 
            placeholder="输入关键词..." 
            clearable
            style="width: 200px;"
          />
        </div>
        
        <div class="filter-group">
          <label>用户过滤:</label>
          <t-input 
            v-model="userFilter" 
            placeholder="输入用户名..." 
            clearable
            style="width: 200px;"
          />
        </div>
        
        <div class="filter-group">
          <label>自动滚动:</label>
          <t-switch v-model="autoScroll" />
        </div>
      </div>
    </t-card>

    <!-- 弹幕列表 -->
    <t-card
      class="danmu-list-card"
      title="弹幕列表"
      hover-shadow
    >
      <template #actions>
        <span class="danmu-count">{{ filteredDanmu.length }} 条弹幕</span>
      </template>

      <div
        v-if="!selectedRoomId"
        class="empty-state"
      >
        <t-icon
          name="chat"
          size="48px"
        />
        <p>请先选择一个房间</p>
      </div>

      <div
        v-else-if="filteredDanmu.length === 0"
        class="empty-state"
      >
        <t-icon
          name="chat"
          size="48px"
        />
        <p>暂无弹幕数据</p>
      </div>

      <div
        v-else
        ref="danmuListRef"
        class="danmu-list"
      >
        <div 
          v-for="danmu in filteredDanmu" 
          :key="danmu.id"
          class="danmu-item"
          :class="`danmu-${danmu.type}`"
        >
          <div class="danmu-time">
            {{ formatTime(danmu.timestamp) }}
          </div>
          <div class="danmu-content">
            <component 
              :is="getDanmuComponent(danmu.type)" 
              :event="danmu"
            />
          </div>
          <div class="danmu-actions">
            <t-button
              size="small"
              variant="text"
              @click="copyDanmu(danmu)"
            >
              <t-icon name="copy" />
            </t-button>
            <t-button
              size="small"
              variant="text"
              theme="danger"
              @click="deleteDanmu(danmu)"
            >
              <t-icon name="delete" />
            </t-button>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 弹幕详情对话框 -->
    <t-dialog 
      v-model:visible="showDetailsDialog" 
      title="弹幕详情"
      width="500px"
    >
      <div
        v-if="selectedDanmu"
        class="danmu-details"
      >
        <div class="detail-item">
          <span class="label">时间:</span>
          <span class="value">{{ formatDetailTime(selectedDanmu.timestamp) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">类型:</span>
          <span class="value">{{ getDanmuTypeText(selectedDanmu.type) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">用户:</span>
          <span class="value">{{ selectedDanmu.userName || '未知用户' }}</span>
        </div>
        <div class="detail-item">
          <span class="label">用户ID:</span>
          <span class="value">{{ selectedDanmu.userId || '未知' }}</span>
        </div>
        <div
          v-if="selectedDanmu.content"
          class="detail-item"
        >
          <span class="label">内容:</span>
          <span class="value">{{ selectedDanmu.content }}</span>
        </div>
        <div class="detail-item">
          <span class="label">原始数据:</span>
          <pre class="raw-data">{{ JSON.stringify(selectedDanmu, null, 2) }}</pre>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useRoomStore } from '../stores/room';

// 弹幕组件
import CommentEvent from '../components/events/CommentEvent.vue';
import GiftEvent from '../components/events/GiftEvent.vue';
import LikeEvent from '../components/events/LikeEvent.vue';
import SystemEvent from '../components/events/SystemEvent.vue';

const route = useRoute();
const roomStore = useRoomStore();

// 响应式状态
const selectedRoomId = ref<string>('');
const danmuList = ref<any[]>([]);
const danmuListRef = ref<HTMLElement>();
const showDetailsDialog = ref(false);
const selectedDanmu = ref<any>(null);

// 过滤器状态
const activeFilters = ref<string[]>(['comment', 'gift', 'like', 'enter_room', 'follow', 'system']);
const keywordFilter = ref('');
const userFilter = ref('');
const autoScroll = ref(true);

// WebSocket 连接
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

// 计算属性
const filteredDanmu = computed(() => {
  let filtered = danmuList.value;

  // 类型过滤
  if (activeFilters.value.length > 0) {
    filtered = filtered.filter(danmu => activeFilters.value.includes(danmu.type));
  }

  // 关键词过滤
  if (keywordFilter.value) {
    const keyword = keywordFilter.value.toLowerCase();
    filtered = filtered.filter(danmu => 
      danmu.content?.toLowerCase().includes(keyword) ||
      danmu.userName?.toLowerCase().includes(keyword)
    );
  }

  // 用户过滤
  if (userFilter.value) {
    const user = userFilter.value.toLowerCase();
    filtered = filtered.filter(danmu => 
      danmu.userName?.toLowerCase().includes(user)
    );
  }

  return filtered.slice().reverse(); // 最新的在前面
});

const commentCount = computed(() => 
  danmuList.value.filter(d => d.type === 'comment').length
);

const giftCount = computed(() => 
  danmuList.value.filter(d => d.type === 'gift').length
);

const likeCount = computed(() => 
  danmuList.value.filter(d => d.type === 'like').length
);

// 方法
const switchRoom = (roomId: string) => {
  selectedRoomId.value = roomId;
  danmuList.value = [];
  connectWebSocket();
};

const connectWebSocket = () => {
  if (ws) {
    ws.close();
  }

  if (!selectedRoomId.value) return;

  const ports = [8080, 8081, 8082];
  let currentPortIndex = 0;

  const tryConnect = () => {
    const port = ports[currentPortIndex];
    ws = new WebSocket(`ws://localhost:${port}/ws`);

    ws.onopen = () => {
      console.log(`WebSocket connected on port ${port}`);
      // 订阅特定房间的弹幕
      ws?.send(JSON.stringify({
        type: 'subscribe',
        roomId: selectedRoomId.value
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'danmu' && data.roomId === selectedRoomId.value) {
          handleDanmu(data.data);
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      currentPortIndex = (currentPortIndex + 1) % ports.length;
      scheduleReconnect();
    };
  };

  tryConnect();
};

const scheduleReconnect = () => {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, 2000);
};

const handleDanmu = (danmuData: any) => {
  const danmu = {
    id: danmuData.id || `${Date.now()}_${Math.random()}`,
    type: danmuData.event_type || danmuData.type || 'system',
    timestamp: danmuData.timestamp || Date.now(),
    userId: danmuData.user_id || danmuData.userId || '',
    userName: danmuData.user_name || danmuData.userName || '',
    content: danmuData.content || danmuData.message || '',
    ...danmuData
  };

  danmuList.value.push(danmu);
  // 更新房间活动时间
  if (selectedRoomId.value) {
    roomStore.touchRoomActivity(selectedRoomId.value, danmu.timestamp);
  }
  
  // 限制弹幕数量
  if (danmuList.value.length > 1000) {
    danmuList.value.splice(0, 100);
  }

  // 自动滚动
  if (autoScroll.value) {
    nextTick(() => {
      if (danmuListRef.value) {
        danmuListRef.value.scrollTop = danmuListRef.value.scrollHeight;
      }
    });
  }
};

const clearDanmu = () => {
  danmuList.value = [];
};

const exportDanmu = () => {
  const data = JSON.stringify(danmuList.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `danmu_${selectedRoomId.value}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const copyDanmu = (danmu: any) => {
  const text = danmu.content || JSON.stringify(danmu);
  navigator.clipboard.writeText(text);
  // TODO: 显示成功提示
};

const deleteDanmu = (danmu: any) => {
  const index = danmuList.value.findIndex(d => d.id === danmu.id);
  if (index > -1) {
    danmuList.value.splice(index, 1);
  }
};

const getDanmuComponent = (type: string) => {
  switch (type) {
    case 'comment':
      return CommentEvent;
    case 'gift':
      return GiftEvent;
    case 'like':
      return LikeEvent;
    default:
      return SystemEvent;
  }
};

const getDanmuTypeText = (type: string) => {
  switch (type) {
    case 'comment': return '评论';
    case 'gift': return '礼物';
    case 'like': return '点赞';
    case 'enter_room': return '进入房间';
    case 'follow': return '关注';
    case 'system': return '系统消息';
    default: return '未知';
  }
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};

const formatDetailTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
};

// 监听路由参数
watch(() => route.params.roomId, (roomId) => {
  if (roomId && typeof roomId === 'string') {
    selectedRoomId.value = roomId;
    switchRoom(roomId);
  }
}, { immediate: true });

// 生命周期
onMounted(() => {
  roomStore.loadRooms();
  
  // 如果没有从路由获取房间ID，选择第一个在线房间
  if (!selectedRoomId.value && roomStore.liveRooms.length > 0) {
    selectedRoomId.value = roomStore.liveRooms[0].liveId;
    switchRoom(selectedRoomId.value);
  }
});

onUnmounted(() => {
  if (ws) {
    ws.close();
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
});
</script>

<style scoped>
.live-danmu-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  margin: 0;
  color: var(--td-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.danmu-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  min-height: 80px;
}

.stat-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60px;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: var(--td-brand-color);
}

.stat-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-top: 4px;
}

.filter-card {
  flex-shrink: 0;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  white-space: nowrap;
}

.danmu-list-card {
  flex: 1;
  min-height: 0;
}

.danmu-count {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--td-text-color-secondary);
}

.empty-state p {
  margin-top: 16px;
}

.danmu-list {
  max-height: 500px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.danmu-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px;
  border-radius: 4px;
  background-color: var(--td-bg-color-container);
  transition: background-color 0.2s;
}

.danmu-item:hover {
  background-color: var(--td-bg-color-container-hover);
}

.danmu-time {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  white-space: nowrap;
  min-width: 80px;
  margin-top: 2px;
}

.danmu-content {
  flex: 1;
  min-width: 0;
}

.danmu-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.danmu-item:hover .danmu-actions {
  opacity: 1;
}

.danmu-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.detail-item .label {
  font-weight: 500;
  color: var(--td-text-color-secondary);
  min-width: 80px;
}

.detail-item .value {
  color: var(--td-text-color-primary);
  word-break: break-all;
}

.raw-data {
  background-color: var(--td-bg-color-container);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 弹幕类型样式 */
.danmu-comment {
  border-left: 3px solid var(--td-brand-color);
}

.danmu-gift {
  border-left: 3px solid var(--td-warning-color);
}

.danmu-like {
  border-left: 3px solid var(--td-error-color);
}

.danmu-system {
  border-left: 3px solid var(--td-gray-color-6);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .danmu-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .filter-controls {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .danmu-stats {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .danmu-item {
    flex-direction: column;
    gap: 8px;
  }
  
  .danmu-actions {
    opacity: 1;
    align-self: flex-end;
  }
}
</style>