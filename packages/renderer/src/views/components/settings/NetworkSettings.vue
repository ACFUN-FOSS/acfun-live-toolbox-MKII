<template>
  <t-form
    :data="settings"
    :rules="formRules"
    @submit="handleSubmit"
    class="network-settings-form"
  >
    <t-form-item label="代理模式" name="proxyMode">
      <t-select v-model="settings.proxyMode">
        <t-option value="noProxy" label="不使用代理"></t-option>
        <t-option value="systemProxy" label="使用系统代理"></t-option>
        <t-option value="manualProxy" label="手动配置代理"></t-option>
      </t-select>
    </t-form-item>

    <t-form-item
      v-if="settings.proxyMode === 'manualProxy'"
      label="代理服务器"
      name="proxyServer"
    >
      <t-input v-model="settings.proxyServer" placeholder="例如: http://127.0.0.1:8080" />
    </t-form-item>

    <t-form-item
      v-if="settings.proxyMode === 'manualProxy'"
      label="绕过代理主机"
      name="noProxyHosts"
    >
      <t-input
        v-model="settings.noProxyHosts"
        placeholder="用逗号分隔，例如: localhost,127.0.0.1"
      />
      <div class="form-hint">这些主机将不使用代理连接</div>
    </t-form-item>

    <t-form-item label="请求超时时间" name="requestTimeout">
      <t-input-number
        v-model="settings.requestTimeout"
        :min="500"
        :max="30000"
        :step="100"
        suffix="毫秒"
      />
    </t-form-item>

    <t-form-item label="最大重试次数" name="maxRetryCount">
      <t-input-number
        v-model="settings.maxRetryCount"
        :min="0"
        :max="10"
        :step="1"
      />
    </t-form-item>

    <t-form-item label="启用数据压缩" name="enableDataCompression">
      <t-switch v-model="settings.enableDataCompression" />
      <div class="form-hint">启用后将压缩网络传输数据，减少流量消耗</div>
    </t-form-item>

    <t-form-item label="长连接保持时间" name="keepAliveTimeout">
      <t-input-number
        v-model="settings.keepAliveTimeout"
        :min="0"
        :max="300"
        :step="5"
        suffix="秒"
      />
      <div class="form-hint">设置为0表示禁用长连接</div>
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
  proxyMode: [{ required: true, message: '请选择代理模式', type: 'string' }],
  proxyServer: [
    { required: settings.proxyMode.value === 'manualProxy', message: '请输入代理服务器地址', type: 'string' },
    { type: 'url', message: '请输入有效的URL格式', trigger: 'blur', required: settings.proxyMode.value === 'manualProxy' }
  ],
  requestTimeout: [{ required: true, message: '请设置请求超时时间', type: 'number' }],
  maxRetryCount: [{ required: true, message: '请设置最大重试次数', type: 'number' }],
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
.network-settings-form {
  max-width: 600px;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--t-color-text-secondary);
}

.form-actions {
  margin-top: 30px;
  display: flex;
  gap: 12px;
}
</style>