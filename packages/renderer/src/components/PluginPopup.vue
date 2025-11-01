<template>
  <t-dialog
    v-model:visible="visible"
    :header="popup.title"
    :width="popup.width || '500px'"
    :top="popup.top || '15vh'"
    :mode="popup.mode || 'modal'"
    :close-on-overlay-click="popup.closeOnOverlayClick !== false"
    :close-on-esc-keydown="popup.closeOnEscKeydown !== false"
    :show-overlay="popup.showOverlay !== false"
    :z-index="popup.zIndex || 2000"
    :class="['plugin-popup', popup.className]"
    :style="dialogStyle"
    @close="handleClose"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <!-- 自定义内容渲染 -->
    <div class="popup-content" v-if="popup.content">
      <!-- HTML内容 -->
      <div 
        v-if="popup.contentType === 'html'" 
        v-html="popup.content"
        class="html-content"
      ></div>
      
      <!-- 组件内容 -->
      <component 
        v-else-if="popup.contentType === 'component'" 
        :is="popup.content"
        v-bind="popup.props || {}"
        @action="handleAction"
      />
      
      <!-- 文本内容 -->
      <div v-else class="text-content">
        {{ popup.content }}
      </div>
    </div>

    <!-- 自定义操作按钮 -->
    <template #footer v-if="popup.actions && popup.actions.length > 0">
      <div class="popup-actions">
        <t-button
          v-for="action in popup.actions"
          :key="action.id"
          :theme="action.theme || 'default'"
          :variant="action.variant || 'base'"
          :size="action.size || 'medium'"
          :disabled="action.disabled"
          :loading="actionLoading[action.id]"
          @click="handleAction(action.id, action)"
        >
          <t-icon v-if="action.icon" :name="action.icon" />
          {{ action.label }}
        </t-button>
      </div>
    </template>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Dialog as TDialog, Button as TButton, Icon as TIcon } from 'tdesign-vue-next';

export interface PopupAction {
  id: string;
  label: string;
  theme?: 'primary' | 'success' | 'warning' | 'danger' | 'default';
  variant?: 'base' | 'outline' | 'dashed' | 'text';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  disabled?: boolean;
}

export interface PopupOptions {
  id: string;
  pluginId: string;
  title: string;
  content?: string;
  contentType?: 'text' | 'html' | 'component';
  props?: Record<string, any>;
  width?: string;
  height?: string;
  top?: string;
  mode?: 'modal' | 'modeless';
  closeOnOverlayClick?: boolean;
  closeOnEscKeydown?: boolean;
  showOverlay?: boolean;
  zIndex?: number;
  className?: string;
  actions?: PopupAction[];
  // 新增样式选项
  position?: 'center' | 'top' | 'bottom' | { x: number; y: number };
  style?: {
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
  };
}

const props = defineProps<{
  popup: PopupOptions;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'close': [popupId: string];
  'action': [popupId: string, actionId: string, action?: PopupAction];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
});

// 计算弹窗样式
const dialogStyle = computed(() => {
  const style: Record<string, string> = {};
  
  // 处理自定义位置
  if (props.popup.position) {
    if (typeof props.popup.position === 'object') {
      style.left = `${props.popup.position.x}px`;
      style.top = `${props.popup.position.y}px`;
      style.transform = 'none';
    } else {
      switch (props.popup.position) {
        case 'top':
          style.top = '10vh';
          break;
        case 'bottom':
          style.top = '80vh';
          break;
        case 'center':
        default:
          style.top = '50%';
          style.transform = 'translateY(-50%)';
          break;
      }
    }
  }
  
  // 处理自定义样式
  if (props.popup.style) {
    if (props.popup.style.backgroundColor) {
      style.backgroundColor = props.popup.style.backgroundColor;
    }
    if (props.popup.style.borderRadius !== undefined) {
      style.borderRadius = `${props.popup.style.borderRadius}px`;
    }
    if (props.popup.style.padding !== undefined) {
      style.padding = `${props.popup.style.padding}px`;
    }
  }
  
  return style;
});

const actionLoading = ref<Record<string, boolean>>({});

// 处理弹窗关闭
const handleClose = () => {
  emit('close', props.popup.id);
};

// 处理确认按钮
const handleConfirm = () => {
  emit('action', props.popup.id, 'confirm');
};

// 处理取消按钮
const handleCancel = () => {
  emit('action', props.popup.id, 'cancel');
};

// 处理自定义动作
const handleAction = async (actionId: string, action?: PopupAction) => {
  try {
    actionLoading.value[actionId] = true;
    emit('action', props.popup.id, actionId, action);
  } finally {
    actionLoading.value[actionId] = false;
  }
};

// 监听键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.popup.closeOnEscKeydown !== false) {
    handleClose();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.plugin-popup {
  --popup-border-radius: 8px;
  --popup-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.popup-content {
  min-height: 60px;
  max-height: 70vh;
  overflow-y: auto;
}

.html-content {
  line-height: 1.6;
}

.html-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.html-content :deep(pre) {
  background: var(--td-bg-color-container);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

.text-content {
  line-height: 1.6;
  color: var(--td-text-color-primary);
}

.popup-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.popup-actions .t-button {
  min-width: 80px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .plugin-popup :deep(.t-dialog) {
    width: 90vw !important;
    margin: 5vh auto;
  }
  
  .popup-content {
    max-height: 60vh;
  }
  
  .popup-actions {
    flex-direction: column-reverse;
  }
  
  .popup-actions .t-button {
    width: 100%;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .plugin-popup :deep(.t-dialog) {
    border: 2px solid var(--td-border-level-2-color);
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .plugin-popup :deep(.t-dialog) {
    transition: none;
  }
}
</style>