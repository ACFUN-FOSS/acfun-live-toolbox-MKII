<template>
  <t-form
    :data="settings"
    @submit="handleSubmit"
    class="appearance-settings-form"
  >
    <t-form-item label="界面主题" name="theme">
      <t-select v-model="settings.theme">
        <t-option value="default" label="默认主题"></t-option>
        <t-option value="blue" label="蓝色主题"></t-option>
        <t-option value="purple" label="紫色主题"></t-option>
        <t-option value="green" label="绿色主题"></t-option>
        <t-option value="custom" label="自定义主题"></t-option>
      </t-select>
    </t-form-item>

    <t-form-item
      v-if="settings.theme === 'custom'"
      label="主色调"
      name="primaryColor"
    >
      <t-color-picker v-model="settings.primaryColor" />
      <div class="color-preview" :style="{ backgroundColor: settings.primaryColor }"></div>
    </t-form-item>

    <t-form-item
      v-if="settings.theme === 'custom'"
      label="辅助色"
      name="secondaryColor"
    >
      <t-color-picker v-model="settings.secondaryColor" />
      <div class="color-preview" :style="{ backgroundColor: settings.secondaryColor }"></div>
    </t-form-item>

    <t-form-item label="界面缩放" name="interfaceScale">
      <t-slider
        v-model="settings.interfaceScale"
        :min="80"
        :max="150"
        :step="5"
        :marks="{ 80: '80%', 100: '100%', 120: '120%', 150: '150%' }"
      />
      <div class="slider-value">{{ settings.interfaceScale }}%</div>
    </t-form-item>

    <t-form-item label="紧凑模式" name="compactMode">
      <t-switch v-model="settings.compactMode" />
      <div class="form-hint">减少界面元素间距，适合小屏幕使用</div>
    </t-form-item>

    <t-form-item label="导航栏位置" name="navbarPosition">
      <t-radio-group v-model="settings.navbarPosition">
        <t-radio value="top">顶部导航</t-radio>
        <t-radio value="left">左侧导航</t-radio>
        <t-radio value="right">右侧导航</t-radio>
      </t-radio-group>
    </t-form-item>

    <t-form-item label="显示动画效果" name="enableAnimations">
      <t-switch v-model="settings.enableAnimations" />
      <div class="form-hint">启用或禁用界面过渡动画效果</div>
    </t-form-item>

    <t-form-item label="自定义背景" name="customBackground">
      <t-switch v-model="settings.customBackground" />
      <t-upload
        v-if="settings.customBackground"
        :accept="['image/png', 'image/jpeg', 'image/svg+xml']"
        :max-size="5 * 1024 * 1024"
        @success="handleBackgroundUpload"
      >
        <t-button variant="outline">选择背景图片</t-button>
      </t-upload>
      <div v-if="settings.backgroundImage"
        class="background-preview"
        :style="{ backgroundImage: `url(${settings.backgroundImage})` }"
      ></div>
    </t-form-item>

    <div class="form-actions">
      <t-button type="submit" theme="primary">保存设置</t-button>
      <t-button @click="handleReset" variant="outline">重置</t-button>
      <t-button @click="applyThemePreview" variant="outline" style="margin-left: auto;">预览效果</t-button>
    </div>
  </t-form>
</template>

<script setup lang="ts">
import { ref, reactive, watch, toRefs } from 'vue';
import { TMessage } from 'tdesign-vue-next';
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

/**
 * 处理背景图片上传
 */
const handleBackgroundUpload = async (files: any) => {
  try {
    const file = files[0];
    if (!file) return;

    // 读取图片数据并转换为base64
    const reader = new FileReader();
    reader.onload = (e) => {
      formData.backgroundImage = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  } catch (error) {
    TMessage.error(`图片上传失败: ${(error as Error).message}`);
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

/**
 * 应用主题预览
 */
const applyThemePreview = () => {
  // 在实际应用中，这里可以实现主题的实时预览功能
  TMessage.info('主题预览功能已触发，实际应用中会立即应用当前设置');
};

// 监听设置变化并通知父组件
watch(
  formData,
  (newVal) => {
    props.settings = { ...newVal };
  },
  { deep: true }
);
</script>

<style scoped>
.appearance-settings-form {
  max-width: 600px;
}

.color-preview {
  width: 30px;
  height: 30px;
  border-radius: 4px;
  margin-top: 8px;
  border: 1px solid var(--t-color-border);
}

.slider-value {
  margin-top: 8px;
  text-align: center;
  color: var(--t-color-text-secondary);
  font-size: 12px;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--t-color-text-secondary);
}

.background-preview {
  width: 200px;
  height: 100px;
  margin-top: 12px;
  border-radius: 4px;
  background-size: cover;
  background-position: center;
  border: 1px dashed var(--t-color-border);
}

.form-actions {
  margin-top: 30px;
  display: flex;
  gap: 12px;
}
</style>