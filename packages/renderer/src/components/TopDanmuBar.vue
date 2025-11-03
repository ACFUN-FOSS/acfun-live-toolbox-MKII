<template>
  <div class="top-danmu-bar">
    <div class="danmu-container">
      <div class="room-status">
        <span
          v-for="(status, roomId) in roomStatuses"
          :key="roomId"
          class="room-indicator"
        >
          <span class="room-id">{{ roomId }}</span>
          <span
            class="status-badge"
            :class="status"
          >{{ status }}</span>
        </span>
      </div>
      <div
        ref="scrollerRef"
        class="danmu-scroller"
      >
        <div
          class="danmu-track"
          :style="{ transform: `translateX(${scrollOffset}px)` }"
        >
          <div 
            v-for="danmu in visibleDanmus" 
            :key="danmu.id" 
            class="danmu-item"
            :style="{ color: danmu.color }"
          >
            <span
              class="room-tag"
              :style="{ backgroundColor: danmu.roomColor }"
            >{{ danmu.roomId }}</span>
            <span class="username">{{ danmu.username }}</span>
            <span class="content">{{ danmu.content }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface DanmuMessage {
  id: string;
  roomId: string;
  username: string;
  content: string;
  timestamp: number;
  receivedAt: number;
  source: string;
  eventType: string;
  userId?: string;
  color?: string;
  roomColor?: string;
  // AcFun特定的上下文信息
  userLevel?: number;
  userMedal?: {
    clubName: string;
    level: number;
    uperID: number;
  } | null;
  userManagerType?: number;
  userAvatar?: string;
  sessionId?: string;
  connectionDuration?: number;
}

const roomStatuses = ref<Record<string, string>>({});
const danmuQueue = ref<DanmuMessage[]>([]);
const visibleDanmus = ref<DanmuMessage[]>([]);
const scrollOffset = ref(0);
const scrollerRef = ref<HTMLElement>();

let ws: WebSocket | null = null;
let reconnectTimer: any = null;
let wsPortIdx = 0;
let animationId: number | null = null;

// 房间颜色映射
const roomColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
const getRoomColor = (roomId: string) => {
  const index = parseInt(roomId) % roomColors.length;
  return roomColors[index];
};

function connectWs() {
  try {
    const host = '127.0.0.1';
    const ports = [18299, 1299];
    const port = ports[wsPortIdx % ports.length];
    const url = `ws://${host}:${port}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      // WebSocket connected successfully
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!msg || !msg.op) return;
        
        switch (msg.op) {
          case 'ping':
            ws?.send(JSON.stringify({ op: 'pong' }));
            break;
          case 'event':
            if (msg.d && msg.d.event_type === 'danmaku') {
              addDanmu(msg.d);
            }
            break;
          case 'room_status':
            const d = msg.d || {};
            if (d.room_id && d.status) {
              roomStatuses.value[d.room_id] = d.status;
            }
            break;
        }
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    };

    ws.onclose = () => {
      wsPortIdx++;
      scheduleReconnect();
    };

    ws.onerror = () => {
      console.error('WebSocket error');
    };
  } catch (e) {
    console.error('WS connect error:', e);
    wsPortIdx++;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWs();
  }, 2000);
}

function addDanmu(eventData: any) {
  // 从NormalizedEvent中提取上下文信息
  const rawContext = eventData.raw?._context || {};
  
  const danmu: DanmuMessage = {
    id: `${eventData.room_id || eventData.roomId}_${eventData.ts || Date.now()}_${Math.random()}`,
    roomId: eventData.room_id || eventData.roomId || 'unknown',
    username: eventData.user_name || eventData.username || '匿名',
    content: eventData.content || '',
    timestamp: eventData.ts || Date.now(),
    receivedAt: eventData.received_at || Date.now(),
    source: eventData.source || 'unknown',
    eventType: eventData.event_type || 'danmaku',
    userId: eventData.user_id,
    roomColor: getRoomColor(eventData.room_id || eventData.roomId),
    // AcFun特定的上下文信息
    userLevel: rawContext.userLevel,
    userMedal: rawContext.userMedal,
    userManagerType: rawContext.userManagerType,
    userAvatar: rawContext.userAvatar,
    sessionId: rawContext.sessionId,
    connectionDuration: rawContext.connectionDuration
  };

  danmuQueue.value.push(danmu);
  
  // 限制队列长度
  if (danmuQueue.value.length > 50) {
    danmuQueue.value.shift();
  }

  // 更新可见弹幕
  updateVisibleDanmus();
}

function updateVisibleDanmus() {
  // 取最新的10条弹幕进行显示
  visibleDanmus.value = danmuQueue.value.slice(-10);
}

function startScrollAnimation() {
  const animate = () => {
    scrollOffset.value -= 1; // 向左滚动
    
    // 如果滚动超出容器宽度，重置位置
    if (scrollerRef.value) {
      const containerWidth = scrollerRef.value.offsetWidth;
      if (scrollOffset.value < -containerWidth) {
        scrollOffset.value = containerWidth;
      }
    }
    
    animationId = requestAnimationFrame(animate);
  };
  
  animationId = requestAnimationFrame(animate);
}

onMounted(() => {
  connectWs();
  startScrollAnimation();
});

onUnmounted(() => {
  if (ws) {
    ws.close();
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});
</script>

<style scoped>
.top-danmu-bar {
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-bottom: 1px solid var(--td-border-color);
  overflow: hidden;
  position: relative;
}

.danmu-container {
  display: flex;
  height: 100%;
  align-items: center;
  padding: 0 16px;
}

.room-status {
  display: flex;
  gap: 8px;
  margin-right: 16px;
  flex-shrink: 0;
}

.room-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.room-id {
  color: white;
  font-weight: 500;
}

.status-badge {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
}

.status-badge.connected {
  background: #52c41a;
  color: white;
}

.status-badge.connecting {
  background: #faad14;
  color: white;
}

.status-badge.disconnected {
  background: #ff4d4f;
  color: white;
}

.danmu-scroller {
  flex: 1;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.danmu-track {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 24px;
  white-space: nowrap;
  transition: transform 0.1s linear;
}

.danmu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.9);
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.room-tag {
  padding: 2px 6px;
  border-radius: 8px;
  color: white;
  font-size: 10px;
  font-weight: 500;
}

.username {
  color: #666;
  font-weight: 500;
}

.content {
  color: #333;
}
</style>