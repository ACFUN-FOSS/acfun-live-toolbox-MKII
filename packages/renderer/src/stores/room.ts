import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { LiveRoomInfo } from 'acfunlive-http-api';

// 扩展LiveRoomInfo以包含我们需要的额外字段
export interface Room extends LiveRoomInfo {
  id: string;
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
      
      // 从本地存储加载房间列表
      const savedRooms = localStorage.getItem('monitoredRooms');
      if (savedRooms) {
        const parsed = JSON.parse(savedRooms);
        rooms.value = parsed.map((room: any) => ({
          ...room,
          lastUpdate: new Date(room.lastUpdate),
          startTime: room.startTime ? new Date(room.startTime) : undefined,
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
      // TODO: 未实现 - 使用mock数据
       // const response = await fetch('/api/rooms/status', {
       //   method: 'POST',
       //   headers: {
       //     'Content-Type': 'application/json',
       //   },
       //   body: JSON.stringify({ roomIds: rooms.value.map(room => room.id) }),
       // });
       // const data = await response.json();
      
      // Mock数据
       const data = {
         success: true,
         rooms: rooms.value.map(room => ({
           ...room,
           status: Math.random() > 0.5 ? 'live' : 'offline' as 'live' | 'offline' | 'preparing',
           onlineCount: Math.floor(Math.random() * 10000),
           likeCount: Math.floor(Math.random() * 1000),
           lastUpdate: new Date().toISOString()
         }))
       };
      
      if (data.success && data.rooms) {
        // 更新房间状态
        rooms.value = rooms.value.map(room => {
          const updatedRoom = data.rooms.find((r: any) => r.id === room.id);
            if (updatedRoom) {
              return {
              ...room,
              ...updatedRoom,
              lastUpdate: new Date(),
              startTime: updatedRoom.startTime || room.startTime,
            };
          }
          return room;
        });
        
        // 保存到本地存储
        saveRoomsToStorage();
      }
    } catch (err) {
      console.error('Failed to refresh room status:', err);
      error.value = err instanceof Error ? err.message : '刷新房间状态失败';
    }
  }

  async function addRoom(roomUrl: string) {
    try {
      isLoading.value = true;
      error.value = null;
      
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/rooms/add', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ url: roomUrl }),
      // });
      // const data = await response.json();
      
      // Mock数据
       const roomId = roomUrl.split('/').pop() || 'unknown';
       const data = {
         success: true,
         room: {
           id: roomId,
           liveId: roomId,
           liverUID: `uid_${roomId}`,
           title: `直播间 ${roomId}`,
           coverUrl: '',
           onlineCount: Math.floor(Math.random() * 1000),
           status: Math.random() > 0.5 ? 'live' : 'offline' as 'live' | 'offline' | 'preparing',
           likeCount: Math.floor(Math.random() * 100),
           startTime: Date.now(),
           streamer: {
             userId: `uid_${roomId}`,
             userName: `主播${roomId}`,
             avatar: '',
             level: Math.floor(Math.random() * 100) + 1
           },
           category: '游戏',
           subCategory: '其他游戏',
           name: `直播间 ${roomId}`,
           uperName: `主播${roomId}`,
           avatar: '',
           isLive: Math.random() > 0.5,
           viewerCount: Math.floor(Math.random() * 1000),
           lastUpdate: new Date(),
           url: roomUrl,
           priority: 5,
           label: '',
           autoConnect: false
         },
         message: ''
       };
      
      if (data.success && data.room) {
        const newRoom: Room = {
          ...data.room,
          lastUpdate: new Date(),
          startTime: data.room.startTime,
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
      } else {
        throw new Error(data.message || '添加房间失败');
      }
    } catch (err) {
      console.error('Failed to add room:', err);
      error.value = err instanceof Error ? err.message : '添加房间失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  function removeRoom(roomId: string) {
    const index = rooms.value.findIndex(room => room.id === roomId);
    if (index >= 0) {
      rooms.value.splice(index, 1);
      saveRoomsToStorage();
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

  function updateRoomSettings(roomId: string, settings: Partial<Room>) {
    const index = rooms.value.findIndex(room => room.id === roomId);
    if (index >= 0) {
      rooms.value[index] = { ...rooms.value[index], ...settings };
      saveRoomsToStorage();
    }
  }

  // 更新房间状态
  function updateRoomStatus(roomId: string, status: string) {
    const room = rooms.value.find(r => r.liveId === roomId);
    if (room) {
      room.status = status as 'live' | 'offline' | 'preparing';
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
    setAutoRefresh,
    startAutoRefresh,
    stopAutoRefresh,
  };
});