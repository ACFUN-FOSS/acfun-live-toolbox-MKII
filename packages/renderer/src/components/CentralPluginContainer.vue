<template>
  <div class="central-plugin-container">
    <!-- 系统页面容器 -->
    <div
      v-if="isSystemPage"
      class="system-page-container"
    >
      <component :is="systemComponent" />
    </div>

    <!-- 插件容器 -->
    <div
      v-else-if="currentPlugin"
      class="plugin-container"
    >
      <div class="plugin-header">
        <div class="plugin-info">
          <h3>{{ currentPlugin.name }}</h3>
          <span class="plugin-version">v{{ currentPlugin.version }}</span>
        </div>
        <div class="plugin-actions">
          <t-button 
            size="small" 
            variant="outline"
            :loading="isReloading"
            @click="reloadPlugin"
          >
            <template #icon>
              <t-icon name="refresh" />
            </template>
            刷新
          </t-button>
        </div>
      </div>
      
      <div
        ref="pluginContentRef"
        class="plugin-content"
      >
        <!-- Wujie 微前端容器 -->
        <WujieVue
          v-if="currentPlugin && pluginUrl"
          :key="pluginKey"
          :name="currentPlugin.id"
          :url="pluginUrl"
          :sync="false"
          :alive="true"
          :fetch="customFetch"
          :props="pluginProps"
          :attrs="{ style: 'width:100%;height:100%;display:block;' }"
          @beforeLoad="onPluginBeforeLoad"
          @beforeMount="onPluginBeforeMount"
          @afterMount="onPluginAfterMount"
          @beforeUnmount="onPluginBeforeUnmount"
          @afterUnmount="onPluginAfterUnmount"
          @loadError="onPluginLoadError"
        />
        
        <!-- 加载状态 -->
        <div
          v-if="isLoading"
          class="loading-state"
        >
          <t-loading
            size="large"
            text="正在加载插件..."
          />
        </div>
        
        <!-- 错误状态 -->
        <div
          v-if="loadError"
          class="error-state"
        >
          <div class="error-icon">
            <t-icon
              name="error-circle"
              size="48px"
            />
          </div>
          <h3>插件加载失败</h3>
          <p>{{ loadError }}</p>
          <t-button
            theme="primary"
            @click="reloadPlugin"
          >
            重新加载
          </t-button>
        </div>
      </div>
    </div>

    <!-- 默认欢迎页面 -->
    <div
      v-else
      class="welcome-page"
    >
      <div class="welcome-content">
        <div class="welcome-icon">
          <t-icon
            name="app"
            size="64px"
          />
        </div>
        <h2>欢迎使用 AcFun 直播工具箱</h2>
        <p>从左侧选择一个插件开始使用，或者安装新的插件来扩展功能。</p>
        <div class="quick-actions">
          <t-button
            theme="primary"
            @click="$emit('showInstaller')"
          >
            <template #icon>
              <t-icon name="add" />
            </template>
            安装插件
          </t-button>
          <t-button
            variant="outline"
            @click="$emit('systemNavigation', 'rooms')"
          >
            <template #icon>
              <t-icon name="home" />
            </template>
            房间管理
          </t-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import WujieVue from 'wujie-vue3';
import { getPluginHostingConfig, buildPluginPageUrl } from '../utils/hosting';
import { useRoleStore } from '../stores/role';
import { useRoomStore } from '../stores/room';
import { useDanmuStore } from '../stores/danmu';
import { usePluginStore } from '../stores/plugin';

interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  routes?: string[];
  entryUrl?: string;
}

const props = defineProps<{
  currentPlugin: Plugin | null;
  systemPage?: string;
}>();

const emit = defineEmits<{
  showInstaller: [];
  systemNavigation: [route: string];
  pluginEvent: [event: { type: string; data: any }];
}>();

