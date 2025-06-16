<script setup lang="ts">
import { Layout as TLayout, Content as TContent } from 'tdesign-vue-next';
import TitleBar from './components/TitleBar.vue';
import Sidebar from './components/Sidebar.vue';
</script>

<template>
  <div class="app-container">
    <!-- 标题栏组件 -->
    <TitleBar />

    <!-- 主布局容器 -->
    <TLayout class="main-layout">
      <!-- 侧边导航栏 -->
      <Sidebar
        width="200"
        class="app-sider"
      />

      <!-- 主内容区域 -->
      <TContent class="app-content">
        <div class="content-container">
          <h1>欢迎使用我的应用</h1>
          <p>这是主内容区域，可根据窗口大小自适应调整。</p>
        </div>
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

html, body {
  overflow: hidden;
}

.app-container {
  width: 100%;
  height: calc(100% );
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #fff;
  position: relative;
}

.main-layout {
  flex: 1;
  display: flex;
  height: calc(768px - 32px);
  overflow: hidden;
  width: 100%;
}

.app-sider {
  background-color: #f5f5f5;
  border-right: 1px solid #e5e5e5; /* 添加侧边栏和内容区的分割线 */
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05); /* 添加轻微阴影增强分隔感 */
  z-index: 10;
  display: block !important;
  flex-shrink: 0;
}

.app-content {
  padding: 20px;
  overflow-y: auto;
  background-color: #fff;
  flex: 1;
}

.content-container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
