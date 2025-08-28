<script setup lang="ts">
import QuickToolbar from './components/QuickToolbar.vue';
import { Layout as TLayout, Content as TContent } from "tdesign-vue-next";
import TitleBar from "./components/TitleBar.vue";
import Sidebar from "./components/Sidebar.vue";
</script>

<template>
  <QuickToolbar />
  <div class="app-container">
    <!-- 标题栏组件 -->
    <TitleBar />

    <!-- 主布局容器 -->
    <TLayout class="main-layout">
      <!-- 侧边导航栏 -->
      <Sidebar width="200" class="app-sider" />

      <!-- 主内容区域 -->
      <TContent class="app-content">
        <router-view />
      </TContent>
    </TLayout>
  </div>
</template>

<style scoped>
/* 移除默认边距和滚动条 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  overflow: hidden;
}

.app-container {
  height: calc(100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #fff;
  position: relative;
}

.main-layout {
  flex: 1;
  display: flex;
  flex-direction: row;
  height: calc(768px - 32px);
  overflow: hidden;
  width: 100%;
}

.app-sider {
  background-color: var(--td-bg-color-secondary);
  border-right: 1px solid var(--td-border-color);
  box-shadow: var(--td-shadow-2);
  z-index: 10;
  display: block !important;
  flex-shrink: 0;
  transition: all 0.2s ease-in-out;
}

.app-content {
  padding: 20px;
  overflow-y: auto;
  background-color: var(--td-bg-color);
  color: var(--td-text-color-primary);
  flex: 1;
  min-height: 0;
}

.content-container {
  max-width: 1200px;
  margin: 0 auto;
}
.theme-test-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: var(--td-bg-color-secondary);
  border: 1px solid var(--td-border-color);
  border-radius: var(--td-radius-large);
  padding: 16px;
  box-shadow: var(--td-shadow-3);
  z-index: 1000;
  max-width: 300px;
  transition: all 0.2s ease-in-out;
}
</style>
