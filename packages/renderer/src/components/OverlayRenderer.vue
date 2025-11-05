<template>
  <div 
    v-if="visible" 
    class="overlay-renderer"
    :class="overlayClasses"
    :style="overlayStyles"
    @click="handleOverlayClick"
  >
    <!-- Wujie Overlay 渲染 -->
    <WujieVue
      v-if="isWujieOverlay"
      class="overlay-content wujie-content"
      :key="pluginKey"
      :name="wujieName"
      :url="wujieUrl"
      :sync="false"
      :alive="true"
      :fetch="customFetch"
      :props="wujieProps"
      :attrs="wujieAttrs"
      @beforeLoad="onOverlayBeforeLoad"
      @beforeMount="onOverlayBeforeMount"
      @afterMount="onOverlayAfterMount"
      @beforeUnmount="onOverlayBeforeUnmount"
      @afterUnmount="onOverlayAfterUnmount"
      @loadError="onOverlayLoadError"
    />
    <!-- HTML内容渲染 -->
    <div 
      v-if="overlay.type === 'html'" 
      class="overlay-content html-content"
      v-html="overlay.content"
    />
    
    <!-- Vue组件渲染 -->
    <component 
      :is="getComponent" 
      v-else-if="overlay.type === 'component'"
      class="overlay-content component-content"
      v-bind="overlay.props || {}"
      @overlay-action="handleComponentAction"
    />
    
    <!-- 文本内容渲染 -->
    <div 
      v-else-if="overlay.type === 'text'" 
      class="overlay-content text-content"
    >
      {{ overlay.content }}
    </div>
    
    <!-- 默认内容 -->
    <div
      v-else
      class="overlay-content default-content"
    >
      <div class="overlay-info">
        <h3>{{ overlay.title || overlay.id }}</h3>
        <p>{{ overlay.description || 'Overlay content' }}</p>
      </div>
    </div>
    
    <!-- 关闭按钮 -->
    <button 
      v-if="overlay.closable !== false" 
      class="overlay-close-btn"
      aria-label="Close overlay"
      @click="handleClose"
    >
      ×
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import WujieVue from 'wujie-vue3'
import TestOverlayComponent from './overlay/TestOverlayComponent.vue'

export interface OverlayPosition {
  x?: number | string
  y?: number | string
  top?: number | string
  left?: number | string
  right?: number | string
  bottom?: number | string
}

export interface OverlaySize {
  width?: number | string
  height?: number | string
  maxWidth?: number | string
  maxHeight?: number | string
  minWidth?: number | string
  minHeight?: number | string
}

export interface OverlayStyle {
  backgroundColor?: string
  opacity?: number
  borderRadius?: string
  border?: string
  boxShadow?: string
  zIndex?: number
}

export interface OverlayOptions {
  id: string
  type: 'html' | 'component' | 'text' | 'default'
  content?: string
  component?: any
  props?: Record<string, any>
  title?: string
  description?: string
  position?: OverlayPosition
  size?: OverlaySize
  style?: OverlayStyle
  closable?: boolean
  modal?: boolean
  clickThrough?: boolean
  animation?: 'fade' | 'slide' | 'scale' | 'none'
  duration?: number
  autoClose?: number
  className?: string
  // 绑定的插件ID，用于读取清单的 overlay.wujie 配置
  pluginId?: string
}

interface Props {
  overlay: OverlayOptions
  visible?: boolean
  zIndex?: number
}

interface Emits {
  (e: 'close', overlayId: string): void
  (e: 'action', overlayId: string, action: string, data?: any): void
  (e: 'click', overlayId: string, event: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
  zIndex: 1000
})

const emit = defineEmits<Emits>()

// 组件映射
const componentMap = {
  TestOverlayComponent
}

// 获取组件
const getComponent = computed(() => {
  if (props.overlay.type === 'component') {
    const componentName = props.overlay.content
    return componentMap[componentName as keyof typeof componentMap] || props.overlay.component
  }
  return null
})

// 自动关闭定时器
const autoCloseTimer = ref<number | null>(null)

// Wujie 相关状态
interface OverlayWujieConfig {
  url: string
  spa?: boolean
  route?: string
}

interface PluginManifestLike {
  id: string
  version: string
  manifest?: {
    overlay?: {
      wujie?: OverlayWujieConfig
    }
  }
}

const isWujieOverlay = ref(false)
const wujieUrl = ref('')
const wujieName = ref('')
const pluginKey = ref('')
const wujieProps = ref<Record<string, any>>({})
const wujieAttrs = ref<Record<string, any>>({ style: 'width:100%;height:100%;display:block;' })

function customFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'X-Plugin-Token': 'overlay-plugin-token'
    }
  })
}

// 计算overlay的CSS类
const overlayClasses = computed(() => {
  const classes = ['overlay-renderer']
  
  if (props.overlay.modal) {
    classes.push('overlay-modal')
  }
  
  if (props.overlay.clickThrough) {
    classes.push('overlay-click-through')
  }
  
  if (props.overlay.animation) {
    classes.push(`overlay-animation-${props.overlay.animation}`)
  }
  
  if (props.overlay.className) {
    classes.push(props.overlay.className)
  }
  
  return classes
})

