<template>
  <div
    v-if="overlayData"
    class="overlay-container"
  >
    <!-- Wujie 微前端 Overlay，当插件清单声明 overlay.wujie.url 时加载 -->
    <WujieVue
      v-if="isWujieOverlay"
      :key="pluginKey"
      :name="wujieName"
      :url="wujieUrl"
      :props="wujieProps"
      :sync="true"
      :alive="false"
      :width="'100%'"
      :height="'100%'"
      @beforeLoad="onBeforeLoad"
      @beforeMount="onBeforeMount"
      @afterMount="onAfterMount"
      @beforeUnmount="onBeforeUnmount"
      @afterUnmount="onAfterUnmount"
      @loadError="onLoadError"
    />

    <!-- 文本类型 Overlay -->
    <div 
      v-if="overlayData.overlay.type === 'text'" 
      class="text-overlay"
      :style="getTextStyle(overlayData.overlay)"
    >
      {{ overlayData.overlay.content }}
    </div>

    <!-- HTML 类型 Overlay -->
    <div 
      v-else-if="overlayData.overlay.type === 'html'" 
      class="html-overlay"
      v-html="overlayData.overlay.content"
    />

    <!-- 组件类型 Overlay -->
    <component 
      :is="getComponent(overlayData.overlay.component)"
      v-else-if="overlayData.overlay.type === 'component' && overlayData.overlay.component"
      :config="overlayData.overlay.config"
      :room="overlayData.room"
      :token="overlayData.token"
    />

    <!-- 未知类型 -->
    <div
      v-else
      class="error-overlay"
    >
      <h3>不支持的 Overlay 类型</h3>
      <p>类型: {{ overlayData.overlay.type }}</p>
    </div>
  </div>

  <!-- 错误状态 -->
  <div
    v-else-if="error"
    class="error-container"
  >
    <div class="error-content">
      <h3>{{ error.title }}</h3>
      <p>{{ error.message }}</p>
      <div
        v-if="error.details"
        class="error-details"
      >
        <strong>详情:</strong> {{ error.details }}
      </div>
    </div>
  </div>

  <!-- 加载状态 -->
  <div
    v-else
    class="loading-container"
  >
    <div class="loading-spinner" />
    <p>正在加载 Overlay...</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import WujieVue from 'wujie-vue3'

interface OverlayConfig {
  type: 'text' | 'html' | 'component'
  content?: string
  component?: string
  config?: Record<string, any>
  style?: Record<string, any>
  // 插件ID，用于读取插件清单中的 overlay.wujie 配置
  pluginId?: string
}

interface OverlayData {
  overlay: OverlayConfig
  room?: string
  token?: string
  websocket_endpoint: string
}

interface ErrorInfo {
  title: string
  message: string
  details?: string
}

interface OverlayWujieConfig {
  url: string
  spa?: boolean
  route?: string
}

interface PluginManifest {
  id: string
  name: string
  version: string
  main: string
  overlay?: {
    wujie?: OverlayWujieConfig
  }
}

interface PluginInfoLite {
  id: string
  name: string
  version: string
  manifest: PluginManifest
}

const route = useRoute()
const overlayData = ref<OverlayData | null>(null)
const error = ref<ErrorInfo | null>(null)
let eventSource: EventSource | null = null

// Wujie 相关状态
const pluginInfo = ref<PluginInfoLite | null>(null)
const overlayWujie = ref<OverlayWujieConfig | null>(null)
const isWujieOverlay = ref(false)
const wujieUrl = ref('')
const wujieName = ref('')
const pluginKey = ref('')
const wujieProps = ref<Record<string, any>>({})
let lastEventId: string | null = null
let seenIds: Set<string> = new Set()

