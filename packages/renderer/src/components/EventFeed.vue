<template>
  <section class="events-panel">
    <h2>实时事件（最近 100 条）</h2>
    <div
      v-if="events.length === 0"
      class="placeholder"
    >
      暂时没有事件，等待广播…
    </div>
    <ul
      v-else
      class="events-list"
    >
      <li
        v-for="(ev, idx) in events"
        :key="idx"
        class="event-item"
      >
        <div class="meta">
          <span class="ts">{{ formatTs(ev.ts) }}</span>
          <span class="room">房间 {{ ev.room_id }}</span>
          <span
            class="type"
            :data-type="ev.event_type"
          >{{ ev.event_type }}</span>
        </div>
        <div class="content">
          <span
            v-if="ev.user_name"
            class="user"
          >{{ ev.user_name }}</span>
          <span
            v-if="ev.content"
            class="text"
          >：{{ ev.content }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{ events: any[] }>();

function formatTs(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}
</script>

<style scoped>
.events-panel { margin-top: 16px; }
.events-list { list-style: none; padding: 0; margin: 0; }
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