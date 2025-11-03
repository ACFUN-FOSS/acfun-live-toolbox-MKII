<template>
  <div class="stats-page">
    <h2>事件统计</h2>

    <section class="controls">
      <label>
        房间ID
        <input v-model="roomId" placeholder="可选，留空统计全部房间" />
      </label>
      <button @click="loadStats" :disabled="loading">{{ loading ? '加载中…' : '刷新统计' }}</button>
    </section>

    <section class="historical">
      <h3>历史统计</h3>
      <div v-if="loading" class="placeholder">正在加载统计数据…</div>
      <div v-else>
        <div class="summary">
          <div>总事件：<strong>{{ hist.total }}</strong></div>
          <div>
            时间范围：
            <span v-if="hist.dateRange.earliest">{{ formatTs(hist.dateRange.earliest) }}</span>
            <span v-else>未知</span>
            -
            <span v-if="hist.dateRange.latest">{{ formatTs(hist.dateRange.latest) }}</span>
            <span v-else>未知</span>
          </div>
        </div>
        <ul class="type-bars">
          <li v-for="(count, type) in hist.byType" :key="type">
            <span class="type" :data-type="type">{{ type }}</span>
            <div class="bar"><div class="fill" :style="{ width: barWidth(count) + '%' }"></div></div>
            <span class="count">{{ count }}</span>
          </li>
        </ul>
      </div>
    </section>

    <section class="realtime">
      <h3>实时统计（最近5分钟）</h3>
      <div class="rt-summary">
        <div>过去60秒事件数：<strong>{{ eventsLastMinute }}</strong></div>
      </div>
      <ul class="epm-bars">
        <li v-for="(b, idx) in perMinuteBuckets" :key="idx">
          <span class="label">{{ b.label }}</span>
          <div class="bar"><div class="fill" :style="{ width: barWidthRT(b.count) + '%' }"></div></div>
          <span class="count">{{ b.count }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// 历史统计
const hist = ref<{ total: number; byType: Record<string, number>; dateRange: { earliest: number | null; latest: number | null } }>({
  total: 0,
  byType: {},
  dateRange: { earliest: null, latest: null }
});
const loading = ref(false);
const roomId = ref('');

// 动态端口探测（优先 18299，回退 1299）
const apiPort = ref<number | null>(null);
async function loadStats() {
  loading.value = true;
  try {
    // 使用 IPv4 回环地址，避免 localhost 解析为 ::1 导致拒绝连接
    const host = '127.0.0.1';
    const ports = [18299, 1299];
    let lastErr: any = null;
    for (const port of ports) {
      try {
        const url = new URL(`http://${host}:${port}/api/stats/events`);
        if (roomId.value && roomId.value.trim().length > 0) {
          url.searchParams.set('room_id', roomId.value.trim());
        }
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && data.success) {
          apiPort.value = port; // 记录成功端口，供 WebSocket 复用
          hist.value = {
            total: data.total || 0,
            byType: data.byType || {},
            dateRange: data.dateRange || { earliest: null, latest: null }
          };
          lastErr = null;
          break;
        }
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) {
      throw lastErr;
    }
  } catch (e) {
    console.error('加载统计失败:', e);
  } finally {
    loading.value = false;
  }
}

function formatTs(ts: number | null): string {
  if (!ts) return '未知';
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

const maxTypeCount = computed(() => {
  const vals = Object.values(hist.value.byType || {});
  return vals.length ? Math.max(...vals) : 0;
});
function barWidth(count: number): number {
  const max = maxTypeCount.value || 1;
  return Math.round((count / max) * 100);
}

// 实时统计：按分钟分桶（最近5分钟）
type RTEvent = { ts: number; event_type: string };
const rtEvents = ref<RTEvent[]>([]);
let ws: WebSocket | null = null;
let reconnectTimer: any = null;
let pruneTimer: any = null;
let wsPortIdx = 0; // 在 [18299, 1299] 间切换

function connectWs() {
  try {
    const host = '127.0.0.1';
    const ports = [18299, 1299];
    const port = apiPort.value ?? ports[wsPortIdx % ports.length];
    const url = `ws://${host}:${port}`;
    ws = new WebSocket(url);

    ws.onopen = () => { /* no-op */ };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!msg || !msg.op) return;
        if (msg.op === 'event' && msg.d) {
          const e = msg.d;
          rtEvents.value.push({ ts: e.ts || Date.now(), event_type: e.event_type });
        } else if (msg.op === 'ping') {
          ws?.send(JSON.stringify({ op: 'pong' }));
        }
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    };
    ws.onclose = () => { wsPortIdx++; scheduleReconnect(); };
    ws.onerror = () => { /* no-op */ };
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

function startPruneLoop() {
  pruneTimer = setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000; // 5分钟
    rtEvents.value = rtEvents.value.filter(e => e.ts >= cutoff);
  }, 3000);
}

const eventsLastMinute = computed(() => {
  const cutoff = Date.now() - 60 * 1000;
  return rtEvents.value.filter(e => e.ts >= cutoff).length;
});

const perMinuteBuckets = computed(() => {
  const now = Date.now();
  const buckets: { label: string; start: number; end: number; count: number }[] = [];
  for (let i = 4; i >= 0; i--) {
    const end = now - i * 60 * 1000;
    const start = end - 60 * 1000;
    const label = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    buckets.push({ label, start, end, count: 0 });
  }
  for (const e of rtEvents.value) {
    for (const b of buckets) {
      if (e.ts >= b.start && e.ts < b.end) {
        b.count++;
        break;
      }
    }
  }
  return buckets;
});

const maxRTCount = computed(() => {
  const vals = perMinuteBuckets.value.map(b => b.count);
  return vals.length ? Math.max(...vals) : 0;
});
function barWidthRT(count: number): number {
  const max = maxRTCount.value || 1;
  return Math.round((count / max) * 100);
}

onMounted(() => {
  loadStats();
  connectWs();
  startPruneLoop();
});

onUnmounted(() => {
  try { ws?.close(); } catch {}
  reconnectTimer && clearTimeout(reconnectTimer);
  pruneTimer && clearInterval(pruneTimer);
});
</script>

<style scoped>
.stats-page { margin-top: 8px; }
.controls { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.controls input { padding: 6px 8px; border: 1px solid var(--td-border-color); border-radius: var(--td-radius-medium); }
.controls button { padding: 6px 12px; }

.summary { display: flex; gap: 24px; margin: 8px 0 12px; }
.type-bars, .epm-bars { list-style: none; padding: 0; margin: 0; }
.type-bars li, .epm-bars li { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.bar { flex: 1; background: var(--td-bg-color-secondary); height: 16px; border-radius: var(--td-radius-medium); overflow: hidden; }
.fill { height: 100%; background: var(--td-brand-color); }
.label { width: 64px; color: var(--td-text-color-secondary); }
.type[data-type="danmaku"] { color: var(--td-brand-color); }
.type[data-type="gift"] { color: var(--td-warning-color); }
.type[data-type="like"] { color: var(--td-success-color); }
.type[data-type="follow"] { color: #8a2be2; }
.type[data-type="enter"] { color: #2f8f83; }
.type[data-type="system"] { color: var(--td-text-color-placeholder); }
.count { width: 48px; text-align: right; }
.placeholder { color: var(--td-text-color-placeholder); font-style: italic; }
</style>