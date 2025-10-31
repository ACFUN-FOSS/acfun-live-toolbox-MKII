<template>
  <section class="rooms-page">
    <h2>房间管理</h2>
    <div class="connect-panel">
      <input v-model="inputRoomId" type="text" placeholder="输入房间ID" />
      <button class="btn" @click="connectRoom" :disabled="!inputRoomId">连接房间</button>
      <button class="btn" @click="refreshRooms">刷新列表</button>
      <span class="msg" v-if="message">{{ message }}</span>
    </div>

    <div v-if="rooms.length === 0" class="placeholder">暂无房间连接，添加一个试试吧。</div>
    <ul v-else class="room-list">
      <li v-for="r in rooms" :key="r.roomId" class="room-item">
        <div class="info">
          <span class="room">房间 {{ r.roomId }}</span>
          <span class="badge" :data-status="r.status">{{ r.status }}</span>
          <span class="meta">事件数：{{ r.eventCount }}</span>
          <span class="meta">优先级：{{ priorityEdits[r.roomId] ?? 0 }}</span>
          <span class="meta" v-if="(labelEdits[r.roomId] || '')">标签：{{ labelEdits[r.roomId] }}</span>
        </div>
        <div class="actions">
          <button class="btn" @click="disconnectRoom(r.roomId)">断开</button>
          <button class="btn" @click="checkStatus(r.roomId)">查询状态</button>
          <input class="input small" type="number" v-model.number="priorityEdits[r.roomId]" placeholder="优先级" />
          <button class="btn" @click="savePriority(r.roomId)">保存优先级</button>
          <input class="input" type="text" v-model="labelEdits[r.roomId]" placeholder="标签" />
          <button class="btn" @click="saveLabel(r.roomId)">保存标签</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface RoomItem {
  roomId: string;
  status: string;
  eventCount: number;
  connectedAt: number | null;
  lastEventAt: number | null;
  reconnectAttempts: number;
}

const rooms = ref<RoomItem[]>([]);
const inputRoomId = ref<string>('');
const message = ref<string>('');
const priorityEdits = ref<Record<string, number>>({});
const labelEdits = ref<Record<string, string>>({});

async function refreshRooms() {
  try {
    const res = await window.electronApi.room.list();
    if ((res as any).error) {
      message.value = (res as any).error;
      return;
    }
    rooms.value = (res as any).rooms || [];
    // 初始化编辑值（如果后端已有字段，可使用 r.priority/r.label）
    for (const r of rooms.value) {
      if (!(r.roomId in priorityEdits.value)) priorityEdits.value[r.roomId] = 0;
      if (!(r.roomId in labelEdits.value)) labelEdits.value[r.roomId] = '';
    }
    message.value = '';
  } catch (e: any) {
    message.value = e?.message || String(e);
  }
}

async function connectRoom() {
  try {
    const res = await window.electronApi.room.connect(inputRoomId.value.trim());
    if (!res.success) {
      message.value = res.error || '连接失败';
    } else {
      message.value = '连接请求已发送';
      inputRoomId.value = '';
      await refreshRooms();
    }
  } catch (e: any) {
    message.value = e?.message || String(e);
  }
}

async function disconnectRoom(roomId: string) {
  try {
    const res = await window.electronApi.room.disconnect(roomId);
    if (!res.success) {
      message.value = res.error || '断开失败';
    } else {
      message.value = '已断开房间';
      await refreshRooms();
    }
  } catch (e: any) {
    message.value = e?.message || String(e);
  }
}

async function checkStatus(roomId: string) {
  try {
    const res = await window.electronApi.room.status(roomId);
    if ((res as any).error) {
      message.value = (res as any).error;
      return;
    }
    const idx = rooms.value.findIndex(r => r.roomId === roomId);
    if (idx >= 0) {
      rooms.value[idx] = res as RoomItem;
      // 保留已有编辑值；如果后端返回了字段可覆盖
    }
    message.value = '';
  } catch (e: any) {
    message.value = e?.message || String(e);
  }
}

async function savePriority(roomId: string) {
  try {
    const val = Number(priorityEdits.value[roomId] ?? 0);
    const res = await window.electronApi.room.setPriority(roomId, val);
    if (!res.success) {
      message.value = res.error || '保存优先级失败';
    } else {
      message.value = '优先级已保存';
    }
  } catch (e: any) {
    message.value = e?.message || String(e);
  }
}

async function saveLabel(roomId: string) {
  try {
    const val = String(labelEdits.value[roomId] || '');
    const res = await window.electronApi.room.setLabel(roomId, val);
    if (!res.success) {
      message.value = res.error || '保存标签失败';
    } else {
      message.value = '标签已保存';
    }
  } catch (e: any) {
    message.value = e?.message || String(e);
  }
}

onMounted(() => {
  refreshRooms();
});
</script>

<style scoped>
.rooms-page { margin-top: 16px; }
.connect-panel { display:flex; align-items:center; gap:12px; margin:8px 0; }
.connect-panel input { padding:6px 8px; border:1px solid var(--td-border-color); border-radius:8px; background: var(--td-bg-color-secondary); color: var(--td-text-color-primary); }
.room-list { list-style:none; padding:0; margin:0; }
.room-item { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--td-border-color-light); }
.info { display:flex; align-items:center; gap:12px; }
.badge { padding:2px 8px; border-radius: var(--td-radius-full); background: var(--td-bg-color-tertiary); font-size:12px; }
.meta { font-size:12px; color: var(--td-text-color-secondary); }
.actions { display:flex; gap:8px; }
.btn { padding:6px 12px; }
.input { padding:6px 8px; border:1px solid var(--td-border-color); border-radius:8px; background: var(--td-bg-color-secondary); color: var(--td-text-color-primary); }
.input.small { width: 80px; }
.placeholder { color: var(--td-text-color-placeholder); font-style: italic; }
.msg { color: var(--td-text-color-secondary); font-size:12px; }
</style>