<template>
  <div class="main-layout">
    <!-- 顶部弹幕栏 -->
    <TopDanmuBar 
      class="top-danmu-bar"
      :room-status="roomStatus"
      @room-click="handleRoomClick"
    />
    
    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧插件导航 -->
      <LeftPluginNav
        class="left-nav"
        @plugin-selected="handlePluginSelected"
        @system-navigation="handleSystemNavigation"
      />
      
      <!-- 中央插件容器 -->
      <CentralPluginContainer
        class="central-container"
        :current-plugin="currentPlugin"
        :system-page="currentSystemPage"
        @show-installer="showPluginInstaller"
        @system-navigation="handleSystemNavigation"
        @plugin-event="handlePluginEvent"
      />
    </div>
    
    <!-- 插件弹窗管理器 -->
    <PluginPopupManager ref="popupManager" />
    
    <!-- Overlay管理器 -->
    <OverlayManager ref="overlayManager" />
    
    <!-- 全局加载遮罩 -->
    <div v-if="isGlobalLoading" class="global-loading">
      <t-loading size="large" text="正在初始化..." />
    </div>
    
    <!-- 全局通知 -->
    <div v-if="notification" class="global-notification" :class="notification.type">
      <t-icon :name="getNotificationIcon(notification.type)" />
      <span>{{ notification.message }}</span>
      <t-button 
        size="small" 
        variant="text" 
        @click="dismissNotification"
      >
        <t-icon name="close" />
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import TopDanmuBar from '../components/TopDanmuBar.vue';
import LeftPluginNav from '../components/LeftPluginNav.vue';
import CentralPluginContainer from '../components/CentralPluginContainer.vue';
import PluginPopupManager from '../components/PluginPopupManager.vue';
import OverlayManager from '../components/OverlayManager.vue';

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

interface RoomStatus {
  id: string;
  name: string;
  isLive: boolean;
  viewerCount: number;
  lastUpdate: Date;
}

interface Notification {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

const currentPlugin = ref<Plugin | null>(null);
const currentSystemPage = ref<string>('');
const roomStatus = ref<RoomStatus[]>([]);
const isGlobalLoading = ref(true);
const notification = ref<Notification | null>(null);
const popupManager = ref<InstanceType<typeof PluginPopupManager> | null>(null);
const overlayManager = ref<InstanceType<typeof OverlayManager> | null>(null);

let notificationTimer: number | null = null;

// 处理插件选择
function handlePluginSelected(plugin: Plugin) {
  currentPlugin.value = plugin;
  currentSystemPage.value = '';
  
  showNotification({
    type: 'info',
    message: `正在加载插件：${plugin.name}`,
    duration: 2000
  });
}

// 处理系统页面导航
function handleSystemNavigation(page: string) {
  currentPlugin.value = null;
  currentSystemPage.value = page;
  
  const pageNames: Record<string, string> = {
    rooms: '房间管理',
    settings: '系统设置',
    events: '事件历史',
    stats: '数据统计',
    'api-docs': 'API 文档',
    console: '控制台'
  };
  
  showNotification({
    type: 'info',
    message: `切换到：${pageNames[page] || page}`,
    duration: 1500
  });
}

// 处理房间点击
function handleRoomClick(room: RoomStatus) {
  // TODO: 实现房间详情或快速操作
  
  showNotification({
    type: 'info',
    message: `房间：${room.name} (${room.isLive ? '直播中' : '未开播'})`,
    duration: 2000
  });
}

// 显示插件安装器
function showPluginInstaller() {
  // 这个功能由 LeftPluginNav 组件处理
}

// 处理插件事件
function handlePluginEvent(event: { type: string; data: any }) {
  
  switch (event.type) {
    case 'mounted':
      showNotification({
        type: 'success',
        message: '插件加载完成',
        duration: 2000
      });
      break;
    case 'message':
      // 处理插件消息
      handlePluginMessage(event.data);
      break;
    default:
      // Unhandled plugin event
      break;
  }
}

// 处理插件消息
function handlePluginMessage(_message: any) {
  // TODO: 实现插件与主应用的通信
}

// 显示通知
function showNotification(notif: Notification) {
  // 清除之前的通知定时器
  if (notificationTimer) {
    clearTimeout(notificationTimer);
  }
  
  notification.value = notif;
  
  // 自动隐藏通知
  if (notif.duration && notif.duration > 0) {
    notificationTimer = setTimeout(() => {
      dismissNotification();
    }, notif.duration);
  }
}

// 关闭通知
function dismissNotification() {
  notification.value = null;
  if (notificationTimer) {
    clearTimeout(notificationTimer);
    notificationTimer = null;
  }
}

// 获取通知图标
function getNotificationIcon(type: string): string {
  const icons = {
    success: 'check-circle',
    error: 'error-circle',
    warning: 'error-triangle',
    info: 'info-circle'
  };
  return icons[type as keyof typeof icons] || 'info-circle';
}

// 初始化应用
async function initializeApp() {
  try {
    // TODO: 从主进程获取初始数据
    // 1. 加载房间状态
    // 2. 加载插件列表
    // 3. 恢复上次的界面状态
    
    // 模拟初始化过程
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 模拟房间数据
    roomStatus.value = [
      {
        id: 'room1',
        name: '测试房间1',
        isLive: true,
        viewerCount: 1234,
        lastUpdate: new Date()
      },
      {
        id: 'room2', 
        name: '测试房间2',
        isLive: false,
        viewerCount: 0,
        lastUpdate: new Date(Date.now() - 3600000)
      }
    ];
    
    isGlobalLoading.value = false;
    
    showNotification({
      type: 'success',
      message: 'AcFun 直播工具箱已就绪',
      duration: 3000
    });
    
  } catch (error) {
    console.error('App initialization failed:', error);
    isGlobalLoading.value = false;
    
    showNotification({
      type: 'error',
      message: '应用初始化失败：' + (error as Error).message,
      duration: 5000
    });
  }
}

// 清理资源
function cleanup() {
  if (notificationTimer) {
    clearTimeout(notificationTimer);
  }
}

onMounted(() => {
  initializeApp();
});

onUnmounted(() => {
  cleanup();
});
</script>

<style scoped>
.main-layout {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-page);
  overflow: hidden;
}

.top-danmu-bar {
  height: 60px;
  flex-shrink: 0;
  z-index: 100;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-nav {
  flex-shrink: 0;
  z-index: 50;
}

.central-container {
  flex: 1;
  overflow: hidden;
}

.global-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.global-notification {
  position: fixed;
  top: 80px;
  right: 24px;
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--td-shadow-3);
  z-index: 999;
  min-width: 200px;
  max-width: 400px;
  animation: slideInRight 0.3s ease-out;
}

.global-notification.success {
  background: var(--td-success-color-1);
  color: var(--td-success-color);
  border: 1px solid var(--td-success-color-3);
}

.global-notification.error {
  background: var(--td-error-color-1);
  color: var(--td-error-color);
  border: 1px solid var(--td-error-color-3);
}

.global-notification.warning {
  background: var(--td-warning-color-1);
  color: var(--td-warning-color);
  border: 1px solid var(--td-warning-color-3);
}

.global-notification.info {
  background: var(--td-brand-color-1);
  color: var(--td-brand-color);
  border: 1px solid var(--td-brand-color-3);
}

.global-notification span {
  flex: 1;
  font-size: 14px;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .left-nav {
    width: 240px;
  }
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }
  
  .left-nav {
    width: 100%;
    height: 200px;
    order: 2;
  }
  
  .central-container {
    order: 1;
  }
  
  .top-danmu-bar {
    height: 50px;
  }
}
</style>