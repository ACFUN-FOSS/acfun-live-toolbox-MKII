<template>
  <div class="overlay-manager">
    <!-- 渲染所有活跃的overlay -->
    <OverlayRenderer
      v-for="overlay in activeOverlays"
      :key="overlay.id"
      :overlay="overlay"
      :visible="overlay.visible !== false"
      :z-index="getOverlayZIndex(overlay.id)"
      :ref="(el:any) => setOverlayRef(overlay.id, el)"
      @close="closeOverlay"
      @action="handleOverlayAction"
      @click="handleOverlayClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import OverlayRenderer, { type OverlayOptions } from './OverlayRenderer.vue'

interface OverlayState extends OverlayOptions {
  visible?: boolean
  createdAt: number
  updatedAt: number
  zIndex?: number
}

interface Emits {
  (e: 'overlay-created', overlayId: string): void
  (e: 'overlay-closed', overlayId: string): void
  (e: 'overlay-action', overlayId: string, action: string, data?: any): void
}

const emit = defineEmits<Emits>()

// 存储所有overlay的状态
const overlays = ref<Map<string, OverlayState>>(new Map())
// 保持 OverlayRenderer 实例引用以便消息转发
const overlayRefs = ref<Map<string, any>>(new Map())
const setOverlayRef = (overlayId: string, el: any) => {
  if (el) overlayRefs.value.set(overlayId, el)
  else overlayRefs.value.delete(overlayId)
}

// 管理z-index的基础值和递增
const baseZIndex = ref(1000)
const zIndexCounter = ref(0)

// 计算活跃的overlay列表
const activeOverlays = computed(() => {
  return Array.from(overlays.value.values())
    .filter(overlay => overlay.visible !== false)
    .sort((a, b) => a.createdAt - b.createdAt) // 按创建时间排序
})

// 获取overlay的z-index
const getOverlayZIndex = (overlayId: string): number => {
  const overlay = overlays.value.get(overlayId)
  if (!overlay) return baseZIndex.value
  
  // 如果overlay有自定义z-index，使用它
  if (overlay.style?.zIndex) {
    return overlay.style.zIndex
  }
  
  // 否则使用管理器分配的z-index
  return overlay.zIndex || baseZIndex.value
}

// 创建新的overlay
const createOverlay = (options: OverlayOptions): void => {
  const now = Date.now()
  const overlayState: OverlayState = {
    ...options,
    visible: true,
    createdAt: now,
    updatedAt: now,
    zIndex: baseZIndex.value + (++zIndexCounter.value)
  }
  
  overlays.value.set(options.id, overlayState)
  emit('overlay-created', options.id)
}

// 更新overlay
const updateOverlay = (overlayId: string, updates: Partial<OverlayState>): boolean => {
  const overlay = overlays.value.get(overlayId)
  if (!overlay) return false
  
  const updatedOverlay: OverlayState = {
    ...overlay,
    ...updates,
    updatedAt: Date.now()
  }
  
  overlays.value.set(overlayId, updatedOverlay)
  return true
}

// 关闭overlay
const closeOverlay = (overlayId: string): boolean => {
  const overlay = overlays.value.get(overlayId)
  if (!overlay) return false
  
  overlays.value.delete(overlayId)
  emit('overlay-closed', overlayId)
  return true
}

// 显示overlay
const showOverlay = (overlayId: string): boolean => {
  return updateOverlay(overlayId, { visible: true })
}

// 隐藏overlay
const hideOverlay = (overlayId: string): boolean => {
  return updateOverlay(overlayId, { visible: false })
}

// 将overlay置于顶层
const bringToFront = (overlayId: string): boolean => {
  const overlay = overlays.value.get(overlayId)
  if (!overlay) return false
  
  const newZIndex = baseZIndex.value + (++zIndexCounter.value)
  return updateOverlay(overlayId, { 
    style: { 
      ...overlay.style, 
      zIndex: newZIndex 
    } 
  })
}

