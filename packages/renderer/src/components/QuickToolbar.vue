<script setup lang="ts">
import { Tooltip, Button, Dropdown, Menu } from 'tdesign-vue-next';
import { ref, onMounted } from 'vue';
import { ipcRenderer } from 'electron';

// 工具栏状态
const isVisible = ref(true);
const isMinimized = ref(false);

// 工具栏操作
const defaultActions = [
  { name: 'startLive', icon: 'play-circle', tooltip: '开始直播' },
  { name: 'stopLive', icon: 'pause-circle', tooltip: '停止直播' },
  { name: 'refreshData', icon: 'refresh', tooltip: '刷新数据' },
  { name: 'settings', icon: 'setting', tooltip: '设置' },
  { name: 'help', icon: 'question-circle', tooltip: '帮助' },
];
const toolbarActions = ref([]);

// 执行工具栏操作
const handleAction = async (action: string) => {
  try {
    switch(action) {
      case 'startLive':
        await ipcRenderer.invoke('live:start');
        break;
      case 'stopLive':
        await ipcRenderer.invoke('live:stop');
        break;
      case 'refreshData':
        await ipcRenderer.invoke('dashboard:refresh');
        break;
      case 'settings':
        await ipcRenderer.invoke('window:openSettings');
        break;
      case 'help':
        await ipcRenderer.invoke('window:openHelp');
        break;
    }
  } catch (error) {
    console.error(`执行操作失败: ${error}`);
  }
};

onMounted(async () => {
  try {
    const settings = await ipcRenderer.invoke('settings:getSettings');
    toolbarActions.value = settings.toolbarActions || defaultActions;
  } catch (error) {
    console.error('获取工具栏配置失败:', error);
    toolbarActions.value = defaultActions;
  }
});

</script>

<template>
  <div class="quick-toolbar" :class="{ minimized: isMinimized }">
    <div class="toolbar-handle" @click="isMinimized = !isMinimized">
      <span v-if="!isMinimized">≡</span>
      <span v-else>≡</span>
    </div>
    <div class="toolbar-actions">
      <Tooltip
        v-for="action in toolbarActions"
        :key="action.name"
        :content="action.tooltip"
        placement="right"
      >
        <Button
          variant="text"
          shape="circle"
          size="large"
          :icon="action.icon"
          @click="handleAction(action.name)"
          class="toolbar-btn"
        />
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.quick-toolbar {
  position: fixed;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  background-color: #1e293b;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  transition: all 0.3s ease;
}

.toolbar-handle {
  padding: 8px;
  color: #cbd5e1;
  cursor: pointer;
  text-align: center;
  border-bottom: 1px solid #334155;
}

.toolbar-actions {
  display: flex;
  flex-direction: column;
  padding: 10px 5px;
}

.toolbar-btn {
  color: #f8fafc !important;
  background-color: transparent !important;
  margin: 5px 0;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background-color: #334155 !important;
}

.minimized .toolbar-actions {
  display: none;
}
</style>