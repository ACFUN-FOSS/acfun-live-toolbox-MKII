<template>
  <div class="grid-cell">
    <t-card hover-shadow title="文档">
      <div v-if="home.loading.D"><t-skeleton :row-col="[[{ width: '100%' }],[{ width: '100%' }],[{ width: '100%' }]]" /></div>
      <t-alert v-else-if="home.error.D" theme="error" :message="home.error.D" closeBtn @close="home.retryCard('D')"></t-alert>
      <div v-else class="docs-list">
        <div v-for="(d,i) in home.docs" :key="i" class="docs-item">
          <div class="docs-title">{{ d.title }}</div>
          <div class="docs-desc">{{ d.desc }}</div>
        </div>
      </div>
      <template #footer>
        <t-link theme="primary" @click="openDocsMore">查看更多</t-link>
      </template>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { useHomeStore } from '../../stores/home';
import { useRouter } from 'vue-router';
const home = useHomeStore();
const router = useRouter();
const openDocsMore = () => router.push('/system/develop');
</script>

<style scoped>
.docs-list { display: flex; flex-direction: column; gap: 8px; }
.docs-item { padding: 8px 12px; border: 1px solid var(--td-border-level-1-color); border-radius: 6px; }
.docs-title { font-weight: 600; color: var(--td-text-color-primary); }
.docs-desc { font-size: 12px; color: var(--td-text-color-secondary); }
</style>