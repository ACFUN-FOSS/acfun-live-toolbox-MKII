<template>
  <div class="settings-container">
    <t-card class="settings-card">
      <div class="settings-header">
        <h2>系统设置</h2>
        <t-button @click="resetToDefault" theme="danger" variant="outline" class="reset-button">
          恢复默认设置
        </t-button>
      </div>

      <t-tabs v-model="activeTab" class="settings-tabs">
        <t-tab-panel value="general" label="基本设置">
          <general-settings :settings="settings.general" @update-settings="handleSettingsUpdate('general')" />
        </t-tab-panel>
        <t-tab-panel value="network" label="网络设置">
          <network-settings :settings="settings.network" @update-settings="handleSettingsUpdate('network')" />
        </t-tab-panel>
        <t-tab-panel value="shortcuts" label="快捷键设置">
          <shortcut-settings :settings="settings.shortcuts" @update-settings="handleSettingsUpdate('shortcuts')" />
        </t-tab-panel>
        <t-tab-panel value="notifications" label="通知设置">
          <notification-settings :settings="settings.notifications" @update-settings="handleSettingsUpdate('notifications')" />
        </t-tab-panel>
        <t-tab-panel value="appearance" label="外观设置">
          <appearance-settings :settings="settings.appearance" @update-settings="handleSettingsUpdate('appearance')" />
        </t-tab-panel>
      </t-tabs>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { ipcRenderer } from 'electron';
import { TMessage } from 'tdesign-vue-next';
import GeneralSettings from './components/settings/GeneralSettings.vue';
import NetworkSettings from './components/settings/NetworkSettings.vue';
import ShortcutSettings from './components/settings/ShortcutSettings.vue';
import NotificationSettings from './components/settings/NotificationSettings.vue';
import AppearanceSettings from './components/settings/AppearanceSettings.vue';

interface SettingsState {
  general?: Record<string, any>;
  network?: Record<string, any>;
  shortcuts?: Record<string, any>;
  notifications?: Record<string, any>;
  appearance?: Record<string, any>;
}

// 状态管理
const activeTab = ref('general');
const settings = reactive<SettingsState>({});
const loading = ref(true);

/**
 * 从后端加载所有设置
 */
const loadAllSettings = async () => {
  try {
    loading.value = true;
    const response = await ipcRenderer.invoke('systemSettings:getAll');
    if (response.success) {
      Object.assign(settings, response.data);
    } else {
      TMessage.error(`加载设置失败: ${response.error}`);
      console.error('Failed to load settings:', response.error);
    }
  } catch (error) {
    TMessage.error(`加载设置时发生错误: ${(error as Error).message}`);
    console.error('Error loading settings:', error);
  } finally {
    loading.value = false;
  }
};

/**
 * 更新特定分类的设置
 */
const handleSettingsUpdate = async (category: string) => {
  try {
    const categorySettings = settings[category as keyof SettingsState];
    if (!categorySettings) return;

    const response = await ipcRenderer.invoke('systemSettings:updateByCategory', {
      category,
      settings: categorySettings
    });

    if (response.success) {
      TMessage.success('设置更新成功');
      // 更新本地状态
      settings[category as keyof SettingsState] = response.data;
    } else {
      TMessage.error(`更新设置失败: ${response.error}`);
      console.error(`Failed to update ${category} settings:`, response.error);
    }
  } catch (error) {
    TMessage.error(`更新设置时发生错误: ${(error as Error).message}`);
    console.error(`Error updating ${category} settings:`, error);
  }
};

/**
 * 恢复默认设置
 */
const resetToDefault = async () => {
  try {
    const response = await ipcRenderer.invoke('systemSettings:resetToDefault');
    if (response.success) {
      Object.assign(settings, response.data);
      TMessage.success('已恢复默认设置');
    } else {
      TMessage.error(`恢复默认设置失败: ${response.error}`);
      console.error('Failed to reset settings:', response.error);
    }
  } catch (error) {
    TMessage.error(`恢复默认设置时发生错误: ${(error as Error).message}`);
    console.error('Error resetting settings:', error);
  }
};

// 初始化加载设置
onMounted(() => {
  loadAllSettings();
});
</script>

<style scoped>
.settings-container {
  padding: 20px;
}

.settings-card {
  height: calc(100vh - 40px);
  overflow: hidden;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.reset-button {
  margin-left: auto;
}

.settings-tabs {
  height: calc(100% - 80px);
  overflow-y: auto;
}
</style>