// 系统页面组件映射
const systemComponents = {
  rooms: defineAsyncComponent(() => import('../pages/LiveRoomPage.vue')),
  settings: defineAsyncComponent(() => import('../pages/Settings.vue')),
  events: defineAsyncComponent(() => import('../pages/EventsHistory.vue')),
  stats: defineAsyncComponent(() => import('../pages/Stats.vue')),
  'api-docs': defineAsyncComponent(() => import('../pages/ApiDocs.vue')),
  console: defineAsyncComponent(() => import('../pages/Console.vue')),
  overlay: defineAsyncComponent(() => import('../pages/Overlay.vue'))
};

const pluginContentRef = ref<HTMLElement>();
const isLoading = ref(false);
const isReloading = ref(false);
const loadError = ref<string>('');
const pluginKey = ref(0);
// 简单遥测计数，用于统计 UI 生命周期触发与消息转发次数
const telemetry = { uiLifecycleEmits: 0, uiPostMessages: 0 };

const isSystemPage = computed(() => !!props.systemPage);
const systemComponent = computed(() => {
  return props.systemPage ? systemComponents[props.systemPage as keyof typeof systemComponents] : null;
});

const resolvedEntryUrl = ref('');

const pluginUrl = computed(() => {
  if (!props.currentPlugin) return '';
  // 优先使用统一托管解析结果，其次使用插件提供的 entryUrl，最后回退到开发服务器默认路径
  const fallbackBase = `http://localhost:3000/plugins/${props.currentPlugin.id}`;
  return resolvedEntryUrl.value || props.currentPlugin.entryUrl || `${fallbackBase}/index.html`;
});

const pluginProps = computed(() => ({
  // 传递给插件的属性
  pluginId: props.currentPlugin?.id,
  version: props.currentPlugin?.version,
  // API 桥接对象
  api: {
    // 提供给插件的 API 方法
    sendMessage: (message: any) => {
      emit('pluginEvent', { type: 'message', data: message });
    },
    getConfig: async () => {
      const id = props.currentPlugin?.id;
      if (!id || !window.electronApi?.plugin?.getConfig) {
        return {};
      }
      try {
        const res = await window.electronApi.plugin.getConfig(id);
        if (res && res.success) {
          // 返回深冻结的普通对象，保证不可变
          return deepFreeze(toPlain(res.data || {}));
        }
        console.warn('[plugin] 获取配置失败:', res?.error);
        return {};
      } catch (err) {
        console.error('[plugin] 获取配置异常:', err);
        return {};
      }
    },
    setConfig: async (config: any) => {
      const id = props.currentPlugin?.id;
      if (!id || !window.electronApi?.plugin?.updateConfig) {
        return { success: false, error: 'plugin bridge not available' } as const;
      }
      try {
        const plain = toPlain(config);
        const res = await window.electronApi.plugin.updateConfig(id, plain);
        if (!res.success) {
          console.error('[plugin] 保存配置失败:', res.error);
        }
        return res;
      } catch (err) {
        console.error('[plugin] 保存配置异常:', err);
        return { success: false, error: (err as any)?.message || 'unknown error' } as const;
      }
    },
    // Overlay 系统桥接（UI/Window -> Overlay）
    overlay: {
      create: async (options: any) => {
        try {
          return await window.electronApi?.overlay?.create?.(toPlain(options));
        } catch (e) {
          return { success: false, error: (e as any)?.message || 'overlay.create failed' } as const;
        }
      },
      update: async (overlayId: string, updates: any) => {
        try {
          return await window.electronApi?.overlay?.update?.(overlayId, toPlain(updates));
        } catch (e) {
          return { success: false, error: (e as any)?.message || 'overlay.update failed' } as const;
        }
      },
      close: async (overlayId: string) => {
        try {
          return await window.electronApi?.overlay?.close?.(overlayId);
        } catch (e) {
          return { success: false, error: (e as any)?.message || 'overlay.close failed' } as const;
        }
      },
      show: async (overlayId: string) => {
        try {
          return await window.electronApi?.overlay?.show?.(overlayId);
        } catch (e) {
          return { success: false, error: (e as any)?.message || 'overlay.show failed' } as const;
        }
      },
      hide: async (overlayId: string) => {
        try {
          return await window.electronApi?.overlay?.hide?.(overlayId);
        } catch (e) {
          return { success: false, error: (e as any)?.message || 'overlay.hide failed' } as const;
        }
      },
      bringToFront: async (overlayId: string) => {
        try {
          return await window.electronApi?.overlay?.bringToFront?.(overlayId);
        } catch (e) {
          return { success: false, error: (e as any)?.message || 'overlay.bringToFront failed' } as const;
        }
      },
      list: async () => {
        try {
          const res = await window.electronApi?.overlay?.list?.();
          return res;
        } catch (e) {
          return { success: false, error: (e as any)?.message || 'overlay.list failed' } as const;
        }
      },
      // UI/Window -> Overlay 下行消息
      send: async (overlayId: string, event: string, payload?: any) => {
        try {
          return await window.electronApi?.overlay?.send?.(overlayId, event, toPlain(payload));
        } catch (e) {
          return { success: false, error: (e as any)?.message || 'overlay.send failed' } as const;
        }
      },
      // 从 UI 层触发动作（等价于 overlay 自身 action）
      action: async (overlayId: string, action: string, data?: any) => {
        try {
          return await window.electronApi?.overlay?.action?.(overlayId, action, toPlain(data));
        } catch (e) {
          return { success: false, error: (e as any)?.message || 'overlay.action failed' } as const;
        }
      }
    }
  },
  // 共享的只读 Store 快照，供子应用只读访问
  shared: {
    readonlyStore: buildReadonlySnapshot()
  }
}));

