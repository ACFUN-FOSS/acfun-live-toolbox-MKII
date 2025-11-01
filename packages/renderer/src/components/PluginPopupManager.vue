<template>
  <div class="plugin-popup-manager">
    <!-- 渲染所有活跃的弹窗 -->
    <PluginPopup
      v-for="popup in activePopups"
      :key="popup.id"
      :popup="popup"
      :model-value="true"
      @close="handlePopupClose"
      @action="handlePopupAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import PluginPopup, { type PopupOptions } from './PluginPopup.vue';

// 活跃的弹窗列表
const activePopups = ref<PopupOptions[]>([]);

// 处理弹窗关闭
const handlePopupClose = async (popupId: string) => {
  const popup = activePopups.value.find(p => p.id === popupId);
  if (!popup) return;

  try {
      // 调用IPC关闭弹窗
      const result = await window.electronApi.plugin.popup.close(popup.pluginId, popupId);
    
    if (result.success) {
      // 从活跃列表中移除
      const index = activePopups.value.findIndex(p => p.id === popupId);
      if (index !== -1) {
        activePopups.value.splice(index, 1);
      }
    } else {
      console.error('Failed to close popup:', result.error);
    }
  } catch (error) {
    console.error('Error closing popup:', error);
  }
};

// 处理弹窗动作
const handlePopupAction = async (popupId: string, actionId: string) => {
  const popup = activePopups.value.find(p => p.id === popupId);
  if (!popup) return;

  try {
      // 调用IPC处理动作
      const result = await window.electronApi.plugin.popup.action(popup.pluginId, popupId, actionId);
    
    if (!result.success) {
      console.error('Failed to handle popup action:', result.error);
    }
    
    // 某些动作可能会关闭弹窗
    if (actionId === 'confirm' || actionId === 'cancel' || actionId === 'close') {
      await handlePopupClose(popupId);
    }
  } catch (error) {
    console.error('Error handling popup action:', error);
  }
};

// 创建新弹窗
const createPopup = (popup: PopupOptions) => {
  // 检查是否已存在相同ID的弹窗
  const existingIndex = activePopups.value.findIndex(p => p.id === popup.id);
  if (existingIndex !== -1) {
    // 更新现有弹窗
    activePopups.value[existingIndex] = popup;
  } else {
    // 添加新弹窗
    activePopups.value.push(popup);
  }
};

// 关闭指定弹窗
const closePopup = (popupId: string) => {
  handlePopupClose(popupId);
};

// 将弹窗置于前台
const bringToFront = async (popupId: string) => {
  const popup = activePopups.value.find(p => p.id === popupId);
  if (!popup) return;

  try {
      const result = await window.electronApi.plugin.popup.bringToFront(popup.pluginId, popupId);
    
    if (result.success) {
      // 重新排序，将指定弹窗移到最后（最前面）
      const index = activePopups.value.findIndex(p => p.id === popupId);
      if (index !== -1) {
        const [targetPopup] = activePopups.value.splice(index, 1);
        activePopups.value.push(targetPopup);
      }
    }
  } catch (error) {
    console.error('Error bringing popup to front:', error);
  }
};

// 获取所有活跃弹窗
const getActivePopups = () => {
  return activePopups.value.slice();
};

// 清除所有弹窗
const clearAllPopups = () => {
  activePopups.value.forEach(popup => {
    handlePopupClose(popup.id);
  });
};

// 监听来自主进程的弹窗事件
const handlePopupEvent = (...args: any[]) => {
  const [, data] = args;
  switch (data.type) {
    case 'popup-created':
      createPopup(data.popup);
      break;
    case 'popup-closed':
      const index = activePopups.value.findIndex(p => p.id === data.popupId);
      if (index !== -1) {
        activePopups.value.splice(index, 1);
      }
      break;
    case 'popup-updated':
      const existingIndex = activePopups.value.findIndex(p => p.id === data.popup.id);
      if (existingIndex !== -1) {
        activePopups.value[existingIndex] = data.popup;
      }
      break;
  }
};

// 生命周期管理
onMounted(() => {
  // 监听弹窗事件
  if (window.electronApi && window.electronApi.on) {
    window.electronApi.on('plugin-popup-event', handlePopupEvent);
  }
});

onUnmounted(() => {
  // 清理事件监听器
  if (window.electronApi && window.electronApi.off) {
    window.electronApi.off('plugin-popup-event', handlePopupEvent);
  }
  
  // 清除所有弹窗
  clearAllPopups();
});

// 暴露方法给父组件
defineExpose({
  createPopup,
  closePopup,
  bringToFront,
  getActivePopups,
  clearAllPopups
});
</script>

<style scoped>
.plugin-popup-manager {
  /* 弹窗管理器本身不需要样式，只是容器 */
  position: relative;
  z-index: 1000;
}

/* 确保弹窗层级正确 */
.plugin-popup-manager :deep(.t-dialog__wrap) {
  z-index: var(--popup-z-index, 2000);
}

/* 多弹窗时的层级管理 */
.plugin-popup-manager :deep(.t-dialog__wrap:last-child) {
  z-index: calc(var(--popup-z-index, 2000) + 10);
}
</style>