const fetchOverlayData = async () => {
  try {
    const overlayId = (route.params.overlayId as string) || (route.query.overlayId as string)
    if (!overlayId) {
      error.value = {
        title: '参数错误',
        message: '缺少 overlayId 参数',
        details: '请在路径或查询参数中提供 overlayId'
      }
      return
    }
    const room = route.query.room as string
    const token = route.query.token as string
    
    const params = new URLSearchParams()
    if (room) params.append('room', room)
    if (token) params.append('token', token)
    
    const url = `/api/overlay/${overlayId}${params.toString() ? '?' + params.toString() : ''}`
    const response = await fetch(url)
    
    if (response.ok) {
      const result = await response.json()
      if (result.success) {
        overlayData.value = result.data

        // 使用插件级 SSE 订阅事件并转发到 Wujie 总线
        const oid = String((route.params.overlayId as string) || (route.query.overlayId as string) || '')
        const pid = String(overlayData.value?.overlay?.pluginId || '')
        connectSSE(pid, oid)

        // 根据 overlay.pluginId 加载插件清单，判断是否启用 Wujie Overlay
        await resolveWujieConfig()
      } else {
        error.value = {
          title: '获取 Overlay 失败',
          message: result.message || '未知错误',
          details: result.error
        }
      }
    } else {
      const result = await response.json().catch(() => ({}))
      error.value = {
        title: 'HTTP 错误',
        message: result.message || `请求失败 (${response.status})`,
        details: result.error
      }
    }
  } catch (err) {
    error.value = {
      title: '网络错误',
      message: '无法连接到服务器',
      details: (err as Error).message
    }
  }
}

const resolveWujieConfig = async () => {
  try {
    const pluginId = overlayData.value?.overlay?.pluginId
    if (!pluginId) {
      // 未绑定插件，按旧模式渲染
      isWujieOverlay.value = false
      return
    }

    // 通过真实的 preload API 读取插件信息
    const res = await window.electronApi.plugin.get(pluginId)
    if (res && 'success' in res && res.success) {
      const info = res.data
      pluginInfo.value = info as PluginInfoLite
      const w = info?.manifest?.overlay?.wujie || null
      overlayWujie.value = w

      if (w && typeof w.url === 'string' && w.url.trim()) {
        isWujieOverlay.value = true
        wujieUrl.value = w.url
        wujieName.value = `overlay-${pluginId}`
        const oid = String((route.params.overlayId as string) || (route.query.overlayId as string) || '')
        pluginKey.value = `${pluginId}-${oid}-${Date.now()}`

        // 传递给子应用的属性
        wujieProps.value = {
          overlayId: oid,
          pluginId,
          version: info.version,
          room: overlayData.value?.room,
          token: overlayData.value?.token,
          api: {
            // 统一通过 HTTP：仅保留 action/send 能力
            action: (action: string, data?: any) => {
              const url = `/api/overlay/${encodeURIComponent(String(oid))}/action`
              return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: String(action), data }) })
            },
            send: (event: string, payload?: any) => {
              const url = `/api/plugins/${encodeURIComponent(String(pluginId))}/overlay/messages`
              return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overlayId: String(oid), event: String(event), payload }) })
            }
          },
          // SPA 初始路由支持
          initialRoute: w.spa ? (w.route || '/') : undefined
        }
      } else {
        isWujieOverlay.value = false
      }
    } else {
      isWujieOverlay.value = false
    }
  } catch (err) {
    console.error('Failed to resolve Wujie overlay config:', err)
    // 回落到旧模式
    isWujieOverlay.value = false
  }
}

// 初始化共享对象供 Wujie 子应用读取（与 overlay-wrapper 保持一致）
;(window as any).__WUJIE_SHARED = (window as any).__WUJIE_SHARED || {}
;(window as any).__WUJIE_SHARED.readonlyStore = (window as any).__WUJIE_SHARED.readonlyStore || {}

const emitOverlayEvent = (payload: any) => {
  try {
    // 统一通过 Wujie 全局事件总线转发到子应用（插件前缀）
    const pid = String(overlayData.value?.overlay?.pluginId || '')
    const eventName = `plugin:${pid}:overlay-message`
    try { console.log('[Overlay.vue] bus emit', { eventName, type: String(payload?.type || ''), event: String(payload?.event || ''), overlayId: String((payload as any)?.overlayId || '') }) } catch {}
    ;(WujieVue as any)?.bus?.$emit?.(eventName, payload)
  } catch (e) {
    // 总线可能尚未初始化，忽略错误
    console.warn('[Overlay] emit overlay-event failed:', e)
  }
}

