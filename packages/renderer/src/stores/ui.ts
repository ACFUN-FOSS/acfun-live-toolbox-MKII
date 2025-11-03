import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export interface UiState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  windowSize: {
    width: number
    height: number
  }
  isFullscreen: boolean
}

export const useUiStore = defineStore('ui', () => {
  // State - 默认为浅色主题
  const sidebarCollapsed = ref(false)
  const theme = ref<'light' | 'dark'>('light')
  const windowSize = ref({
    width: 1024,
    height: 768
  })
  const isFullscreen = ref(false)

  // Getters
  const isMobile = computed(() => windowSize.value.width < 768)
  const isTablet = computed(() => windowSize.value.width >= 768 && windowSize.value.width < 1024)
  const isDesktop = computed(() => windowSize.value.width >= 1024)

  // Actions
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    saveToStorage()
  }

  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed
    saveToStorage()
  }

  function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme
    saveToStorage()
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    saveToStorage()
  }

  function updateWindowSize(width: number, height: number) {
    windowSize.value = { width, height }
    saveToStorage()
  }

  function setFullscreen(fullscreen: boolean) {
    isFullscreen.value = fullscreen
    saveToStorage()
  }

  // 持久化存储
  function saveToStorage() {
    try {
      const uiState = {
        sidebarCollapsed: sidebarCollapsed.value,
        theme: theme.value,
        windowSize: windowSize.value,
        isFullscreen: isFullscreen.value,
      }
      localStorage.setItem('uiState', JSON.stringify(uiState))
    } catch (err) {
      console.error('Failed to save UI state:', err)
    }
  }

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('uiState')
      if (saved) {
        const state = JSON.parse(saved)
        sidebarCollapsed.value = state.sidebarCollapsed ?? false
        theme.value = state.theme ?? 'light' // 默认浅色主题
        windowSize.value = state.windowSize ?? { width: 1024, height: 768 }
        isFullscreen.value = state.isFullscreen ?? false
      }
    } catch (err) {
      console.error('Failed to load UI state:', err)
    }
  }

  // 初始化
  loadFromStorage()

  // 监听主题变化，应用到document
  watch(theme, (newTheme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme)
    }
  }, { immediate: true })

  return {
    // State
    sidebarCollapsed,
    theme,
    windowSize,
    isFullscreen,
    
    // Getters
    isMobile,
    isTablet,
    isDesktop,
    
    // Actions
    toggleSidebar,
    setSidebarCollapsed,
    setTheme,
    toggleTheme,
    updateWindowSize,
    setFullscreen,
  }
})