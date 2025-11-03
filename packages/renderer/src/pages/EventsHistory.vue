<template>
  <div class="events-history-page">
    <h2>事件历史与回放</h2>
    <section class="filters">
      <div class="row">
        <label>房间ID：</label>
        <input
          v-model="roomId"
          class="input"
          placeholder="如：12345"
        >
        <label>用户ID：</label>
        <input
          v-model="userId"
          class="input"
          placeholder="可选"
        >
        <label>类型：</label>
        <select
          v-model="type"
          class="input"
        >
          <option value="">
            全部
          </option>
          <option
            v-for="t in allTypes"
            :key="t"
            :value="t"
          >
            {{ t }}
          </option>
        </select>
      </div>
      <div class="row">
        <label>开始时间：</label>
        <input
          v-model="fromStr"
          class="input"
          type="datetime-local"
        >
        <label>结束时间：</label>
        <input
          v-model="toStr"
          class="input"
          type="datetime-local"
        >
        <label>搜索：</label>
        <input
          v-model="q"
          class="input"
          placeholder="在用户名/内容/raw中模糊搜索"
        >
        <button
          class="btn"
          @click="fetchEvents"
        >
          查询
        </button>
      </div>
      <div class="row meta">
        <span>结果：{{ total }} 条，页 {{ page }} / {{ totalPages }}</span>
        <button
          class="btn"
          :disabled="page<=1"
          @click="prevPage"
        >
          上一页
        </button>
        <button
          class="btn"
          :disabled="!hasNext"
          @click="nextPage"
        >
          下一页
        </button>
      </div>
    </section>

    <section class="results">
      <h3>查询结果（最多 {{ pageSize }} 条/页）</h3>
      <EventFeed :events="items" />
    </section>

    <section class="replay">
      <h3>回放控制</h3>
      <div class="row">
        <button
          class="btn"
          :disabled="playing || items.length===0"
          @click="startReplay"
        >
          开始回放
        </button>
        <button
          class="btn"
          :disabled="!playing"
          @click="pauseReplay"
        >
          暂停
        </button>
        <button
          class="btn"
          :disabled="playing || replayIndex>=items.length"
          @click="resumeReplay"
        >
          继续
        </button>
        <button
          class="btn"
          :disabled="!replayEvents.length"
          @click="resetReplay"
        >
          清空回放输出
        </button>
        <label>速度：</label>
        <select
          v-model.number="speed"
          class="input"
        >
          <option :value="0.5">
            0.5x
          </option>
          <option :value="1">
            1x
          </option>
          <option :value="2">
            2x
          </option>
          <option :value="4">
            4x
          </option>
        </select>
      </div>
      <div class="row meta">
        <span>进度：{{ replayIndex }} / {{ items.length }}</span>
      </div>
      <EventFeed :events="replayEvents" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import EventFeed from '../components/EventFeed.vue';

const allTypes = ['danmaku','gift','follow','like','enter','system'];

// 查询参数
const roomId = ref<string>('');
const userId = ref<string>('');
const type = ref<string>('');
const fromStr = ref<string>('');
const toStr = ref<string>('');
const q = ref<string>('');
const page = ref<number>(1);
const pageSize = ref<number>(200);
const total = ref<number>(0);
const hasNext = ref<boolean>(false);

// 查询结果
const items = ref<any[]>([]);

// 回放状态
const replayEvents = ref<any[]>([]);
const replayIndex = ref<number>(0);
const playing = ref<boolean>(false);
let timer: any = null;
const speed = ref<number>(1);

const totalPages = computed(() => {
  if (!total.value || !pageSize.value) return 1;
  return Math.max(1, Math.ceil(total.value / pageSize.value));
});

function parseTs(str: string): number | undefined {
  if (!str) return undefined;
  const d = new Date(str);
  const ts = d.getTime();
  return isNaN(ts) ? undefined : ts;
}

async function fetchEvents() {
  try {
    const params = new URLSearchParams();
    if (roomId.value.trim()) params.set('room_id', roomId.value.trim());
    if (userId.value.trim()) params.set('user_id', userId.value.trim());
    if (type.value.trim()) params.set('type', type.value.trim());
    const from = parseTs(fromStr.value);
    const to = parseTs(toStr.value);
    if (from) params.set('from_ts', String(from));
    if (to) params.set('to_ts', String(to));
    if (q.value.trim()) params.set('q', q.value.trim());
    params.set('page', String(page.value));
    params.set('pageSize', String(pageSize.value));

    const host = location.hostname || 'localhost';
    const url = `http://${host}:1299/api/events?${params.toString()}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if ((data as any)?.error) throw new Error((data as any).error);
    items.value = (data as any).items || [];
    total.value = (data as any).total || 0;
    page.value = (data as any).page || page.value;
    pageSize.value = (data as any).pageSize || pageSize.value;
    hasNext.value = !!(data as any).hasNext;
  } catch (e: any) {
    console.error('查询失败：', e?.message || e);
    items.value = [];
    total.value = 0;
    hasNext.value = false;
  }
}

function prevPage() {
  if (page.value <= 1) return;
  page.value -= 1;
  fetchEvents();
}
function nextPage() {
  if (!hasNext.value) return;
  page.value += 1;
  fetchEvents();
}

function scheduleNext() {
  if (replayIndex.value >= items.value.length) {
    playing.value = false;
    timer && clearTimeout(timer);
    timer = null;
    return;
  }
  const cur = items.value[replayIndex.value];
  const next = items.value[replayIndex.value + 1];
  replayEvents.value.unshift(cur);
  if (replayEvents.value.length > 100) replayEvents.value.pop();
  replayIndex.value += 1;
  let delay = 1000; // 默认 1s
  if (next && typeof cur?.ts === 'number' && typeof next?.ts === 'number') {
    const delta = Math.max(0, next.ts - cur.ts);
    // 防止过长等待，做上限与速度缩放
    delay = Math.min(3000, Math.max(100, delta)) / speed.value;
  } else {
    delay = 500 / speed.value;
  }
  timer = setTimeout(() => {
    scheduleNext();
  }, delay);
}

function startReplay() {
  if (items.value.length === 0) return;
  resetReplay();
  playing.value = true;
  scheduleNext();
}
function pauseReplay() {
  playing.value = false;
  timer && clearTimeout(timer);
  timer = null;
}
function resumeReplay() {
  if (replayIndex.value >= items.value.length) return;
  playing.value = true;
  scheduleNext();
}
function resetReplay() {
  replayEvents.value = [];
  replayIndex.value = 0;
  playing.value = false;
  timer && clearTimeout(timer);
  timer = null;
}
</script>

<style scoped>
.events-history-page { margin-top: 16px; }
.filters .row { display:flex; align-items:center; gap:8px; margin:8px 0; flex-wrap: wrap; }
.input { padding: 6px 8px; border: 1px solid var(--td-border-color); border-radius: var(--td-radius-small); }
.btn { padding: 6px 12px; border-radius: var(--td-radius-small); background: var(--td-bg-color-secondary); }
.meta { color: var(--td-text-color-secondary); font-size: 12px; }
.results, .replay { margin-top: 16px; }
</style>