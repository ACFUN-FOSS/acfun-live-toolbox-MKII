<template>
  <div class="grid-cell">
    <t-card hover-shadow title="文档">
      <div v-if="home.loading.D"><t-skeleton :row-col="[[{ width: '100%' }],[{ width: '100%' }],[{ width: '100%' }]]" /></div>
      <div v-else-if="home.error.D">
        <t-alert theme="error" :message="home.error.D" closeBtn @close="home.retryCard('D')"></t-alert>
        <div class="empty-state">
          暂无内容
          <t-button size="small" variant="outline" @click="home.retryCard('D')">重试</t-button>
        </div>
      </div>
      <div v-else>
        <div v-if="home.docs.length === 0" class="empty-state">
          暂无文档项
          <t-link theme="primary" href="#/system/develop" target="_blank">查看文档</t-link>
        </div>
        <div v-else class="docs-list">
          <div v-for="(d,i) in home.docs" :key="i" class="docs-item">
            <div class="docs-title">{{ d.title }}</div>
            <div class="docs-desc">{{ d.desc }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <t-link theme="primary" href="#/system/develop" target="_blank">查看更多</t-link>
      </template>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { useHomeStore } from '../../stores/home';
const home = useHomeStore();
</script>

<style scoped>
.docs-list { display: flex; flex-direction: column; gap: 8px; }
.docs-item { padding: 8px 12px; border: 1px solid var(--td-border-level-1-color); border-radius: 6px; }
.docs-title { font-weight: 600; color: var(--td-text-color-primary); }
.docs-desc { font-size: 12px; color: var(--td-text-color-secondary); }
.empty-state { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; color: var(--td-text-color-secondary); }
</style>