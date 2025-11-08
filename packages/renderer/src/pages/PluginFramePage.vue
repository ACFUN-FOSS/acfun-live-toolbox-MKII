<template>
  <div class="plugin-frame-page" :class="{ 'base-example-full': isBaseExample }">
    <!-- 移除中央容器使用；非 base-example 统一以右侧主显示区域全屏 iframe 承载插件 UI -->
    <div v-if="!isBaseExample" class="plugin-ui-full-container">
      <iframe
        id="plugin-ui"
        ref="uiIframe"
        :src="pageUrl"
        title="Plugin UI"
        frameborder="0"
        scrolling="auto"
      />
    </div>

    <!-- base-example 全屏 iframe 容器 -->
    <div
      v-if="isBaseExample"
      class="base-example-container"
    >
      <iframe
        id="base-example"
        ref="baseIframe"
        :src="pageUrl"
        title="Base Example"
        frameborder="0"
        scrolling="auto"
      />
    </div>

    <!-- 插件UI容器（根据路由参数:id加载对应插件的UI） -->
    <!-- 原中央容器承载已移除，保留管理视图相关卡片（状态、运行、监控）在后续需要时可恢复显示 -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePluginStore } from '../stores/plugin';
import type { PluginInfo } from '../stores/plugin';
import { useRoomStore } from '../stores/room';
import { useUiStore } from '../stores/ui';
import { useRoleStore } from '../stores/role';
import { useAccountStore } from '../stores/account';

const pluginStore = usePluginStore();
const route = useRoute();
const roomStore = useRoomStore();
const uiStore = useUiStore();
const roleStore = useRoleStore();
const accountStore = useAccountStore();

// iframe 支撑：路由解析、URL 构造与向子页传值（统一承载）
const baseIframe = ref<HTMLIFrameElement | null>(null);
const uiIframe = ref<HTMLIFrameElement | null>(null);
const pluginId = computed(() => String((route.params as any).plugname || '').trim());
const isBaseExample = computed(() => pluginId.value === 'base-example');
// 管理视图已移除，统一以 iframe 全屏承载插件 UI
// 页面URL：根据插件 manifest 的托管配置生成，优先使用 store 的解析逻辑
const pageUrl = ref('');
async function resolvePageUrl(id: string) {
  if (!id) {
    pageUrl.value = '';
    return;
  }
  try {
    const url = await pluginStore.getPluginUIUrl(id);
    pageUrl.value = url || '';
  } catch (err) {
    console.warn('[PluginFramePage] getPluginUIUrl failed:', err);
    pageUrl.value = '';
  }
}
watch(pluginId, (id) => { resolvePageUrl(id); }, { immediate: true });

const initialPayload = computed(() => {
  const plugin = pluginStore.plugins.find(p => p.id === pluginId.value);
  return {
    type: 'plugin-init',
    pluginId: pluginId.value,
    manifest: plugin?.manifest,
    config: plugin?.config,
    routeQuery: route.query,
  } as Record<string, any>;
});

function postInitMessage() {
  const target = uiIframe.value?.contentWindow || baseIframe.value?.contentWindow;
  if (!target) return;
  try {
    // 保证 postMessage 负载为可结构化克隆数据，避免 Vue/Pinia 代理与函数导致 DataCloneError
    const safe = (() => {
      const seen = new WeakSet();
      const clone = (value: any): any => {
        if (value == null) return value;
        const t = typeof value;
        if (t === 'function' || t === 'symbol' || t === 'bigint') return undefined;
        if (t !== 'object') return value;
        if (value instanceof Date) return value.toISOString();
        if (Array.isArray(value)) return value.map(clone);
        if (seen.has(value)) return undefined;
        seen.add(value);
        if (value instanceof Map) {
          const obj: Record<string, any> = {};
          for (const [k, v] of value.entries()) obj[String(k)] = clone(v);
          return obj;
        }
        if (value instanceof Set) return Array.from(value).map(clone);
        const out: Record<string, any> = {};
        for (const key of Object.keys(value)) out[key] = clone((value as any)[key]);
        return out;
      };
      return clone(initialPayload.value);
    })();
    target.postMessage(safe, '*');
  } catch (err) {
    console.warn('[PluginFramePage] postMessage failed:', err);
  }
}

