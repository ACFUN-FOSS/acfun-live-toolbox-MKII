import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useSidebarStore = defineStore('sidebar', () => {
  // 状态 - 固定为展开状态
  const collapsed = ref(false); // 固定为false，不允许折叠
  const width = ref(240); // 默认宽度
  const collapsedWidth = ref(64); // 保留但不使用

  // 计算属性 - 始终返回展开宽度
  const currentWidth = computed(() => width.value); // 始终使用展开宽度
  const isCollapsed = computed(() => false); // 始终返回false

  // 动作 - 移除折叠相关功能
  function toggleCollapse() {
    // 不执行任何操作，保持展开状态
    console.log('Sidebar collapse is disabled - always expanded');
  }

  function setCollapsed(_value: boolean) {
    // 不执行任何操作，保持展开状态
    console.log('Sidebar collapse is disabled - always expanded');
  }

  function setWidth(value: number) {
    width.value = Math.max(200, Math.min(400, value)); // 限制宽度范围
    saveToStorage();
  }

  function setCollapsedWidth(value: number) {
    collapsedWidth.value = Math.max(48, Math.min(80, value)); // 保留但不使用
    saveToStorage();
  }

  function saveToStorage() {
    try {
      const sidebarState = {
        collapsed: false, // 始终保存为false
        width: width.value,
        collapsedWidth: collapsedWidth.value,
      };
      localStorage.setItem('sidebarState', JSON.stringify(sidebarState));
    } catch (err) {
      console.error('Failed to save sidebar state:', err);
    }
  }

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('sidebarState');
      if (saved) {
        const state = JSON.parse(saved);
        // 忽略保存的collapsed状态，始终保持展开
        collapsed.value = false;
        width.value = state.width ?? 240;
        collapsedWidth.value = state.collapsedWidth ?? 64;
      }
    } catch (err) {
      console.error('Failed to load sidebar state:', err);
    }
  }

  // 响应式调整（针对小屏幕） - 移除自动折叠逻辑
  function handleResize() {
    const screenWidth = window.innerWidth;
    
    // 移除自动折叠逻辑，保持展开状态
    // 可以根据需要调整宽度，但不折叠
    if (screenWidth <= 1024 && width.value > 200) {
      // 可以适当减小宽度，但不折叠
      setWidth(Math.max(200, Math.min(width.value, 220)));
    }
  }

  // 初始化
  loadFromStorage();
  
  // 监听窗口大小变化
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
    handleResize(); // 初始检查
  }

  return {
    // 状态
    collapsed,
    width,
    collapsedWidth,
    
    // 计算属性
    currentWidth,
    isCollapsed,
    
    // 动作
    toggleCollapse,
    setCollapsed,
    setWidth,
    setCollapsedWidth,
    handleResize,
  };
});