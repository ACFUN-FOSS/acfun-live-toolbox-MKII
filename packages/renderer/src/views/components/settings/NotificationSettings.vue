<template>
  <t-form
    :data="settings"
    @submit="handleSubmit"
    class="notification-settings-form"
  >
    <t-form-item label="启用通知" name="enableNotifications">
      <t-switch v-model="settings.enableNotifications" />
      <div class="form-hint">启用后将接收系统通知</div>
    </t-form-item>

    <t-form-item
      v-if="settings.enableNotifications"
      label="通知类型"
      name="notificationTypes"
    >
      <t-checkbox-group v-model="settings.notificationTypes">
        <t-checkbox value="liveStatus" label="直播状态变更"></t-checkbox>
        <t-checkbox value="newFollower" label="新粉丝通知"></t-checkbox>
        <t-checkbox value="giftReceived" label="礼物接收通知"></t-checkbox>
        <t-checkbox value="commentHighlight" label="评论高亮通知"></t-checkbox>
        <t-checkbox value="systemUpdate" label="系统更新通知"></t-checkbox>
        <t-checkbox value="errorAlert" label="错误告警通知"></t-checkbox>
      </t-checkbox-group>
    </t-form-item>

    <t-form-item
      v-if="settings.enableNotifications"
      label="通知声音"
      name="notificationSound"
    >
      <t-switch v-model="settings.notificationSound" />
      <t-select
        v-if="settings.notificationSound"
        v-model="settings.soundType"
        style="width: 200px; margin-left: 16px"
      >
        <t-option value="default" label="默认提示音"></t-option>
        <t-option value="soft" label="轻柔提示音"></t-option>
        <t-option value="loud" label="响亮提示音"></t-option>
      </t-select>
    </t-form-item>

    <t-form-item
      v-if="settings.enableNotifications"
      label="通知显示时长"
      name="notificationDuration"
    >
      <t-slider
        v-model="settings.notificationDuration"
        :min="3"
        :max="15"
        :step="1"
        :marks="{ 3: '3秒', 15: '15秒' }"
      />
      <div class="slider-value">{{ settings.notificationDuration }}秒</div>
    </t-form-item>

    <t-form-item
      v-if="settings.enableNotifications"
      label="桌面通知权限"
      name="desktopNotificationPermission"
    >
      <t-tag :theme="permissionTheme">{{ permissionStatusText }}</t-tag>
      <t-button
        v-if="permissionStatus !== 'granted'"
        style="margin-left: 16px"
        @click="requestNotificationPermission"
      >
        请求权限
      </t-button>
    </t-form-item>

    <t-form-item
      v-if="settings.enableNotifications"
      label="免打扰时段"
      name="doNotDisturb"
    >
      <t-switch v-model="settings.doNotDisturb" />
      <div v-if="settings.doNotDisturb" class="dnd-time-picker">
        <t-time-picker
          v-model="settings.dndStartTime"
          format="HH:mm"
          :placeholder="'开始时间'"
        />
        <span class="time-separator">至</span>
        <t-time-picker
          v-model="settings.dndEndTime"
          format="HH:mm"
          :placeholder="'结束时间'"
        />
      </div>
    </t-form-item>

    <div class="form-actions">
      <t-button type="submit" theme="primary">保存设置</t-button>
      <t-button @click="handleReset" variant="outline">重置</t-button>
    </div>
  </t-form>
</template>

<script setup lang="ts">
import { ref, reactive, watch, toRefs, onMounted } from 'vue';
import { TMessage, TTag } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';

const props = defineProps<{
  settings: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'update-settings'): void;
}>();

// 状态管理
const permissionStatus = ref('default');
const permissionStatusText = ref('未请求');
const permissionTheme = ref('default');

// 深拷贝初始设置用于重置功能
const initialSettings = JSON.parse(JSON.stringify(props.settings));
const formData = reactive({ ...props.settings });
const settings = toRefs(formData);

/**
 * 获取通知权限状态
 */
const checkNotificationPermission = async () => {
  try {
    const response = await ipcRenderer.invoke('notification:getPermissionStatus');
    if (response.success) {
      updatePermissionStatus(response.data);
    }
  } catch (error) {
    console.error('Error checking notification permission:', error);
  }
};

/**
 * 请求通知权限
 */
const requestNotificationPermission = async () => {
  try {
    const response = await ipcRenderer.invoke('notification:requestPermission');
    if (response.success) {
      updatePermissionStatus(response.data);
      TMessage.success('通知权限已授予');
    } else {
      TMessage.error('获取通知权限失败');
    }
  } catch (error) {
    TMessage.error(`请求权限失败: ${(error as Error).message}`);
  }
};

/**
 * 更新权限状态显示
 */
const updatePermissionStatus = (status: string) => {
  permissionStatus.value = status;
  switch (status) {
    case 'granted':
      permissionStatusText.value = '已允许';
      permissionTheme.value = 'success';
      break;
    case 'denied':
      permissionStatusText.value = '已拒绝';
      permissionTheme.value = 'danger';
      break;
    default:
      permissionStatusText.value = '未请求';
      permissionTheme.value = 'default';
  }
};

/**
 * 提交表单
 */
const handleSubmit = (e: SubmitEvent) => {
  e.preventDefault();
  emit('update-settings');
};

/**
 * 重置表单到初始状态
 */
const handleReset = () => {
  Object.assign(formData, initialSettings);
};

// 监听设置变化并通知父组件
watch(
  formData,
  (newVal) => {
    // 实时更新父组件的settings
    props.settings = { ...newVal };
  },
  { deep: true }
);

// 组件挂载时检查权限状态
onMounted(() => {
  checkNotificationPermission();
});
</script>

<style scoped>
.notification-settings-form {
  max-width: 600px;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--t-color-text-secondary);
}

.dnd-time-picker {
  display: flex;
  align-items: center;
  margin-top: 12px;
}

.time-separator {
  margin: 0 12px;
  color: var(--t-color-text-secondary);
}

.slider-value {
  margin-top: 8px;
  text-align: center;
  color: var(--t-color-text-secondary);
  font-size: 12px;
}

.form-actions {
  margin-top: 30px;
  display: flex;
  gap: 12px;
}
</style>