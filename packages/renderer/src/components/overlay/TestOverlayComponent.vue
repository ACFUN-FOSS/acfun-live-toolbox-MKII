<template>
  <div class="test-overlay-component">
    <div class="header">
      <h3>{{ title }}</h3>
      <button
        class="close-btn"
        @click="closeOverlay"
      >
        ×
      </button>
    </div>
    
    <div class="content">
      <p>{{ message }}</p>
      <div class="counter-section">
        <p>计数器: {{ localCounter }}</p>
        <div class="button-group">
          <button
            class="btn btn-primary"
            @click="increment"
          >
            +1
          </button>
          <button
            class="btn btn-secondary"
            @click="decrement"
          >
            -1
          </button>
          <button
            class="btn btn-warning"
            @click="reset"
          >
            重置
          </button>
        </div>
      </div>
      
      <div class="action-section">
        <button
          class="btn btn-success"
          @click="sendAction"
        >
          发送动作到插件
        </button>
        <button
          class="btn btn-info"
          @click="updateOverlay"
        >
          更新Overlay
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// 扩展 Window 接口
declare global {
  interface Window {
    overlayApi?: {
      id: string;
      room: string;
      token: string;
      action: (actionId: string, data?: any) => void;
      close: () => void;
      update: (updates: any) => void;
    };
  }
}

// Props
interface Props {
  title?: string
  message?: string
  counter?: number
}

const props = withDefaults(defineProps<Props>(), {
  title: '测试组件',
  message: '这是一个测试消息',
  counter: 0
})

// 本地状态
const localCounter = ref(props.counter)

// 方法
const increment = () => {
  localCounter.value++
}

const decrement = () => {
  localCounter.value--
}

const reset = () => {
  localCounter.value = 0
}

const closeOverlay = () => {
  if (window.overlayApi) {
    window.overlayApi.close()
  }
}

const sendAction = () => {
  if (window.overlayApi) {
    window.overlayApi.action('component-action', {
      message: '来自组件的消息',
      counter: localCounter.value,
      timestamp: new Date().toISOString()
    })
  }
}

const updateOverlay = () => {
  if (window.overlayApi) {
    window.overlayApi.update({
      props: {
        ...props,
        counter: localCounter.value,
        message: `更新时间: ${new Date().toLocaleTimeString()}`
      }
    })
  }
}

onMounted(() => {
  // Component mounted
})
</script>

<style scoped>
.test-overlay-component {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.content {
  padding: 20px;
}

.content p {
  margin: 0 0 15px 0;
  font-size: 14px;
  line-height: 1.5;
}

.counter-section {
  margin: 20px 0;
  padding: 15px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.counter-section p {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
}

.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-section {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
  transform: translateY(-1px);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
  transform: translateY(-1px);
}

.btn-warning {
  background: #ffc107;
  color: #212529;
}

.btn-warning:hover {
  background: #e0a800;
  transform: translateY(-1px);
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #1e7e34;
  transform: translateY(-1px);
}

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-info:hover {
  background: #117a8b;
  transform: translateY(-1px);
}
</style>