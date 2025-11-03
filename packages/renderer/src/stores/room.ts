import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// 定义我们自己的房间状态类型
export type RoomStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'closed';

// 定义房间接口，不直接扩展LiveRoomInfo以避免类型冲突
export interface Room {
  id: string;
  liveId: string;
  liverUID: string;
  title: string;
  coverUrl: string;
  onlineCount: number;
  status: RoomStatus; // 使用我们自己的状态类型
  likeCount: number;
  startTime: number;
  streamer: {
    userId: string;
    userName: string;
    avatar: string;
    level: number;
  };
  category: string;
  subCategory: string;
  name: string;
  uperName: string;
  avatar?: string;
  isLive: boolean;
  viewerCount: number;
  lastUpdate: Date;
  url: string;
  // 扩展字段
  priority?: number;
  label?: string;
  autoConnect?: boolean;
}

export interface RoomStats {
  totalRooms: number;
  liveRooms: number;
  totalViewers: number;
  lastUpdateTime: Date;
}

export const useRoomStore = defineStore('room', () => {
  // 状态
  const rooms = ref<Room[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const autoRefresh = ref(true);
  const refreshInterval = ref(30000); // 30秒

  // 计算属性
  const liveRooms = computed(() => rooms.value.filter(room => room.isLive));
  const offlineRooms = computed(() => rooms.value.filter(room => !room.isLive));
  const totalViewers = computed(() => 
    liveRooms.value.reduce((sum, room) => sum + room.viewerCount, 0)
  );
  
  const stats = computed<RoomStats>(() => ({
    totalRooms: rooms.value.length,
    liveRooms: liveRooms.value.length,
    totalViewers: totalViewers.value,
    lastUpdateTime: new Date(),
  }));

  // 动作
  async function loadRooms() {
    try {
      isLoading.value = true;
      error.value = null;
      
      // 使用真实的preload API获取房间列表
      const result = await window.electronApi.room.list();
      
      if ('error' in result) {
        throw new Error(result.error);
      }
      
      if ('rooms' in result) {
        // 转换API返回的数据格式为我们的Room格式
        rooms.value = result.rooms.map((apiRoom: any) => ({
          id: apiRoom.roomId,
          liveId: apiRoom.roomId,
          liverUID: `uid_${apiRoom.roomId}`,
          title: `直播间 ${apiRoom.roomId}`,
          coverUrl: '',
          onlineCount: 0,
          status: mapToRoomStatus(apiRoom.status),
          likeCount: 0,
          startTime: apiRoom.connectedAt || Date.now(),
          streamer: {
            userId: `uid_${apiRoom.roomId}`,
            userName: `主播${apiRoom.roomId}`,
            avatar: '',
            level: 1
          },
          category: '游戏',
          subCategory: '其他游戏',
          name: `直播间 ${apiRoom.roomId}`,
          uperName: `主播${apiRoom.roomId}`,
          avatar: '',
          isLive: apiRoom.status === 'connected',
          viewerCount: 0,
          lastUpdate: new Date(apiRoom.lastEventAt || Date.now()),
          url: `https://live.acfun.cn/live/${apiRoom.roomId}`,
          priority: 5,
          label: '',
          autoConnect: false
        }));
      }
      
      // 刷新房间状态
      await refreshRoomStatus();
    } catch (err) {
      console.error('Failed to load rooms:', err);
      error.value = err instanceof Error ? err.message : '加载房间列表失败';
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshRoomStatus() {
    if (rooms.value.length === 0) return;
    
    try {
      // 使用真实的preload API获取每个房间的状态
      const statusPromises = rooms.value.map(async (room) => {
        try {
          const result = await window.electronApi.room.status(room.id);
          if ('error' in result) {
            console.warn(`Failed to get status for room ${room.id}:`, result.error);
            return room; // 返回原始房间信息
          }
          
          // 更新房间状态
          return {
            ...room,
            status: mapToRoomStatus(result.status),
            isLive: result.status === 'connected',
            lastUpdate: new Date(result.lastEventAt || Date.now()),
            viewerCount: result.eventCount || 0, // 使用事件数量作为活跃度指标
          };
        } catch (err) {
          console.warn(`Error getting status for room ${room.id}:`, err);
          return room; // 返回原始房间信息
        }
      });
      
      const updatedRooms = await Promise.all(statusPromises);
      rooms.value = updatedRooms;
      
      // 保存到本地存储
      saveRoomsToStorage();
    } catch (err) {
      console.error('Failed to refresh room status:', err);
      error.value = err instanceof Error ? err.message : '刷新房间状态失败';
    }
  }

  async function addRoom(roomUrl: string) {
    try {
      isLoading.value = true;
      error.value = null;
      
      // 从URL中提取房间ID
      const roomId = roomUrl.split('/').pop() || roomUrl;
      
      // 使用真实的preload API连接房间
      const result = await window.electronApi.room.connect(roomId);
      
      if (!result.success) {
        throw new Error(result.error || '连接房间失败');
      }
      
      // 获取房间状态信息
      const statusResult = await window.electronApi.room.status(roomId);
      
      // 检查状态结果是否包含错误
       let roomStatus: RoomStatus = 'connecting';
       let connectedAt = Date.now();
       let eventCount = 0;
       let lastEventAt = Date.now();
       let isLive = false;
      
      if ('error' in statusResult) {
        console.warn(`Failed to get status for room ${roomId}:`, statusResult.error);
        // 使用默认值
      } else {
         roomStatus = mapToRoomStatus(statusResult.status || 'connecting');
         connectedAt = statusResult.connectedAt || Date.now();
         eventCount = statusResult.eventCount || 0;
         lastEventAt = statusResult.lastEventAt || Date.now();
         isLive = statusResult.status === 'connected';
       }
      
      const newRoom: Room = {
        id: roomId,
        liveId: roomId,
        liverUID: `uid_${roomId}`,
        title: `直播间 ${roomId}`,
        coverUrl: '',
        onlineCount: 0,
        status: roomStatus,
        likeCount: 0,
        startTime: connectedAt,
        streamer: {
          userId: `uid_${roomId}`,
          userName: `主播${roomId}`,
          avatar: '',
          level: 1
        },
        category: '游戏',
        subCategory: '其他游戏',
        name: `直播间 ${roomId}`,
        uperName: `主播${roomId}`,
        avatar: '',
        isLive: isLive,
        viewerCount: eventCount,
        lastUpdate: new Date(lastEventAt),
        url: roomUrl,
        priority: 5,
        label: '',
        autoConnect: false
      };
      
      // 检查是否已存在
      const existingIndex = rooms.value.findIndex(room => room.id === newRoom.id);
      if (existingIndex >= 0) {
        rooms.value[existingIndex] = newRoom;
      } else {
        rooms.value.push(newRoom);
      }
      
      saveRoomsToStorage();
      return newRoom;
    } catch (err) {
      console.error('Failed to add room:', err);
      error.value = err instanceof Error ? err.message : '添加房间失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function removeRoom(roomId: string) {
    try {
      // 使用真实的preload API断开房间连接
      const result = await window.electronApi.room.disconnect(roomId);
      
      if (!result.success) {
        console.warn(`Failed to disconnect room ${roomId}:`, result.error);
        // 即使断开连接失败，也从本地列表中移除
      }
      
      const index = rooms.value.findIndex(room => room.id === roomId);
      if (index >= 0) {
        rooms.value.splice(index, 1);
        saveRoomsToStorage();
      }
    } catch (err) {
      console.error('Failed to remove room:', err);
      // 即使API调用失败，也从本地列表中移除
      const index = rooms.value.findIndex(room => room.id === roomId);
      if (index >= 0) {
        rooms.value.splice(index, 1);
        saveRoomsToStorage();
      }
    }
  }

  function clearAllRooms() {
    rooms.value = [];
    saveRoomsToStorage();
  }

  function saveRoomsToStorage() {
    try {
      localStorage.setItem('monitoredRooms', JSON.stringify(rooms.value));
    } catch (err) {
      console.error('Failed to save rooms to storage:', err);
    }
  }

  function getRoomById(roomId: string): Room | undefined {
    return rooms.value.find(room => room.id === roomId);
  }

  async function setPriority(roomId: string, priority: number) {
    try {
      // 使用真实的preload API设置房间优先级
      const result = await window.electronApi.room.setPriority(roomId, priority);
      
      if (!result.success) {
        throw new Error(result.error || '设置优先级失败');
      }
      
      const room = rooms.value.find(r => r.id === roomId);
      if (room) {
        room.priority = priority;
        saveRoomsToStorage();
      }
    } catch (err) {
      console.error('Failed to set room priority:', err);
      throw err;
    }
  }

  async function setLabel(roomId: string, label: string) {
    try {
      // 使用真实的preload API设置房间标签
      const result = await window.electronApi.room.setLabel(roomId, label);
      
      if (!result.success) {
        throw new Error(result.error || '设置标签失败');
      }
      
      const room = rooms.value.find(r => r.id === roomId);
      if (room) {
        room.label = label;
        saveRoomsToStorage();
      }
    } catch (err) {
      console.error('Failed to set room label:', err);
      throw err;
    }
  }

  function updateRoomSettings(roomId: string, settings: Partial<Room>) {
    const index = rooms.value.findIndex(room => room.id === roomId);
    if (index >= 0) {
      rooms.value[index] = { ...rooms.value[index], ...settings };
      saveRoomsToStorage();
    }
  }

  // 状态映射函数
  function mapToRoomStatus(status: string): RoomStatus {
    switch (status) {
      case 'connected':
      case 'open':
        return 'connected';
      case 'connecting':
      case 'connecting...':
        return 'connecting';
      case 'disconnected':
      case 'closed':
        return 'disconnected';
      case 'error':
        return 'error';
      default:
        return 'disconnected';
    }
  }

  // 更新房间状态
  function updateRoomStatus(roomId: string, status: string) {
    const room = rooms.value.find(r => r.liveId === roomId);
    if (room) {
      room.status = mapToRoomStatus(status);
      saveRoomsToStorage();
    }
  }

    // 自动刷新功能
  let refreshTimer: NodeJS.Timeout | null = null;

  function startAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    
    if (autoRefresh.value && refreshInterval.value > 0) {
      refreshTimer = setInterval(() => {
        refreshRoomStatus();
      }, refreshInterval.value);
    }
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function setAutoRefresh(enabled: boolean, interval?: number) {
    autoRefresh.value = enabled;
    if (interval !== undefined) {
      refreshInterval.value = interval;
    }
    
    if (enabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }

  // 初始化
  loadRooms().then(() => {
    if (autoRefresh.value) {
      startAutoRefresh();
    }
  });

  return {
    // 状态
    rooms,
    isLoading,
    error,
    autoRefresh,
    refreshInterval,
    
    // 计算属性
    liveRooms,
    offlineRooms,
    totalViewers,
    stats,
    
    // 动作
    loadRooms,
    refreshRoomStatus,
    refreshRooms: refreshRoomStatus, // 别名
    addRoom,
    removeRoom,
    clearAllRooms,
    getRoomById,
    updateRoomSettings,
    updateRoomStatus,
    setPriority,
    setLabel,
    setAutoRefresh,
    startAutoRefresh,
    stopAutoRefresh,
  };
});