function handleMessage(event: MessageEvent) {
  const data = event?.data;
  if (!data || typeof data !== 'object') return;
  const type = (data as any).type;
  if (type === 'plugin-ready' || type === 'ui-ready') {
    postInitMessage();
    // 初始化后发送生命周期与只读仓库事件
    sendLifecycleEvent('ready');
    void sendReadonlyStoreInit();
    return;
  }
  // 最小桥接：将来自插件 UI 的 Overlay 相关事件转发到真实 preload API
  try {
    if (type === 'overlay-action') {
      const { overlayId, action, payload } = data as any;
      window.electronApi?.overlay?.action?.(String(overlayId), String(action), payload);
      return;
    }
    if (type === 'overlay-close') {
      const { overlayId } = data as any;
      window.electronApi?.overlay?.close?.(String(overlayId));
      return;
    }
    if (type === 'overlay-update') {
      const { overlayId, updates } = data as any;
      window.electronApi?.overlay?.update?.(String(overlayId), updates);
      return;
    }
    if (type === 'overlay-send') {
      const { overlayId, event: ev, payload } = data as any;
      window.electronApi?.overlay?.send?.(String(overlayId), String(ev), payload);
      return;
    }
  } catch (bridgeErr) {
    console.warn('[PluginFramePage] overlay bridge failed:', bridgeErr);
  }

  // 桥接请求：配置与 Overlay 操作统一处理
  if (type === 'bridge-request') {
    const { requestId, command } = data as any;
    const respond = (success: boolean, respData?: any, error?: any) => {
      const target = uiIframe.value?.contentWindow || baseIframe.value?.contentWindow;
      if (!target) return;
      const payload: Record<string, any> = { type: 'bridge-response', requestId, command, success };
      if (success) payload.data = respData;
      if (!success) payload.error = error;
      try { target.postMessage(payload, '*'); } catch (e) { /* noop */ }
    };
    (async () => {
      try {
        if (command === 'get-config') {
          const res = await window.electronApi.plugin.getConfig(pluginId.value);
          if (res && 'success' in res && res.success) {
            // 从返回的配置中删除敏感字段（例如 token），不向插件 UI 传递
            const cfg = (res.data ? { ...res.data } : {});
            if (cfg && typeof cfg === 'object' && 'token' in cfg) {
              try { delete (cfg as any).token; } catch (_) {}
            }
            respond(true, cfg);
          } else {
            respond(false, null, (res as any)?.error || 'Failed to get config');
          }
          return;
        }
        if (command === 'set-config') {
          const nextCfg = (data as any)?.payload?.config || {};
          try {
            await pluginStore.updatePluginConfig(pluginId.value, nextCfg);
            respond(true, { success: true });
            sendLifecycleEvent('config-updated');
          } catch (e) {
            respond(false, null, (e as Error).message);
          }
          return;
        }
        if (command === 'overlay') {
          const act = (data as any)?.payload?.action;
          const args = (data as any)?.payload?.args || [];
          let result: any = null;
          try {
            const api = window.electronApi.overlay;
            if (act === 'create') result = await api.create(args[0]);
            else if (act === 'close') result = await api.close(args[0]);
            else if (act === 'show') result = await api.show(args[0]);
            else if (act === 'hide') result = await api.hide(args[0]);
            else if (act === 'bringToFront') result = await api.bringToFront(args[0]);
            else if (act === 'update') result = await api.update(args[0], args[1]);
            else if (act === 'list') result = await api.list();
            else if (act === 'send') result = await api.send(args[0], args[1], args[2]);
            else result = await api.action(args[0], act, args[1]);
            const ok = !!(result && 'success' in result ? result.success : true);
            // 返回完整结果对象，供插件 UI 判断 result.success
            respond(ok, result, result?.error);
          } catch (e) {
            respond(false, null, (e as Error).message);
          }
          return;
        }
      } catch (e) {
        respond(false, null, (e as Error).message);
      }
    })();
    return;
  }
}