const connectSSE = (pluginId: string, overlayId: string) => {
  try {
    // 订阅插件级 Overlay 消息中心（支持 Last-Event-ID）
    const query = lastEventId ? `?lastEventId=${encodeURIComponent(lastEventId)}` : ''
    const url = `/sse/plugins/${encodeURIComponent(pluginId)}/overlay${query}`
    eventSource = new EventSource(url)
    try { console.log('[Overlay.vue] SSE connect', { pluginId: String(pluginId), overlayId: String(overlayId), lastEventId: lastEventId || null }) } catch {}

    eventSource.addEventListener('init', (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data)
        const overlays = Array.isArray(payload?.overlays) ? payload.overlays : []
        const ov = overlays.find((o: any) => String(o?.id) === String(overlayId)) || null
        try { console.log('[Overlay.vue] SSE init', { overlays: overlays.length, overlayId: String(overlayId), found: !!ov }) } catch {}
        ;(window as any).__WUJIE_SHARED.readonlyStore.overlay = ov || {}
        emitOverlayEvent({ type: 'overlay-event', overlayId, eventType: 'overlay-message', event: 'readonly-store-init', payload: (window as any).__WUJIE_SHARED.readonlyStore })
      } catch (err) {
        console.warn('[Overlay] SSE init parse failed:', err)
      }
    })

    eventSource.addEventListener('update', (ev: MessageEvent) => {
      try {
        const rec = JSON.parse(ev.data)
        if (rec && typeof rec.id === 'string') {
          if (seenIds.has(rec.id)) return
          seenIds.add(rec.id)
          lastEventId = rec.id
        }
        const msg = rec?.payload || rec
        if (String(msg?.overlayId) !== String(overlayId)) return
        const ov = msg?.payload || {}
        try { console.log('[Overlay.vue] SSE update', { overlayId: String(overlayId), keys: Object.keys(ov || {}), recId: String(rec?.id || '') }) } catch {}
        ;(window as any).__WUJIE_SHARED.readonlyStore.overlay = ov
        // 与示例 overlay.html 的读取方式保持一致：payload 中包含 overlay 字段
        emitOverlayEvent({ type: 'overlay-event', overlayId, eventType: 'overlay-updated', event: 'overlay-updated', payload: { overlay: ov } })
      } catch (err) {
        console.warn('[Overlay] SSE update parse failed:', err)
      }
    })

    eventSource.addEventListener('message', (ev: MessageEvent) => {
      try {
        const rec = JSON.parse(ev.data)
        if (rec && typeof rec.id === 'string') {
          if (seenIds.has(rec.id)) return
          seenIds.add(rec.id)
          lastEventId = rec.id
        }
        const msg = rec?.payload || rec
        if (String(msg?.overlayId) !== String(overlayId)) return
        try { console.log('[Overlay.vue] SSE message', { overlayId: String(overlayId), event: String(msg?.event || 'message') }) } catch {}
        emitOverlayEvent({ type: 'overlay-event', overlayId, eventType: 'overlay-message', event: msg?.event || 'message', payload: msg?.payload })
      } catch (err) {
        console.warn('[Overlay] SSE message parse failed:', err)
      }
    })

    // 补充订阅生命周期事件：用于接收 config-updated 等更新并转发为 plugin-event
    eventSource.addEventListener('lifecycle', (ev: MessageEvent) => {
      try {
        const rec = JSON.parse(ev.data)
        if (rec && typeof rec.id === 'string') {
          if (seenIds.has(rec.id)) return
          seenIds.add(rec.id)
          lastEventId = rec.id
        }
        const msg = rec?.payload || rec
        // lifecycle 事件通常不携带 overlayId，按插件维度透传
        try { console.log('[Overlay.vue] SSE lifecycle', { event: String(msg?.event || 'lifecycle') }) } catch {}
        emitOverlayEvent({ type: 'plugin-event', eventType: 'lifecycle', event: msg?.event || 'lifecycle', payload: msg?.payload })
      } catch (err) {
        console.warn('[Overlay] SSE lifecycle parse failed:', err)
      }
    })

    eventSource.addEventListener('closed', (ev: MessageEvent) => {
      try {
        const rec = JSON.parse(ev.data)
        const msg = rec?.payload || rec
        if (String(msg?.overlayId) !== String(overlayId)) return
      } catch {}
      try { console.log('[Overlay.vue] SSE closed', { overlayId: String(overlayId) }) } catch {}
      emitOverlayEvent({
        type: 'overlay-event',
        overlayId,
        eventType: 'overlay-closed',
        event: 'overlay-closed',
        payload: null,
      })
    })

    eventSource.onerror = (err: any) => {
      console.warn('[Overlay] SSE error:', err)
      // 断线后尝试重连
      try {
        eventSource?.close()
      } catch {}
      try { console.log('[Overlay.vue] SSE reconnect', { pluginId: String(pluginId), overlayId: String(overlayId), lastEventId: lastEventId || null }) } catch {}
      setTimeout(() => connectSSE(pluginId, overlayId), 3000)
    }
  } catch (err) {
    console.error('Failed to connect SSE:', err)
  }
}

