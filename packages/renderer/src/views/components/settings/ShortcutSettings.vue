<template>
  <t-form
    :data="settings"
    @submit="handleSubmit"
    class="shortcut-settings-form"
  >
    <div class="section-title">全局快捷键</div>
    <div class="shortcut-description">应用程序级别的全局快捷键，在任何界面都可使用</div>

    <t-form-item label="显示主窗口" name="showMainWindow">
      <shortcut-input v-model="settings.shortcuts.showMainWindow" />
    </t-form-item>

    <t-form-item label="隐藏主窗口" name="hideMainWindow">
      <shortcut-input v-model="settings.shortcuts.hideMainWindow" />
    </t-form-item>

    <t-form-item label="退出应用" name="exitApp">
      <shortcut-input v-model="settings.shortcuts.exitApp" />
    </t-form-item>

    <t-form-item label="打开设置" name="openSettings">
      <shortcut-input v-model="settings.shortcuts.openSettings" />
    </t-form-item>

    <div class="section-divider"></div>

    <div class="section-title">直播控制快捷键</div>
    <div class="shortcut-description">在直播管理界面使用的快捷键</div>

    <t-form-item label="开始直播" name="startStream">
      <shortcut-input v-model="settings.shortcuts.startStream" />
    </t-form-item>

    <t-form-item label="停止直播" name="stopStream">
      <shortcut-input v-model="settings.shortcuts.stopStream" />
    </t-form-item>

    <t-form-item label="暂停直播" name="pauseStream">
      <shortcut-input v-model="settings.shortcuts.pauseStream" />
    </t-form-item>

    <t-form-item label="刷新推流码" name="refreshStreamKey">
      <shortcut-input v-model="settings.shortcuts.refreshStreamKey" />
    </t-form-item>

    <div class="section-divider"></div>

    <div class="form-actions">
      <t-button type="submit" theme="primary">保存快捷键设置</t-button>
      <t-button @click="resetToDefault" variant="outline">恢复默认快捷键</t-button>
    </div>
  </t-form>
</template>

<script setup lang="ts">
import { ref, reactive, watch, toRefs } from 'vue';
import { TMessage } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';
import ShortcutInput from './ShortcutInput.vue';

const props = defineProps<{
  settings: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'update-settings'): void;
}>();

// 深拷贝初始设置用于重置功能
const initialSettings = JSON.parse(JSON.stringify(props.settings));
const formData = reactive({ ...props.settings });
const settings = toRefs(formData);

// 监听设置变化并更新父组件数据
watch(
  formData,
  (newVal) => {
    props.settings.shortcuts = { ...newVal.shortcuts };
  },
  { deep: true }
);

/**
 * 提交表单
 */
const handleSubmit = (e: SubmitEvent) => {
  e.preventDefault();
  emit('update-settings');
};

/**
 * 恢复默认快捷键设置
 */
const resetToDefault = async () => {
  try {
    const response = await ipcRenderer.invoke('systemSettings:resetToDefault', 'shortcuts');
    if (response.success) {
      Object.assign(formData.shortcuts, response.data.shortcuts);
      TMessage.success('已恢复默认快捷键设置');
    } else {
      TMessage.error(`恢复默认设置失败: ${response.error}`);
    }
  } catch (error) {
    TMessage.error(`操作失败: ${(error as Error).message}`);
  }
};
</script>

<style scoped>
.shortcut-settings-form {
  max-width: 600px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 24px 0 8px;
  color: var(--t-color-text-primary);
}

.shortcut-description {
  font-size: 12px;
  color: var(--t-color-text-secondary);
  margin-bottom: 16px;
}

.section-divider {
  height: 1px;
  background-color: var(--t-color-border);
  margin: 16px 0;
}

.form-actions {
  margin-top: 30px;
  display: flex;
  gap: 12px;
}
</style>