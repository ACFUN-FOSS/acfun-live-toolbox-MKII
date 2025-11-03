<template>
  <div class="layout-shell">
    <!-- Topbar 区域 (40px 高度) -->
    <Topbar class="layout-topbar" />
    
    <!-- 主要内容区域 -->
    <div class="layout-main">
      <!-- Sidebar 导航区域 (208px 宽度) -->
      <Sidebar class="layout-sidebar" />
      
      <!-- RouterView 内容区域 (816x728px 可用空间) -->
      <div class="layout-content">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import Topbar from '../components/Topbar.vue';
import Sidebar from '../components/Sidebar.vue';
</script>

<style scoped>
.layout-shell {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--td-bg-color-page);
  
  /* 针对1024x768分辨率优化 */
  min-width: 1024px;
  min-height: 768px;
}

.layout-topbar {
  width: 100%;
  height: 40px;
  flex-shrink: 0;
  z-index: 1000;
}

.layout-main {
  flex: 1;
  display: flex;
  height: calc(100vh - 40px); /* 减去topbar高度 */
  overflow: hidden;
}

.layout-sidebar {
  width: 208px;
  height: 100%;
  flex-shrink: 0;
  border-right: 1px solid var(--td-border-level-1-color);
  background-color: var(--td-bg-color-container);
}

.layout-content {
  flex: 1;
  width: calc(100% - 208px); /* 减去sidebar宽度 */
  height: 100%;
  overflow: auto;
  background-color: var(--td-bg-color-page);
  
  /* 在1024x768下，内容区域为816x728px */
  max-width: 816px;
}

/* 1024x768分辨率专用样式 */
@media (width: 1024px) and (height: 768px) {
  .layout-shell {
    width: 1024px;
    height: 768px;
  }
  
  .layout-content {
    width: 816px;
    height: 728px;
  }
}

/* 滚动条优化 */
.layout-content::-webkit-scrollbar {
  width: 6px;
}

.layout-content::-webkit-scrollbar-track {
  background: var(--td-bg-color-component);
}

.layout-content::-webkit-scrollbar-thumb {
  background: var(--td-bg-color-component-hover);
  border-radius: 3px;
}

.layout-content::-webkit-scrollbar-thumb:hover {
  background: var(--td-bg-color-component-active);
}
</style>