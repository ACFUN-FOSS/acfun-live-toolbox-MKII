<template>
  <div class="shortcut-input-container">
    <t-input
      v-model="displayValue"
      :readonly="true"
      :placeholder="placeholder"
      class="shortcut-input"
      @focus="startListening"
    />
    <t-tooltip :content="helpText" placement="right">
      <t-icon name="question-circle" class="help-icon" />
    </t-tooltip>
    <t-button
      v-if="isListening"
      theme="danger"
      size="small"
      class="cancel-button"
      @click="stopListening(false)"
    >
      取消
    </t-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { TMessage } from 'tdesign-vue-next';

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

// 状态管理
const displayValue = ref('');
const isListening = ref(false);
const helpText = ref('点击输入框开始录制快捷键');
const placeholder = ref(props.placeholder || '按ESC取消，点击输入框开始录制');
const modifierKeys = ref<Record<string, boolean>>({
  ctrl: false,
  shift: false,
  alt: false,
  meta: false
});
const keyCode = ref('');

// 格式化快捷键显示文本
const formatShortcutText = (shortcut: string): string => {
  if (!shortcut) return '';
  const parts = shortcut.split('+');
  return parts.map(part => {
    switch (part.toLowerCase()) {
      case 'ctrl': return 'Ctrl';
      case 'shift': return 'Shift';
      case 'alt': return 'Alt';
      case 'meta': return 'Win';
      default: return part.toUpperCase();
    }
  }).join('+');
};

// 监听props变化更新显示
watch(
  () => props.modelValue,
  (newVal) => {
    displayValue.value = formatShortcutText(newVal);
  },
  { immediate: true }
);

/**
 * 开始监听快捷键输入
 */
const startListening = () => {
  if (isListening.value) return;

  isListening.value = true;
  displayValue.value = '请按下快捷键...';
  helpText.value = '按下ESC取消录制，支持Ctrl/Shift/Alt/Win组合键';

  // 重置状态
  modifierKeys.value = {
    ctrl: false,
    shift: false,
    alt: false,
    meta: false
  };
  keyCode.value = '';

  // 添加事件监听
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
};

/**
 * 停止监听快捷键输入
 */
const stopListening = (saveValue = true) => {
  if (!isListening.value) return;

  isListening.value = false;
  helpText.value = '点击输入框开始录制快捷键';
  displayValue.value = saveValue ? formatShortcutText(props.modelValue) : displayValue.value;

  // 移除事件监听
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
};

/**
 * 处理按键按下事件
 */
const handleKeyDown = (e: KeyboardEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // ESC键取消
  if (e.key === 'Escape') {
    stopListening(false);
    return;
  }

  // 更新修饰键状态
  modifierKeys.value.ctrl = e.ctrlKey;
  modifierKeys.value.shift = e.shiftKey;
  modifierKeys.value.alt = e.altKey;
  modifierKeys.value.meta = e.metaKey;

  // 过滤掉只按下修饰键的情况
  const key = getValidKey(e.key);
  if (!key) {
    return;
  }

  keyCode.value = key;
  updateDisplayValue();
};

/**
 * 处理按键释放事件
 */
const handleKeyUp = (e: KeyboardEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // 只有在有有效按键时才保存
  if (keyCode.value) {
    saveShortcut();
  }
};

/**
 * 获取有效的按键名称
 */
const getValidKey = (key: string): string => {
  // 过滤修饰键
  if (['Control', 'Shift', 'Alt', 'Meta', ''].includes(key)) {
    return '';
  }

  // 特殊键映射
  const keyMap: Record<string, string> = {
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Enter': 'Enter',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Tab': 'Tab',
    'Space': 'Space',
    'Escape': 'Escape',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown',
    'F1': 'F1',
    'F2': 'F2',
    'F3': 'F3',
    'F4': 'F4',
    'F5': 'F5',
    'F6': 'F6',
    'F7': 'F7',
    'F8': 'F8',
    'F9': 'F9',
    'F10': 'F10',
    'F11': 'F11',
    'F12': 'F12'
  };

  return keyMap[key] || key;
};

/**
 * 更新显示值
 */
const updateDisplayValue = () => {
  const parts: string[] = [];

  if (modifierKeys.value.ctrl) parts.push('Ctrl');
  if (modifierKeys.value.shift) parts.push('Shift');
  if (modifierKeys.value.alt) parts.push('Alt');
  if (modifierKeys.value.meta) parts.push('Win');
  if (keyCode.value) parts.push(keyCode.value);

  displayValue.value = parts.join('+') || '请按下快捷键...';
};

/**
 * 保存快捷键设置
 */
const saveShortcut = () => {
  const parts: string[] = [];

  if (modifierKeys.value.ctrl) parts.push('ctrl');
  if (modifierKeys.value.shift) parts.push('shift');
  if (modifierKeys.value.alt) parts.push('alt');
  if (modifierKeys.value.meta) parts.push('meta');
  if (keyCode.value) parts.push(keyCode.value.toLowerCase());

  // 至少需要一个修饰键和一个普通键
  if (parts.length < 2) {
    TMessage.warning('快捷键至少需要一个修饰键和一个普通键');
    stopListening(false);
    return;
  }

  const shortcut = parts.join('+');
  emit('update:modelValue', shortcut);
  TMessage.success('快捷键设置成功');
  stopListening(true);
};

// 组件销毁前确保移除事件监听
onBeforeUnmount(() => {
  if (isListening.value) {
    stopListening(false);
  }
});
</script>

<style scoped>
.shortcut-input-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shortcut-input {
  flex: 1;
}

.help-icon {
  color: var(--t-color-text-secondary);
  cursor: help;
}

.cancel-button {
  width: 60px;
}
</style>