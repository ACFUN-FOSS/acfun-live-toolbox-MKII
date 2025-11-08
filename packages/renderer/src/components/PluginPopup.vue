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
    <!-- 弹窗内容渲染（支持 Wujie Window） -->
    <div class="popup-content">
      <!-- Wujie Window 子应用渲染：当声明 window 托管且未提供自定义内容时 -->
      <WujieVue
        v-if="isWujieWindow"
        class="wujie-window-content"
        :key="wujieKey"
        :name="wujieName"
        :url="wujieUrl"
        :sync="false"
        :alive="false"
        :fetch="customFetch"
        :props="wujieProps"
        @beforeLoad="onWindowBeforeLoad"
        @beforeMount="onWindowBeforeMount"
        @afterMount="onWindowAfterMount"
        @beforeUnmount="onWindowBeforeUnmount"
        @afterUnmount="onWindowAfterUnmount"
        @loadError="onWindowLoadError"
      />

      <!-- 自定义内容渲染（若存在 content 则优先渲染自定义） -->
      <template v-else>
        <!-- HTML内容 -->
        <div 
          v-if="popup.content && popup.contentType === 'html'" 
          class="html-content"
          v-html="popup.content"
        />
        
        <!-- 组件内容 -->
        <component 
          :is="popup.content" 
          v-else-if="popup.content && popup.contentType === 'component'"
          v-bind="popup.props || {}"
          @action="handleAction"
        />
        
        <!-- 文本内容 -->
        <div
          v-else-if="popup.content"
          class="text-content"
        >
          {{ popup.content }}
        </div>
      </template>
    </div>

    <!-- 自定义操作按钮 -->
    <template
      v-if="popup.actions && popup.actions.length > 0"
      #footer
    >
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
          <t-icon
            v-if="action.icon"
            :name="action.icon"
          />
          {{ action.label }}
        </t-button>
      </div>
    </template>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import WujieVue from 'wujie-vue3';
import { Dialog as TDialog, Button as TButton, Icon as TIcon } from 'tdesign-vue-next';
import { getPluginHostingConfig, buildPluginPageUrl, resolvePrimaryHostingType } from '../utils/hosting';
import { useRoleStore } from '../stores/role';
import { useRoomStore } from '../stores/room';
import { useDanmuStore } from '../stores/danmu';

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
  resolveWujieWindowConfig();
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// --------------------------
// Wujie Window 托管与只读仓库注入
// --------------------------

const isWujieWindow = ref(false);
const wujieUrl = ref('');
const wujieName = ref('');
const wujieKey = ref('');
const wujieProps = ref<Record<string, any>>({});

function customFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });
}

function toPlain<T>(value: T): any {
  try { return JSON.parse(JSON.stringify(value)); } catch { return value as any; }
}

function deepFreeze(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (value && typeof value === 'object') deepFreeze(value);
  });
  return Object.freeze(obj);
}

function buildReadonlySnapshotForWindow() {
  const role = useRoleStore();
  const rooms = useRoomStore();
  const danmu = useDanmuStore();
  const roomSummary = rooms.rooms.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    isLive: r.isLive,
    viewerCount: r.viewerCount,
    lastUpdate: r.lastUpdate,
  }));
  const snapshot = {
    role: { current: role.current, statsScope: role.statsScope },
    rooms: {
      list: roomSummary,
      liveRoomsCount: rooms.liveRooms.length,
      totalViewers: rooms.totalViewers,
    },
    danmu: {
      isConnected: danmu.isConnected,
      stats: toPlain(danmu.stats),
    },
  };
  return deepFreeze(snapshot);
}

