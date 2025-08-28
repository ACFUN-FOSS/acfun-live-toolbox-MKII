<script setup lang="ts">
import { ref } from "vue";
import { ipcRenderer } from 'electron';
import { darkMode, toggleTheme } from '../composables/useTheme';
import { DialogPlugin, Button as TButton, Switch } from "tdesign-vue-next";

// 扩展Window接口以包含我们的API
declare global {
  interface Window {
    api: {
      window: {
        minimize: () => Promise<boolean>;
        close: () => Promise<boolean>;
        toggleAlwaysOnTop: (alwaysOnTop?: boolean) => Promise<boolean>;
      };
    };
  }
}

// 窗口API由preload脚本提供，无需在此初始化
if (!window.api?.window) {
  console.error("Window API未正确初始化，请检查preload脚本");
}

// 主题切换功能
const isDarkMode = ref(false);

// 初始化主题状态
const initTheme = () => {
  const isDark = document.documentElement.hasAttribute("theme-mode");
  isDarkMode.value = isDark;
};

// 切换主题模式
const toggleTheme = (checked: boolean) => {
  isDarkMode.value = checked;
  if (checked) {
    document.documentElement.setAttribute("theme-mode", "dark");
  } else {
    document.documentElement.removeAttribute("theme-mode");
  }
};

// 初始化主题
initTheme();

// 窗口控制方法
const minimizeWindow = async () => {
  try {
    await window.api.window.minimize();
  } catch (error) {
    console.error("Failed to minimize window:", error);
  }
};

const closeWindow = () => {
  DialogPlugin.confirm({
    header: "确认关闭",
    body: "确定要关闭应用吗？",
    onConfirm: async () => {
      try {
        await window.api.window.close();
      } catch (error) {
        console.error("Failed to close window:", error);
      }
    },
  });
};
</script>

<template>
  <div class="title-bar">
    <div class="app-title">AcFrame直播框架</div>
    <div class="theme-toggle">
  <Switch v-model="darkMode" @change="toggleTheme" />
</div>
<div class="window-controls">
      <div style="margin-right: 8px; display: flex; align-items: center">
        <span style="margin-right: 4px; font-size: 12px" class="dark-mode"
          >深色模式</span
        >
        <TSwitch v-model="isDarkMode" size="small" @change="toggleTheme" />
      </div>
      <TButton
        variant="text"
        size="small"
        shape="square"
        @click="minimizeWindow"
        class="control-btn"
        :title="'最小化窗口'"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="3" y="6" width="8" height="2" rx="1" fill="currentColor" />
        </svg>
      </TButton>
      <TButton
        variant="text"
        size="small"
        shape="square"
        @click="closeWindow"
        class="control-btn close-btn"
        :title="'关闭窗口'"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 4L10 10"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M10 4L4 10"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
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
  background-color: var(--td-bg-color);
  border-bottom: 1px solid var(--td-border-color);
  -webkit-app-region: drag;
  user-select: none;
  transition: background-color 0.2s ease-in-out;
}

/* 深色模式下的顶边栏样式 */
:root[theme-mode="dark"] .title-bar {
  background-color: #1a1a1a;
  border-bottom-color: #333333;
}

.app-title {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--td-text-color-primary);
}
.dark-mode {
  color: var(--td-text-color-secondary);
}

/* 深色模式下的标题文字样式 */
:root[theme-mode="dark"] .app-title {
  color: #ffffff;
}

:root[theme-mode="dark"] .dark-mode {
  color: #ffffff;
}

.window-controls {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 32px;
  height: 24px;
  color: var(--td-text-color-secondary);
  border-radius: var(--td-radius-default);
  transition: all 0.2s ease-in-out;
}

.control-btn:hover {
  background-color: rgba(0, 0, 0, 0.08);
  color: #1d2129;
}

/* 深色模式按钮样式 */
:root[theme-mode="dark"] .control-btn {
  color: #c9cdd4;
}

:root[theme-mode="dark"] .control-btn:hover {
  background-color: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.close-btn:hover {
  background-color: var(--td-error-color);
  color: white;
  box-shadow: 0 2px 8px rgba(245, 63, 63, 0.3);
}

/* 按钮图标居中 */
.control-btn svg {
  margin: auto;
}
</style>