// 自定义 fetch 函数，用于插件资源请求
function customFetch(url: string, options?: RequestInit) {
  // 可以在这里添加认证、代理等逻辑
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      // 遵循统一 Token 管理策略，不在渲染层注入占位令牌
    }
  });
}

// 深冻结（浅拷贝后的普通对象/数组）
function deepFreeze(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (value && typeof value === 'object') deepFreeze(value);
  });
  return Object.freeze(obj);
}

function toPlain<T>(value: T): any {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value as any;
  }
}

// 构建只读的 Store 快照，避免暴露可变引用
function buildReadonlySnapshot() {
  const role = useRoleStore();
  const rooms = useRoomStore();
  const danmu = useDanmuStore();
  const plugins = usePluginStore();

  const roomSummary = rooms.rooms.map((r) => ({
    id: r.id,
    title: r.title,
    coverUrl: r.coverUrl,
    status: r.status,
    isLive: r.isLive,
    viewerCount: r.viewerCount,
    lastUpdate: r.lastUpdate,
    url: r.url,
    priority: r.priority,
    label: r.label
  }));

  const snapshot = {
    role: {
      current: role.current,
      statsScope: role.statsScope,
      options: toPlain(role.options)
    },
    rooms: {
      list: roomSummary,
      liveRoomsCount: rooms.liveRooms.length,
      offlineRoomsCount: rooms.offlineRooms.length,
      totalViewers: rooms.totalViewers,
      stats: toPlain(rooms.stats)
    },
    danmu: {
      isConnected: danmu.isConnected,
      sessionState: toPlain(danmu.sessionState),
      stats: toPlain(danmu.stats)
    },
    plugins: {
      active: plugins.activePlugins.map((p) => ({ id: p.id, name: p.name, version: p.version })),
      sidebar: plugins.sidebarPlugins.map((p) => ({ id: p.id, name: p.name })),
      stats: toPlain(plugins.stats)
    }
  };

  return deepFreeze(snapshot);
}

