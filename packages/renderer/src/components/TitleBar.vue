<script setup lang="ts">
import { ref } from 'vue';
import { DialogPlugin, Button as TButton } from 'tdesign-vue-next';

// 扩展Window接口以包含我们的API
declare global {
  interface Window {
    api: {
      window: {
        minimize: () => void;
        close: () => void;
      };
    };
  }
}

// 主题切换功能
const isDarkMode = ref(false);

// 初始化主题状态
const initTheme = () => {
  const isDark = document.documentElement.hasAttribute('theme-mode');
  isDarkMode.value = isDark;
};

// 切换主题模式
const toggleTheme = (checked: boolean) => {
  isDarkMode.value = checked;
  if (checked) {
    document.documentElement.setAttribute('theme-mode', 'dark');
  } else {
    document.documentElement.removeAttribute('theme-mode');
  }
};

// 初始化主题
initTheme();

// 窗口控制方法
const minimizeWindow = () => {
  window.api.window.minimize();
};

const closeWindow = () => {
  DialogPlugin.confirm({
    header: '确认关闭',
    body: '确定要关闭应用吗？',
    onConfirm: () => {
      window.api.window.close();
    }
  });
};
</script>

<template>
  <div class="title-bar">
    <div class="app-title">我的应用</div>
    <div class="window-controls">
      <div style="margin-right: 8px; display: flex; align-items: center;">
        <span style="margin-right: 4px; font-size: 12px;" class="dark-mode">深色模式</span>
        <TSwitch
          v-model="isDarkMode"
          size="small"
          @change="toggleTheme"
        />
      </div>
      <TButton
        variant="text"
        size="small"
        shape="circle"
        @click="minimizeWindow"
        class="control-btn"
      >
        <svg width="14" height="2" viewBox="0 0 14 2" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="14" height="2" rx="1" fill="currentColor"/>
        </svg>
      </TButton>
      <TButton
        variant="text"
        size="small"
        shape="circle"
        @click="closeWindow"
        class="control-btn close-btn"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 3L3 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M3 3L11 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </TButton>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  padding: 0 16px;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e5e5;
  -webkit-app-region: drag;
  user-select: none;
}

/* 深色模式下的顶边栏样式 */
:root[theme-mode=dark] .title-bar {
  background-color: #1a1a1a;
  border-bottom-color: #333333;
}

.app-title {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #333333;
}
.dark-mode{
  color: #333333;
}

/* 深色模式下的标题文字样式 */
:root[theme-mode=dark] .app-title {
  color: #ffffff;
}

:root[theme-mode=dark] .dark-mode {
  color: #ffffff;
}

.window-controls {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 24px;
  height: 24px;
  color: #666;
}

.control-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.close-btn:hover {
  background-color: #ff4d4f;
  color: white;
}
</style>