const getTextStyle = (overlay: OverlayConfig) => {
  const defaultStyle = {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 'bold',
    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
    padding: '10px',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.5)'
  }
  
  return { ...defaultStyle, ...overlay.style }
}

const getComponent = (componentName: string) => {
  // 这里可以根据组件名称返回对应的 Vue 组件
  // 目前返回一个占位符
  return {
    template: `
      <div class="component-overlay">
        <h3>组件 Overlay</h3>
        <p>组件名称: {{ componentName }}</p>
        <p>配置: {{ JSON.stringify(config) }}</p>
      </div>
    `,
    props: ['config', 'room', 'token'],
    setup(_props: any) {
      return { componentName }
    }
  }
}

onMounted(() => {
  fetchOverlayData()
  // 上报加载事件
  try {
    const oid = String((route.params.overlayId as string) || (route.query.overlayId as string) || '')
    if (oid) {
      const url = `/api/overlay/${encodeURIComponent(oid)}/action`
      void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'loaded' }) })
    }
  } catch {}
})

onUnmounted(() => {
  if (eventSource) {
    try { eventSource.close() } catch {}
  }
  // 上报卸载事件
  try {
    const oid = String((route.params.overlayId as string) || (route.query.overlayId as string) || '')
    if (oid) {
      const url = `/api/overlay/${encodeURIComponent(oid)}/action`
      void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unloaded' }) })
    }
  } catch {}
})

// Wujie 生命周期事件（保持与 CentralPluginContainer 一致的钩子结构）
const onBeforeLoad = () => {
  // 预留加载前处理，例如打点
}
const onBeforeMount = () => {
  // 预留挂载前处理
}
const onAfterMount = () => {
  // 预留挂载后处理
}
const onBeforeUnmount = () => {
  // 预留卸载前处理
}
const onAfterUnmount = () => {
  // 预留卸载后处理
}
const onLoadError = (e: any) => {
  error.value = {
    title: 'Wujie 加载失败',
    message: '无法加载插件 Overlay 前端资源',
    details: String(e?.message || e)
  }
}
</script>

<style scoped>
.overlay-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: transparent;
  pointer-events: none;
  z-index: 9999;
}

.text-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  white-space: pre-wrap;
  word-wrap: break-word;
  max-width: 80%;
  text-align: center;
}

.html-overlay {
  width: 100%;
  height: 100%;
}

.component-overlay {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-family: Arial, sans-serif;
}

.error-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 0, 0, 0.8);
  color: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  font-family: Arial, sans-serif;
}

.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.error-content {
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 30px;
  max-width: 500px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.error-content h3 {
  margin: 0 0 15px 0;
  color: #e74c3c;
}

.error-content p {
  margin: 0 0 15px 0;
  color: #7f8c8d;
  line-height: 1.5;
}

.error-details {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #2c3e50;
  text-align: left;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: transparent;
  color: white;
  font-family: Arial, sans-serif;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Wujie 容器占满 Overlay 区域 */
:deep(.wujie-container) {
  width: 100%;
  height: 100%;
}
</style>
