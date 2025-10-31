<template>
  <div class="filter-bar">
    <span class="label">事件类型筛选：</span>
    <label v-for="t in allTypes" :key="t" class="type-chip">
      <input type="checkbox" :value="t" v-model="selected" />
      <span :data-type="t">{{ t }}</span>
    </label>
    <button class="btn" @click="selectAll">全选</button>
    <button class="btn" @click="clearAll">清空</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

const props = defineProps<{ modelValue: string[] | undefined }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const allTypes = ['danmaku','gift','follow','like','enter','system'];
const selected = ref<string[]>(props.modelValue ?? allTypes.slice());

function selectAll() {
  selected.value = allTypes.slice();
}
function clearAll() {
  selected.value = [];
}

watch(selected, (v) => {
  try { localStorage.setItem('eventFilterTypes', JSON.stringify(v)); } catch {}
  emit('update:modelValue', v);
}, { deep: true });

onMounted(() => {
  try {
    const raw = localStorage.getItem('eventFilterTypes');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) selected.value = parsed.filter((x) => allTypes.includes(x));
    }
  } catch {}
});
</script>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.type-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: var(--td-radius-default); background: var(--td-bg-color-secondary); font-size: 12px; }
.label { font-size: 12px; color: var(--td-text-color-secondary); margin-right: 8px; }
.btn { padding: 2px 8px; border-radius: var(--td-radius-small); background: var(--td-bg-color-secondary); font-size: 12px; }
.type-chip span[data-type="danmaku"] { color: var(--td-brand-color); }
.type-chip span[data-type="gift"] { color: var(--td-warning-color); }
.type-chip span[data-type="like"] { color: var(--td-success-color); }
.type-chip span[data-type="follow"] { color: #8a2be2; }
.type-chip span[data-type="enter"] { color: #2f8f83; }
.type-chip span[data-type="system"] { color: var(--td-text-color-placeholder); }
</style>