async function resolveWujieWindowConfig() {
  try {
    // 若提供了自定义内容（text/html/component），保持现有渲染路径，不启用 Wujie Window
    if (props.popup.content) {
      isWujieWindow.value = false;
      return;
    }
    // 必须有 pluginId 才尝试解析 window 托管入口
    const pluginId = props.popup.pluginId;
    if (!pluginId) {
      isWujieWindow.value = false;
      return;
    }
    const primary = await resolvePrimaryHostingType(pluginId);
    // UI/Window 互斥：仅当 primary 为 Window 时渲染 Wujie Window
    if (primary.type !== 'window') {
      isWujieWindow.value = false;
      return;
    }
    const url = buildPluginPageUrl(pluginId, 'window', primary.item || undefined);
    isWujieWindow.value = true;
    wujieUrl.value = url;
    wujieName.value = `window-${pluginId}`;
    wujieKey.value = `${pluginId}-${props.popup.id}-${Date.now()}`;
    wujieProps.value = {
      popupId: props.popup.id,
      pluginId,
      api: {
        close: async () => {
          try { await (window as any).electronApi?.plugin?.popup?.close?.(pluginId, props.popup.id); } catch (e) { console.warn('[PluginPopup] popup.close bridge failed:', e); }
        },
        action: async (actionId: string) => {
          try { await (window as any).electronApi?.plugin?.popup?.action?.(pluginId, props.popup.id, actionId); } catch (e) { console.warn('[PluginPopup] popup.action bridge failed:', e); }
        },
        bringToFront: async () => {
          try { await (window as any).electronApi?.plugin?.popup?.bringToFront?.(pluginId, props.popup.id); } catch (e) { console.warn('[PluginPopup] popup.bringToFront bridge failed:', e); }
        },
      },
      shared: {
        readonlyStore: buildReadonlySnapshotForWindow(),
      },
    };
  } catch (err) {
    console.error('[PluginPopup] resolveWujieWindowConfig error:', err);
    isWujieWindow.value = false;
  }
}

// 向子窗口应用转发生命周期事件（postMessage）
function postWindowLifecycle(event: string, payload?: any) {
  try {
    const dialogEl = document.querySelector('.plugin-popup');
    const iframe = dialogEl?.querySelector('iframe') as HTMLIFrameElement | null;
    const targetWin = iframe?.contentWindow;
    if (targetWin && isWujieWindow.value) {
      targetWin.postMessage({
        type: 'window-event',
        pluginId: props.popup.pluginId,
        popupId: props.popup.id,
        eventType: 'lifecycle',
        event,
        payload
      }, '*');
    }
  } catch (e) {
    console.warn('[PluginPopup] post window lifecycle failed:', e);
  }
}

function onWindowBeforeLoad() {
  try { (window as any).electronApi?.plugin?.lifecycle?.emit?.('beforeWindowOpen', props.popup.pluginId, { popupId: props.popup.id }); } catch {}
  postWindowLifecycle('beforeWindowOpen', { popupId: props.popup.id });
}
function onWindowBeforeMount() {
  // 可按需扩展
}
function onWindowAfterMount() {
  try { (window as any).electronApi?.plugin?.lifecycle?.emit?.('afterWindowOpen', props.popup.pluginId, { popupId: props.popup.id }); } catch {}
  postWindowLifecycle('afterWindowOpen', { popupId: props.popup.id });
}
function onWindowBeforeUnmount() {
  // 可按需扩展
}
function onWindowAfterUnmount() {
  try { (window as any).electronApi?.plugin?.lifecycle?.emit?.('windowClosed', props.popup.pluginId, { popupId: props.popup.id }); } catch {}
  postWindowLifecycle('windowClosed', { popupId: props.popup.id });
}
function onWindowLoadError(err: any) {
  console.error('Wujie window load error:', err);
}

// 当弹窗属性变化时重新解析
// 注意：不影响已有自定义内容渲染路径
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _watchKey = computed(() => [props.popup.id, props.popup.pluginId, props.popup.content, props.popup.contentType]);
// 手动触发解析以避免引入额外 watch 复杂度
//（现有 onMounted 已调用；父级更新时由 PluginPopupManager 重新创建组件实例触发）
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
