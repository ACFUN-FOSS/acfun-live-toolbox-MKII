<template>
  <t-form
    :data="settings"
    :rules="formRules"
    @submit="handleSubmit"
    class="general-settings-form"
  >
    <t-form-item label="应用语言" name="language">
      <t-select v-model="settings.language">
        <t-option value="zh-CN" label="简体中文"></t-option>
        <t-option value="en-US" label="English"></t-option>
        <t-option value="ja-JP" label="日本語"></t-option>
      </t-select>
    </t-form-item>

    <t-form-item label="主题模式" name="themeMode">
      <t-radio-group v-model="settings.themeMode">
        <t-radio value="light">浅色模式</t-radio>
        <t-radio value="dark">深色模式</t-radio>
        <t-radio value="auto">跟随系统</t-radio>
      </t-radio-group>
    </t-form-item>

    <t-form-item label="启动行为" name="startupBehavior">
      <t-select v-model="settings.startupBehavior">
        <t-option value="lastSession" label="恢复上次会话"></t-option>
        <t-option value="dashboard" label="显示仪表盘"></t-option>
        <t-option value="login" label="显示登录界面"></t-option>
      </t-select>
    </t-form-item>

    <t-form-item label="自动检查更新" name="autoCheckUpdates">
      <t-switch v-model="settings.autoCheckUpdates" />
      <div class="form-hint">启动时自动检查应用更新</div>
    </t-form-item>

    <t-form-item label="自动清理缓存" name="autoCleanCache">
      <t-switch v-model="settings.autoCleanCache" />
      <t-input-number
        v-model="settings.cacheRetentionDays"
        :min="1"
        :max="90"
        :disabled="!settings.autoCleanCache"
        class="cache-days-input"
      />
      <span class="cache-days-text">天以上的缓存</span>
    </t-form-item>

    <t-form-item label="日志级别" name="logLevel">
      <t-select v-model="settings.logLevel">
        <t-option value="error" label="仅错误"></t-option>
        <t-option value="warn" label="警告和错误"></t-option>
        <t-option value="info" label="信息、警告和错误"></t-option>
        <t-option value="debug" label="调试模式（详细日志）"></t-option>
      </t-select>
    </t-form-item>

    <div class="form-actions">
      <t-button type="submit" theme="primary">保存设置</t-button>
      <t-button @click="handleReset" variant="outline">重置</t-button>
    </div>
  </t-form>
</template>

<script setup lang="ts">
import { ref, reactive, watch, toRefs } from 'vue';
import { TFormProps, TFormItemProps } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';

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

// 表单验证规则
const formRules = {
  language: [{ required: true, message: '请选择应用语言', type: 'string' }],
  themeMode: [{ required: true, message: '请选择主题模式', type: 'string' }],
  startupBehavior: [{ required: true, message: '请选择启动行为', type: 'string' }],
  logLevel: [{ required: true, message: '请选择日志级别', type: 'string' }],
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
</script>

<style scoped>
.general-settings-form {
  max-width: 600px;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--t-color-text-secondary);
}

.cache-days-input {
  width: 100px;
  display: inline-block;
  margin: 0 8px;
}

.cache-days-text {
  margin-left: 8px;
  color: var(--t-color-text-secondary);
}

.form-actions {
  margin-top: 30px;
  display: flex;
  gap: 12px;
}
</style>