onMounted(() => {
  const el = isBaseExample.value ? baseIframe.value : uiIframe.value;
  if (el) {
    const onLoad = () => postInitMessage();
    el.addEventListener('load', onLoad);
    (el as any).__onLoad = onLoad;
  }
  window.addEventListener('message', handleMessage);
  // 动态刷新只读仓库：事件驱动订阅 + 节流批量派发
  try {
    // 构建房间只读切片
    const buildRoomsSlice = () => {
      const list = safeClone(roomStore.rooms);
      const liveRoomsCount = roomStore.liveRooms.length;
      const totalViewers = roomStore.totalViewers;
      return { rooms: { list, liveRoomsCount, totalViewers } } as Record<string, any>;
    };

    // 构建 UI 只读切片
    const buildUiSlice = () => {
      return {
        ui: {
          theme: uiStore.theme,
          sidebarCollapsed: uiStore.sidebarCollapsed,
          isFullscreen: uiStore.isFullscreen,
          windowSize: uiStore.windowSize,
        }
      } as Record<string, any>;
    };

    // 构建角色只读切片
    const buildRoleSlice = () => {
      return {
        role: {
          current: roleStore.current,
          statsScope: roleStore.statsScope,
        }
      } as Record<string, any>;
    };

    // 构建账户只读切片（去敏，仅最小Profile）
    const buildAccountSlice = () => {
      const logged = accountStore.isLoggedIn;
      const profile = accountStore.userInfo ? {
        userID: accountStore.userInfo.userID,
        nickname: accountStore.userInfo.nickname,
        avatar: accountStore.userInfo.avatar,
      } : null;
      return { account: { isLoggedIn: logged, profile } } as Record<string, any>;
    };

    let pending: Record<string, any> = {};
    let updateTimer: number | null = null;
    const getTarget = () => (uiIframe.value?.contentWindow || baseIframe.value?.contentWindow);
    const queueReadonlyUpdate = (slice: Record<string, any>) => {
      for (const k of Object.keys(slice)) {
        pending[k] = { ...(pending[k] || {}), ...(slice[k] || {}) };
      }
      if (updateTimer == null) {
        updateTimer = window.setTimeout(() => {
          const target = getTarget();
          if (target) {
            const payload = { type: 'plugin-event', eventType: 'readonly-store', event: 'readonly-store-update', payload: safeClone(pending) };
            try { target.postMessage(payload, '*'); } catch { /* noop */ }
          }
          pending = {};
          updateTimer = null;
        }, 250);
      }
    };

    // 订阅房间列表变化
    const stopRooms = watch(() => roomStore.rooms, () => {
      queueReadonlyUpdate(buildRoomsSlice());
    }, { deep: true });

    // 订阅 UI 变化
    const stopUi = watch(() => [uiStore.theme, uiStore.sidebarCollapsed, uiStore.isFullscreen, uiStore.windowSize], () => {
      queueReadonlyUpdate(buildUiSlice());
    }, { deep: true });

    // 订阅角色变化
    const stopRole = watch(() => [roleStore.current, roleStore.statsScope], () => {
      queueReadonlyUpdate(buildRoleSlice());
    });

    // 订阅账户变化
    const stopAccount = watch(() => [accountStore.isLoggedIn, accountStore.userInfo], () => {
      queueReadonlyUpdate(buildAccountSlice());
    }, { deep: true });

    // 保存停止函数以便卸载清理
    (window as any).__readonlyStoreStops = [stopRooms, stopUi, stopRole, stopAccount];
  } catch {/* noop */}
});