// 插件生命周期事件处理
function onPluginBeforeLoad() {
  isLoading.value = true;
  loadError.value = '';
  // 触发 UI 打开前生命周期钩子
  if (props.currentPlugin?.id) {
    try {
      window.electronApi?.plugin?.lifecycle?.emit(
        'beforeUiOpen',
        props.currentPlugin.id,
        { pageType: 'ui', route: pluginUrl.value }
      );
      telemetry.uiLifecycleEmits++;
    } catch (e) {
      // 非阻塞：生命周期钩子触发失败不影响页面加载
      console.warn('[CentralPluginContainer] beforeUiOpen emit failed:', e);
    }
    // 向子应用转发生命周期事件
    try {
      const iframe = pluginContentRef.value?.querySelector('iframe') as HTMLIFrameElement | null;
      const targetWin = iframe?.contentWindow;
      if (targetWin) {
        targetWin.postMessage({
          type: 'plugin-event',
          pluginId: props.currentPlugin.id,
          eventType: 'lifecycle',
          event: 'beforeUiOpen',
          payload: { pageType: 'ui', route: pluginUrl.value }
        }, '*');
        telemetry.uiPostMessages++;
      }
    } catch (e) {
      console.warn('[CentralPluginContainer] post lifecycle beforeUiOpen failed:', e);
    }
  }
}

function onPluginBeforeMount() {
  // Plugin is about to mount
}

function onPluginAfterMount() {
  isLoading.value = false;
  isReloading.value = false;
  // 触发 UI 打开后生命周期钩子
  if (props.currentPlugin?.id) {
    try {
      window.electronApi?.plugin?.lifecycle?.emit(
        'afterUiOpen',
        props.currentPlugin.id,
        { pageType: 'ui', route: pluginUrl.value }
      );
      telemetry.uiLifecycleEmits++;
    } catch (e) {
      console.warn('[CentralPluginContainer] afterUiOpen emit failed:', e);
    }
    // 向子应用转发生命周期事件
    try {
      const iframe = pluginContentRef.value?.querySelector('iframe') as HTMLIFrameElement | null;
      const targetWin = iframe?.contentWindow;
      if (targetWin) {
        targetWin.postMessage({
          type: 'plugin-event',
          pluginId: props.currentPlugin.id,
          eventType: 'lifecycle',
          event: 'afterUiOpen',
          payload: { pageType: 'ui', route: pluginUrl.value }
        }, '*');
        telemetry.uiPostMessages++;
      }
    } catch (e) {
      console.warn('[CentralPluginContainer] post lifecycle afterUiOpen failed:', e);
    }
  }
  
  // 通知插件已加载
  emit('pluginEvent', { 
    type: 'mounted', 
    data: { pluginId: props.currentPlugin?.id } 
  });

  // 初始快照发送与增量更新同步
  sendReadonlyStoreEvent('readonly-store-init', buildReadonlySnapshot());
  setupReadonlyStoreSync();
}

function onPluginBeforeUnmount() {
  // Plugin is about to unmount
}

function onPluginAfterUnmount() {
  // Plugin has been unmounted
  if (props.currentPlugin?.id) {
    try {
      window.electronApi?.plugin?.lifecycle?.emit(
        'uiClosed',
        props.currentPlugin.id,
        { pageType: 'ui', route: pluginUrl.value }
      );
      telemetry.uiLifecycleEmits++;
    } catch (e) {
      console.warn('[CentralPluginContainer] uiClosed emit failed:', e);
    }
    // 向子应用转发生命周期事件
    try {
      const iframe = pluginContentRef.value?.querySelector('iframe') as HTMLIFrameElement | null;
      const targetWin = iframe?.contentWindow;
      if (targetWin) {
        targetWin.postMessage({
          type: 'plugin-event',
          pluginId: props.currentPlugin.id,
          eventType: 'lifecycle',
          event: 'uiClosed',
          payload: { pageType: 'ui', route: pluginUrl.value }
        }, '*');
        telemetry.uiPostMessages++;
      }
    } catch (e) {
      console.warn('[CentralPluginContainer] post lifecycle uiClosed failed:', e);
    }
  }
  teardownReadonlyStoreSync();
}

function onPluginLoadError(error: Error) {
  isLoading.value = false;
  isReloading.value = false;
  loadError.value = error.message || '未知错误';
  console.error('Plugin load error:', error);
}

function reloadPlugin() {
  if (!props.currentPlugin) return;
  
  isReloading.value = true;
  loadError.value = '';
  
  // 强制重新加载插件
  pluginKey.value++;
}

