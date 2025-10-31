<template>
  <div class="home-page">
    <section class="status-panel">
      <h2>房间状态</h2>
      <div v-if="Object.keys(roomStatuses).length === 0" class="placeholder">等待房间连接与状态广播…</div>
      <ul v-else class="status-list">
        <li v-for="(status, roomId) in roomStatuses" :key="roomId">
          <span class="room">房间 {{ roomId }}</span>
          <span class="badge" :data-status="status">{{ status }}</span>
        </li>
      </ul>
    </section>

    <EventFilterBar v-model="activeTypes" />
    <EventFeed :events="filteredEvents" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import EventFeed from '../components/EventFeed.vue';
import EventFilterBar from '../components/EventFilterBar.vue';

const events = ref<any[]>([]);
const activeTypes = ref<string[]>(['danmaku','gift','follow','like','enter','system']);
const filteredEvents = computed(() => {
  const set = new Set(activeTypes.value);
  return events.value.filter((ev) => set.has(ev.event_type));
});
const roomStatuses = ref<Record<string, string>>({});

let ws: WebSocket | null = null;
let reconnectTimer: any = null;
let wsPortIdx = 0; // 在 [18299, 1299] 间轮询尝试

function connectWs() {
  try {
    // 优先使用 IPv4 回环地址，避免 localhost 在部分系统解析为 ::1 导致连接被拒绝
    const host = '127.0.0.1';
    const ports = [18299, 1299];
    const port = ports[wsPortIdx % ports.length];
    const url = `ws://${host}:${port}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      // no-op
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
            events.value.unshift(msg.d);
            if (events.value.length > 100) events.value.pop();
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
      wsPortIdx++; // 下次尝试下一个端口
      scheduleReconnect();
    };

    ws.onerror = () => {
      // no-op
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


onMounted(() => {
  connectWs();
});

onUnmounted(() => {
  try { ws?.close(); } catch {}
  reconnectTimer && clearTimeout(reconnectTimer);
});
</script>

<style scoped>
.status-panel, .events-panel {
  margin-top: 16px;
}
.status-list, .events-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.status-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed var(--td-border-color-light);
}
.badge {
  padding: 2px 8px;
  border-radius: var(--td-radius-full);
  background: var(--td-bg-color-secondary);
  font-size: 12px;
}
.event-item { padding: 8px 0; border-bottom: 1px dashed var(--td-border-color-light); }
.meta { display: flex; gap: 12px; font-size: 12px; color: var(--td-text-color-secondary); }
.type[data-type="danmaku"] { color: var(--td-brand-color); }
.type[data-type="gift"] { color: var(--td-warning-color); }
.type[data-type="like"] { color: var(--td-success-color); }
.type[data-type="follow"] { color: #8a2be2; }
.type[data-type="enter"] { color: #2f8f83; }
.type[data-type="system"] { color: var(--td-text-color-placeholder); }
.content { margin-top: 4px; }
.placeholder { color: var(--td-text-color-placeholder); font-style: italic; }
</style>