onUnmounted(() => {
  const el = (isBaseExample.value ? baseIframe.value : uiIframe.value) as any;
  if (el?.__onLoad) {
    el.removeEventListener('load', el.__onLoad);
    delete el.__onLoad;
  }
  window.removeEventListener('message', handleMessage);
  // 清理订阅
  try {
    const stops: any[] = (window as any).__readonlyStoreStops || [];
    for (const stop of stops) { try { typeof stop === 'function' && stop(); } catch {} }
    delete (window as any).__readonlyStoreStops;
  } catch {/* noop */}
});

// 管理视图相关脚本与定时刷新已移除

function safeClone(obj: any) {
  if (!obj || typeof obj !== 'object') return obj;
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
}

function sendLifecycleEvent(event: string) {
  const target = uiIframe.value?.contentWindow || baseIframe.value?.contentWindow;
  if (!target) return;
  const payload = { type: 'plugin-event', eventType: 'lifecycle', event };
  try { target.postMessage(payload, '*'); } catch { /* noop */ }
}

async function sendReadonlyStoreInit() {
  const target = uiIframe.value?.contentWindow || baseIframe.value?.contentWindow;
  if (!target) return;
  try {
    const res = await window.electronApi.room.list();
    const rooms = Array.isArray((res as any)?.data) ? (res as any).data : [];
    const liveRoomsCount = rooms.filter((r: any) => r?.status === 'live' || r?.isLive === true).length;
    const totalViewers = rooms.reduce((s: number, r: any) => s + Number(r?.viewers || r?.viewerCount || 0), 0);
    // 组合初始只读快照：rooms + ui + role + account（去敏）
    const uiSlice = { ui: { theme: uiStore.theme, sidebarCollapsed: uiStore.sidebarCollapsed, isFullscreen: uiStore.isFullscreen, windowSize: uiStore.windowSize } };
    const roleSlice = { role: { current: roleStore.current, statsScope: roleStore.statsScope } };
    const accountSlice = { account: { isLoggedIn: accountStore.isLoggedIn, profile: accountStore.userInfo ? { userID: accountStore.userInfo.userID, nickname: accountStore.userInfo.nickname, avatar: accountStore.userInfo.avatar } : null } };
    const store = { rooms: { list: rooms, liveRoomsCount, totalViewers }, ...uiSlice, ...roleSlice, ...accountSlice };
    const payload = { type: 'plugin-event', eventType: 'readonly-store', event: 'readonly-store-init', payload: safeClone(store) };
    target.postMessage(payload, '*');
  } catch {
    const uiSlice = { ui: { theme: uiStore.theme, sidebarCollapsed: uiStore.sidebarCollapsed, isFullscreen: uiStore.isFullscreen, windowSize: uiStore.windowSize } };
    const roleSlice = { role: { current: roleStore.current, statsScope: roleStore.statsScope } };
    const accountSlice = { account: { isLoggedIn: accountStore.isLoggedIn, profile: accountStore.userInfo ? { userID: accountStore.userInfo.userID, nickname: accountStore.userInfo.nickname, avatar: accountStore.userInfo.avatar } : null } };
    const store = { rooms: { list: [], liveRoomsCount: 0, totalViewers: 0 }, ...uiSlice, ...roleSlice, ...accountSlice };
    const payload = { type: 'plugin-event', eventType: 'readonly-store', event: 'readonly-store-init', payload: safeClone(store) };
    try { target.postMessage(payload, '*'); } catch { /* noop */ }
  }
}
</script>

<style scoped>
.plugin-frame-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.plugin-frame-page.base-example-full {
  padding: 0;
}

.plugin-ui-full-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.plugin-ui-full-container iframe#plugin-ui {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  background: transparent;
}

.base-example-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.base-example-container iframe#base-example {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  background: transparent;
}
</style>