// 计算overlay的样式
const overlayStyles = computed(() => {
  const styles: Record<string, string> = {}
  
  // 位置样式
  if (props.overlay.position) {
    const pos = props.overlay.position
    if (pos.x !== undefined) styles.left = typeof pos.x === 'number' ? `${pos.x}px` : pos.x
    if (pos.y !== undefined) styles.top = typeof pos.y === 'number' ? `${pos.y}px` : pos.y
    if (pos.top !== undefined) styles.top = typeof pos.top === 'number' ? `${pos.top}px` : pos.top
    if (pos.left !== undefined) styles.left = typeof pos.left === 'number' ? `${pos.left}px` : pos.left
    if (pos.right !== undefined) styles.right = typeof pos.right === 'number' ? `${pos.right}px` : pos.right
    if (pos.bottom !== undefined) styles.bottom = typeof pos.bottom === 'number' ? `${pos.bottom}px` : pos.bottom
  }
  
  // 尺寸样式
  if (props.overlay.size) {
    const size = props.overlay.size
    if (size.width !== undefined) styles.width = typeof size.width === 'number' ? `${size.width}px` : size.width
    if (size.height !== undefined) styles.height = typeof size.height === 'number' ? `${size.height}px` : size.height
    if (size.maxWidth !== undefined) styles.maxWidth = typeof size.maxWidth === 'number' ? `${size.maxWidth}px` : size.maxWidth
    if (size.maxHeight !== undefined) styles.maxHeight = typeof size.maxHeight === 'number' ? `${size.maxHeight}px` : size.maxHeight
    if (size.minWidth !== undefined) styles.minWidth = typeof size.minWidth === 'number' ? `${size.minWidth}px` : size.minWidth
    if (size.minHeight !== undefined) styles.minHeight = typeof size.minHeight === 'number' ? `${size.minHeight}px` : size.minHeight
  }
  
  // 自定义样式
  if (props.overlay.style) {
    const customStyle = props.overlay.style
    if (customStyle.backgroundColor) styles.backgroundColor = customStyle.backgroundColor
    if (customStyle.opacity !== undefined) styles.opacity = customStyle.opacity.toString()
    if (customStyle.borderRadius) styles.borderRadius = customStyle.borderRadius
    if (customStyle.border) styles.border = customStyle.border
    if (customStyle.boxShadow) styles.boxShadow = customStyle.boxShadow
  }
  
  // z-index
  styles.zIndex = (props.overlay.style?.zIndex || props.zIndex).toString()
  
  return styles
})

// 处理overlay点击
const handleOverlayClick = (event: MouseEvent) => {
  emit('click', props.overlay.id, event)
}

// 处理关闭
const handleClose = () => {
  emit('close', props.overlay.id)
}

// 处理组件动作
const handleComponentAction = (action: string, data?: any) => {
  emit('action', props.overlay.id, action, data)
}

// 设置自动关闭
const setupAutoClose = () => {
  if (props.overlay.autoClose && props.overlay.autoClose > 0) {
    autoCloseTimer.value = setTimeout(() => {
      handleClose()
    }, props.overlay.autoClose) as any
  }
}

// 清除自动关闭定时器
const clearAutoClose = () => {
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value)
    autoCloseTimer.value = null
  }
}

// 监听visible变化
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    setupAutoClose()
  } else {
    clearAutoClose()
  }
})

onMounted(() => {
  if (props.visible) {
    setupAutoClose()
  }
  resolveWujieConfig()
})

onUnmounted(() => {
  clearAutoClose()
})

watch(() => props.overlay, () => {
  resolveWujieConfig()
})

async function resolveWujieConfig() {
  try {
    const pluginId = props.overlay.pluginId
    if (!pluginId) {
      isWujieOverlay.value = false
      return
    }
    const res = await window.electronApi.plugin.get(pluginId)
    if (res && 'success' in res && res.success) {
      const info = res.data as PluginManifestLike
      const w = info?.manifest?.overlay?.wujie || null
      if (w && typeof w.url === 'string' && w.url.trim()) {
        isWujieOverlay.value = true
        wujieUrl.value = w.url
        wujieName.value = `overlay-${pluginId}`
        pluginKey.value = `${pluginId}-${props.overlay.id}-${Date.now()}`
        wujieProps.value = {
          overlayId: props.overlay.id,
          pluginId,
          version: info.version
        }
      } else {
        isWujieOverlay.value = false
      }
    } else {
      isWujieOverlay.value = false
    }
  } catch (err) {
    console.error('resolveWujieConfig error:', err)
    isWujieOverlay.value = false
  }
}

function onOverlayBeforeLoad() {}
function onOverlayBeforeMount() {}
function onOverlayAfterMount() {}
function onOverlayBeforeUnmount() {}
function onOverlayAfterUnmount() {}
function onOverlayLoadError(err: any) {
  console.error('Wujie overlay load error:', err)
}
</script>

<style scoped>
.overlay-renderer {
  position: fixed;
  pointer-events: auto;
  user-select: none;
}

.overlay-renderer.overlay-click-through {
  pointer-events: none;
}

.overlay-renderer.overlay-click-through .overlay-content {
  pointer-events: auto;
}

.overlay-renderer.overlay-modal {
  background-color: rgba(0, 0, 0, 0.5);
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-content {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
}

.overlay-modal .overlay-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 90vw;
  max-height: 90vh;
}

.html-content {
  /* HTML内容的默认样式 */
}

.component-content {
  /* Vue组件内容的默认样式 */
}

.text-content {
  padding: 16px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 4px;
  font-family: Arial, sans-serif;
}

.default-content {
  padding: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 8px;
  font-family: Arial, sans-serif;
}

.overlay-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
}

.overlay-info p {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.overlay-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  transition: background-color 0.2s;
}

.overlay-close-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

/* 动画效果 */
.overlay-animation-fade {
  animation: overlayFadeIn 0.3s ease-out;
}

.overlay-animation-slide {
  animation: overlaySlideIn 0.3s ease-out;
}

.overlay-animation-scale {
  animation: overlayScaleIn 0.3s ease-out;
}

@keyframes overlayFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes overlaySlideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes overlayScaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>