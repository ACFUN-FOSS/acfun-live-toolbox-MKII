<template>
  <div
    id="app"
    :class="{ 'theme-light': uiStore.theme === 'light', 'theme-dark': uiStore.theme === 'dark' }"
  >
    <LayoutShell />
  </div>
</template>

<script setup lang="ts">
import LayoutShell from './layouts/LayoutShell.vue';
import { useUiStore } from './stores/ui';

const uiStore = useUiStore();
</script>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: var(--td-bg-color-component);
}

::-webkit-scrollbar-thumb {
  background: var(--td-bg-color-component-hover);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--td-bg-color-component-active);
}

/* 确保 TDesign 主题变量可用 - 浅色主题（默认） */
:root,
.theme-light {
  --td-brand-color: #0052d9;
  --td-brand-color-1: #f2f6ff;
  --td-brand-color-3: #b3d1ff;
  --td-success-color: #00a870;
  --td-success-color-1: #e8f8f2;
  --td-success-color-3: #7fd9b8;
  --td-warning-color: #ed7b2f;
  --td-warning-color-1: #fef0e6;
  --td-warning-color-3: #f6c397;
  --td-error-color: #d54941;
  --td-error-color-1: #ffeee6;
  --td-error-color-3: #f0a9a4;
  --td-text-color-primary: #000000;
  --td-text-color-secondary: #666666;
  --td-text-color-placeholder: #bbbbbb;
  --td-bg-color-page: #f5f5f5;
  --td-bg-color-container: #ffffff;
  --td-bg-color-container-hover: #f8f8f8;
  --td-bg-color-component: #f0f0f0;
  --td-bg-color-component-hover: #e6e6e6;
  --td-bg-color-component-active: #d9d9d9;
  --td-border-color: #e6e6e6;
  --td-border-level-1-color: #e6e6e6;
  --td-shadow-3: 0 6px 30px 5px rgba(0, 0, 0, 0.12);
}

/* 暗色主题 */
.theme-dark {
  --td-brand-color: #4582e6;
  --td-brand-color-1: #1a2332;
  --td-brand-color-3: #2d4a7a;
  --td-success-color: #00a870;
  --td-success-color-1: #0d2818;
  --td-success-color-3: #1f5438;
  --td-warning-color: #ed7b2f;
  --td-warning-color-1: #2e1f0d;
  --td-warning-color-3: #5c3e1f;
  --td-error-color: #d54941;
  --td-error-color-1: #2a1616;
  --td-error-color-3: #542c2c;
  --td-text-color-primary: #ffffff;
  --td-text-color-secondary: #cccccc;
  --td-text-color-placeholder: #888888;
  --td-bg-color-page: #1a1a1a;
  --td-bg-color-container: #2d2d2d;
  --td-bg-color-container-hover: #3a3a3a;
  --td-bg-color-component: #404040;
  --td-bg-color-component-hover: #4d4d4d;
  --td-bg-color-component-active: #5a5a5a;
  --td-border-color: #404040;
  --td-border-level-1-color: #404040;
  --td-shadow-3: 0 6px 30px 5px rgba(0, 0, 0, 0.3);
}

/* 全局t-card无边框样式 */
.t-card {
  border: none !important;
}

/* 确保t-card的头部和内容区域样式正确 */
.t-card .t-card__header {
  border-bottom: 1px solid var(--td-border-color);
}

.t-card .t-card__body {
  padding: 16px;
}
</style>
