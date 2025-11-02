<template>
  <div class="overlay-container" v-if="overlayData">
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
    ></div>

    <!-- 组件类型 Overlay -->
    <component 
      v-else-if="overlayData.overlay.type === 'component' && overlayData.overlay.component"
      :is="getComponent(overlayData.overlay.component)"
      :config="overlayData.overlay.config"
      :room="overlayData.room"
      :token="overlayData.token"
    />

    <!-- 未知类型 -->
    <div v-else class="error-overlay">
      <h3>不支持的 Overlay 类型</h3>
      <p>类型: {{ overlayData.overlay.type }}</p>
    </div>
  </div>

  <!-- 错误状态 -->
  <div v-else-if="error" class="error-container">
    <div class="error-content">
      <h3>{{ error.title }}</h3>
      <p>{{ error.message }}</p>
      <div class="error-details" v-if="error.details">
        <strong>详情:</strong> {{ error.details }}
      </div>
    </div>
  </div>

  <!-- 加载状态 -->
  <div v-else class="loading-container">
    <div class="loading-spinner"></div>
    <p>正在加载 Overlay...</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

interface OverlayConfig {
  type: 'text' | 'html' | 'component'
  content?: string
  component?: string
  config?: Record<string, any>
  style?: Record<string, any>
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

const route = useRoute()
const overlayData = ref<OverlayData | null>(null)
const error = ref<ErrorInfo | null>(null)
let websocket: WebSocket | null = null

const fetchOverlayData = async () => {
  try {
    const overlayId = route.params.overlayId as string
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
</style>