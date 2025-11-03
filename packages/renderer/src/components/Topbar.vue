<template>
  <div class="topbar">
    <!-- 左侧：应用标题和拖拽区域 -->
    <div
      class="topbar-left"
      data-tauri-drag-region
    >
      <div class="app-title">
        <t-icon
          name="logo-github"
          class="app-icon"
        />
        <span class="title-text">ACLiveFrame</span>
      </div>
    </div>
    
    <!-- 中央：账户区域和房间状态 -->
    <div class="topbar-center">
      <!-- 账户弹出卡片 -->
      <t-popup
        v-model="showAccountCard"
        placement="bottom-left"
        :attach="getAttachElement"
        trigger="click"
      >
        <!-- 触发元素 -->
        <div
          ref="accountArea"
          class="account-area"
          @click="toggleAccountCard"
        >
          <t-avatar
            :image="userInfo?.avatar"
            size="small"
          />
          <span class="username">{{ userInfo?.nickname || '游客' }}</span>
          <t-icon
            name="chevron-down"
            class="dropdown-icon"
          />
        </div>
        
        <!-- 弹出内容使用 #content 插槽 -->
        <template #content>
          <div class="account-card">
            <div class="account-info">
              <t-avatar
                :image="userInfo?.avatar"
                size="medium"
              />
              <div class="user-details">
                <div class="user-name">
                  {{ userInfo?.nickname || '游客' }}
                </div>
                <div class="user-id">
                  ID: {{ userInfo?.userID || 'N/A' }}
                </div>
              </div>
            </div>
            <t-divider />
            <div class="account-actions">
              <t-button
                v-if="!userInfo?.userID"
                variant="outline"
                size="small"
                @click="login"
              >
                扫码登录
              </t-button>
              <t-button
                v-else
                variant="outline"
                size="small"
                @click="logout"
              >
                退出登录
              </t-button>
            </div>
          </div>
        </template>
      </t-popup>
      
      <!-- 房间状态指示器 -->
      <div
        class="room-status"
        @click="toggleRoomDrawer"
      >
        <t-badge 
          :count="liveRoomCount" 
          :max-count="99"
          :dot="liveRoomCount === 0"
          :color="liveRoomCount > 0 ? 'success' : 'default'"
        >
          <t-icon
            name="video"
            class="room-icon"
          />
        </t-badge>
        <span class="room-text">{{ roomStatusText }}</span>
      </div>
    </div>
    
    <!-- 右侧：窗口控制按钮 -->
    <div class="topbar-right">
      <t-button 
        variant="text" 
        size="small" 
        class="window-btn minimize-btn"
        @click="minimizeWindow"
      >
        <t-icon name="minus" />
      </t-button>
      <t-button 
        variant="text" 
        size="small" 
        class="window-btn close-btn"
        @click="closeWindow"
      >
        <t-icon name="close" />
      </t-button>
    </div>
    
    <!-- 房间状态抽屉 -->
    <t-drawer
      v-model="showRoomDrawer"
      title="房间状态"
      placement="right"
      size="300px"
    >
      <div class="room-list">
        <div
          v-if="rooms.length === 0"
          class="empty-rooms"
        >
          <t-icon
            name="video-off"
            size="48px"
          />
          <p>暂无监控房间</p>
        </div>
        <div v-else>
          <div 
            v-for="room in rooms" 
            :key="room.id"
            class="room-item"
            :class="{ 'live': room.isLive }"
          >
            <div class="room-info">
              <div class="room-name">
                {{ room.name }}
              </div>
              <div class="room-stats">
                <t-tag 
                  :theme="room.isLive ? 'success' : 'default'"
                  size="small"
                >
                  {{ room.isLive ? '直播中' : '未开播' }}
                </t-tag>
                <span
                  v-if="room.isLive"
                  class="viewer-count"
                >
                  {{ formatViewerCount(room.viewerCount) }}人观看
                </span>
              </div>
            </div>
            <t-button
              size="small"
              variant="text"
              @click="openRoom(room)"
            >
              <t-icon name="jump" />
            </t-button>
          </div>
        </div>
      </div>
    </t-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAccountStore } from '../stores/account';
