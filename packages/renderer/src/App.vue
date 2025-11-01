<template>
  <div id="app">
    <MainLayout />
  </div>
</template>

<script setup lang="ts">
import MainLayout from './layouts/MainLayout.vue';
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

/* 确保 TDesign 主题变量可用 */
:root {
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
  --td-shadow-3: 0 6px 30px 5px rgba(0, 0, 0, 0.12);
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  :root {
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
  }
}
</style>