// 获取overlay信息
const getOverlay = (overlayId: string): OverlayState | undefined => {
  return overlays.value.get(overlayId)
}

// 获取所有overlay
const getAllOverlays = (): OverlayState[] => {
  return Array.from(overlays.value.values())
}

// 清除所有overlay
const clearAllOverlays = (): void => {
  const overlayIds = Array.from(overlays.value.keys())
  overlays.value.clear()
  
  overlayIds.forEach(id => {
    emit('overlay-closed', id)
  })
}

// 处理overlay动作
const handleOverlayAction = (overlayId: string, action: string, data?: any) => {
  emit('overlay-action', overlayId, action, data)
  
  // 通知主进程
  if (window.electronApi?.overlay?.action) {
    window.electronApi.overlay.action(overlayId, action, data)
  }
}

// 处理overlay点击
const handleOverlayClick = (overlayId: string, _event: MouseEvent) => {
  // 点击时将overlay置于顶层
  bringToFront(overlayId)
}

// IPC事件处理器
const handleOverlayCreate = (_event: any, options: OverlayOptions) => {
  createOverlay(options)
}

const handleOverlayUpdate = (_event: any, overlayId: string, updates: Partial<OverlayOptions>) => {
  updateOverlay(overlayId, updates)
}

const handleOverlayClose = (_event: any, overlayId: string) => {
  closeOverlay(overlayId)
}

const handleOverlayShow = (_event: any, overlayId: string) => {
  showOverlay(overlayId)
}

const handleOverlayHide = (_event: any, overlayId: string) => {
  hideOverlay(overlayId)
}

const handleOverlayBringToFront = (_event: any, overlayId: string) => {
  bringToFront(overlayId)
}

// 处理来自主进程的 UI/Window -> Overlay 消息，并转发到具体 OverlayRenderer
const handleOverlayMessage = (_event: any, overlayId: string, message: { event: string; payload?: any }) => {
  try {
    const ref = overlayRefs.value.get(overlayId)
    if (ref && typeof ref.receiveMessage === 'function') {
      ref.receiveMessage(message.event, message.payload)
    } else {
      // 无法找到对应实例或不支持消息接收
      // 静默失败但记录日志以便调试
      console.warn('[OverlayManager] No renderer ref or receiveMessage not found for overlay:', overlayId)
    }
  } catch (err) {
    console.error('[OverlayManager] Failed to handle overlay-message:', err)
  }
}

// 暴露方法给父组件
defineExpose({
  createOverlay,
  updateOverlay,
  closeOverlay,
  showOverlay,
  hideOverlay,
  bringToFront,
  getOverlay,
  getAllOverlays,
  clearAllOverlays
})

onMounted(() => {
  // 注册IPC事件监听器
  if (window.electronApi?.on) {
    window.electronApi.on('overlay-create', handleOverlayCreate)
    window.electronApi.on('overlay-update', handleOverlayUpdate)
    window.electronApi.on('overlay-close', handleOverlayClose)
    window.electronApi.on('overlay-show', handleOverlayShow)
    window.electronApi.on('overlay-hide', handleOverlayHide)
    window.electronApi.on('overlay-bring-to-front', handleOverlayBringToFront)
    window.electronApi.on('overlay-message', handleOverlayMessage)
  }
})

onUnmounted(() => {
  // 清理IPC事件监听器
  if (window.electronApi?.off) {
    window.electronApi.off('overlay-create', handleOverlayCreate)
    window.electronApi.off('overlay-update', handleOverlayUpdate)
    window.electronApi.off('overlay-close', handleOverlayClose)
    window.electronApi.off('overlay-show', handleOverlayShow)
    window.electronApi.off('overlay-hide', handleOverlayHide)
    window.electronApi.off('overlay-bring-to-front', handleOverlayBringToFront)
    window.electronApi.off('overlay-message', handleOverlayMessage)
  }
  
  // 清理所有overlay
  clearAllOverlays()
})
</script>

<style scoped>
.overlay-manager {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1000;
}

.overlay-manager > * {
  pointer-events: auto;
}
</style>