import { useRoomStore } from '../stores/room';
import type { Room } from '../stores/room';

const accountStore = useAccountStore();
const roomStore = useRoomStore();

const showAccountCard = ref(false);
const showRoomDrawer = ref(false);
const accountArea = ref<HTMLElement>();

const userInfo = computed(() => accountStore.userInfo);
const rooms = computed<Room[]>(() => roomStore.rooms);
const liveRoomCount = computed(() => rooms.value.filter(room => room.isLive).length);
const roomStatusText = computed(() => {
  if (rooms.value.length === 0) return '无房间';
  if (liveRoomCount.value === 0) return '全部离线';
  return `${liveRoomCount.value}个直播中`;
});

function toggleAccountCard() {
  showAccountCard.value = !showAccountCard.value;
}

function toggleRoomDrawer() {
  showRoomDrawer.value = !showRoomDrawer.value;
}

function minimizeWindow() {
  // 调用Electron API最小化窗口
  if (window.electronApi) {
    window.electronApi.window.minimizeWindow();
  }
}

function closeWindow() {
  // 调用Electron API关闭窗口
  if (window.electronApi) {
    window.electronApi.window.closeWindow();
  }
}

function login() {
  accountStore.startLogin();
  showAccountCard.value = false;
}

function logout() {
  accountStore.logout();
  showAccountCard.value = false;
}

function formatViewerCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`;
  }
  return count.toString();
}

function openRoom(room: Room) {
  // 打开房间页面或外部链接
  console.log('Opening room:', room);
}

function getAttachElement(): HTMLElement | null {
  return accountArea.value || null;
}

onMounted(() => {
  // 初始化用户信息和房间状态
  accountStore.loadUserInfo();
  roomStore.loadRooms();
});
</script>

<style scoped>
.topbar {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  background-color: var(--td-bg-color-container);
  border-bottom: 1px solid var(--td-border-level-1-color);
  padding: 0 12px;
  user-select: none;
  -webkit-app-region: drag; /* 启用拖拽 */
}

.topbar-left {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-icon {
  font-size: 16px;
  color: var(--td-brand-color);
}

.title-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: 16px;
}

.account-area {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--td-radius-default);
  cursor: pointer;
  transition: background-color 0.2s;
  -webkit-app-region: no-drag; /* 禁用拖拽，允许点击 */
}

.account-area:hover {
  background-color: var(--td-bg-color-component-hover);
}

.username {
  font-size: 12px;
  color: var(--td-text-color-primary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-icon {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.room-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--td-radius-default);
  cursor: pointer;
  transition: background-color 0.2s;
  -webkit-app-region: no-drag; /* 禁用拖拽，允许点击 */
}

.room-status:hover {
  background-color: var(--td-bg-color-component-hover);
}

.room-text {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.window-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: var(--td-radius-default);
  -webkit-app-region: no-drag; /* 禁用拖拽，允许点击 */
}

.close-btn:hover {
  background-color: var(--td-error-color);
  color: white;
}

/* 账户卡片样式 */
.account-card {
  width: 200px;
  padding: 16px;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-large);
  box-shadow: var(--td-shadow-3);
}

.account-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-id {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin-top: 2px;
}

.account-actions {
  display: flex;
  justify-content: center;
}

/* 房间列表样式 */
.room-list {
  height: 100%;
}

.empty-rooms {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--td-text-color-placeholder);
}

.room-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  transition: background-color 0.2s;
}

.room-item:hover {
  background-color: var(--td-bg-color-component-hover);
}

.room-item.live {
  border-left: 3px solid var(--td-success-color);
}

.room-info {
  flex: 1;
  min-width: 0;
}

.room-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.viewer-count {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
</style>