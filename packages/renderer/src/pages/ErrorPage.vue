<template>
  <div class="error-page-container">
    <div class="error-content">
      <t-icon name="error-circle" class="error-icon" />
      <h1 class="error-title">{{ errorTitle }}</h1>
      <p class="error-message">{{ errorMessage }}</p>
      <div class="error-actions">
        <t-button @click="goBack" theme="primary">返回上一页</t-button>
        <t-button @click="goHome">返回首页</t-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps } from 'vue';
import { TIcon } from 'tdesign-vue-next';
import { useRouter } from 'vue-router';

const props = defineProps<{
  errorTitle?: string;
  errorMessage?: string;
}>();

const router = useRouter();
const errorTitle = ref(props.errorTitle || '发生错误');
const errorMessage = ref(props.errorMessage || '页面加载失败，请稍后重试');

const goBack = () => {
  router.go(-1);
};

const goHome = () => {
  router.push('/');
};
</script>

<style scoped>
.error-page-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--t-color-bg-page);
}

.error-content {
  text-align: center;
  padding: 2rem;
  border-radius: var(--t-radius-large);
  background-color: var(--t-color-bg-container);
  box-shadow: var(--t-shadow-card);
}

.error-icon {
  font-size: 4rem;
  color: var(--t-color-danger);
  margin-bottom: 1rem;
}

.error-title {
  font-size: 1.5rem;
  font-weight: var(--t-font-weight-bold);
  color: var(--t-color-text-primary);
  margin-bottom: 0.5rem;
}

.error-message {
  color: var(--t-color-text-secondary);
  margin-bottom: 1.5rem;
  max-width: 400px;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}
</style>