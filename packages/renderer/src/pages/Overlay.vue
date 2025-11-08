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
let websocket: WebSocket | null = null

// Wujie 相关状态
const pluginInfo = ref<PluginInfoLite | null>(null)
const overlayWujie = ref<OverlayWujieConfig | null>(null)
const isWujieOverlay = ref(false)
const wujieUrl = ref('')
const wujieName = ref('')
const pluginKey = ref('')
const wujieProps = ref<Record<string, any>>({})

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
        connectWebSocket(result.data.websocket_endpoint)

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
            // 透传必要能力，可视需要扩展
            close: () => window.electronApi.overlay.close(String(oid)),
            action: (action: string, data?: any) => window.electronApi.overlay.action(String(oid), action, data),
            update: (updates: any) => window.electronApi.overlay.update(String(oid), updates)
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

const connectWebSocket = (endpoint: string) => {
  try {
    websocket = new WebSocket(endpoint)
    
    websocket.onopen = () => {
      // WebSocket connected successfully
    }
    
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }
    
    websocket.onclose = () => {
      // WebSocket disconnected, attempting to reconnect
      setTimeout(() => {
        if (overlayData.value) {
          connectWebSocket(overlayData.value.websocket_endpoint)
        }
      }, 5000)
    }
    
    websocket.onerror = (err) => {
      console.error('WebSocket error:', err)
    }
  } catch (err) {
    console.error('Failed to connect WebSocket:', err)
  }
}

const handleWebSocketMessage = (_data: any) => {
  // 处理 WebSocket 消息，可以根据需要更新 overlay 内容
  // 这里可以根据消息类型更新 overlay 显示
  // 例如：弹幕、礼物、关注等事件
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
})

onUnmounted(() => {
  if (websocket) {
    websocket.close()
  }
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