// 监听插件变化
watch(() => props.currentPlugin, (newPlugin, oldPlugin) => {
  if (newPlugin?.id !== oldPlugin?.id) {
    loadError.value = '';
    pluginKey.value++;
  }
}, { immediate: true });

// 通过 postMessage 将只读快照推送到子应用
function sendReadonlyStoreEvent(event: string, payload: any) {
  try {
    const iframe = pluginContentRef.value?.querySelector('iframe') as HTMLIFrameElement | null;
    const targetWin = iframe?.contentWindow;
    if (targetWin) {
      targetWin.postMessage({
        type: 'plugin-event',
        pluginId: props.currentPlugin?.id,
        eventType: 'readonly-store',
        event,
        payload
      }, '*');
    }
  } catch (e) {
    console.warn('[CentralPluginContainer] Failed to post readonly-store event:', e);
  }
}

// 简单节流函数，避免高频更新
function throttle(fn: () => void, delay: number) {
  let timer: number | null = null;
  let pending = false;
  return () => {
    if (timer) {
      pending = true;
      return;
    }
    timer = window.setTimeout(() => {
      fn();
      timer = null;
      if (pending) {
        pending = false;
        fn();
      }
    }, delay);
  };
}

const stopWatchers: Array<() => void> = [];

function setupReadonlyStoreSync() {
  const role = useRoleStore();
  const rooms = useRoomStore();
  const danmu = useDanmuStore();
  const plugins = usePluginStore();
  const schedule = throttle(() => {
    sendReadonlyStoreEvent('readonly-store-update', buildReadonlySnapshot());
  }, 300);

  stopWatchers.push(watch(() => role.current, schedule));
  stopWatchers.push(watch(() => role.statsScope, schedule));
  stopWatchers.push(watch(() => rooms.rooms, schedule, { deep: true }));
  stopWatchers.push(watch(() => rooms.stats, schedule, { deep: true }));
  stopWatchers.push(watch(() => danmu.sessionState, schedule, { deep: true }));
  stopWatchers.push(watch(() => danmu.stats, schedule, { deep: true }));
  stopWatchers.push(watch(() => plugins.stats, schedule, { deep: true }));
}

function teardownReadonlyStoreSync() {
  while (stopWatchers.length) {
    const stop = stopWatchers.pop();
    try { stop && stop(); } catch {}
  }
}

// 当插件切换时解析统一托管URL
watch(() => props.currentPlugin?.id, async (pluginId) => {
  resolvedEntryUrl.value = '';
  if (!pluginId) return;
  try {
    const conf = await getPluginHostingConfig(pluginId);
    const uiConf = conf.ui || undefined;
    const url = buildPluginPageUrl(pluginId, 'ui', uiConf || undefined);
    resolvedEntryUrl.value = url;
  } catch (err) {
    console.warn('[CentralPluginContainer] 解析统一托管URL失败:', err);
  }
}, { immediate: true });
</script>

<style scoped>
.central-plugin-container {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-page);
}

.welcome-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.welcome-content {
  text-align: center;
  max-width: 400px;
}

.welcome-icon {
  margin-bottom: 24px;
  color: var(--td-brand-color);
}

.welcome-content h2 {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.welcome-content p {
  margin: 0 0 32px 0;
  font-size: 16px;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}

.quick-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.system-page-container {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.plugin-container {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plugin-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--td-border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--td-bg-color-container);
}

.plugin-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plugin-info h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.plugin-version {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-component);
  padding: 2px 8px;
  border-radius: 12px;
}

.plugin-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.loading-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--td-bg-color-page);
}

.error-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--td-bg-color-page);
}

.error-icon {
  margin-bottom: 16px;
  color: var(--td-error-color);
}

.error-state h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: var(--td-text-color-primary);
}

.error-state p {
  margin: 0 0 24px 0;
  color: var(--td-text-color-secondary);
  text-align: center;
}

/* Wujie 容器样式 */
:deep(.wujie-container) {
  width: 100%;
  height: 100%;
}

:deep(.wujie-container iframe) {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
