import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserInfo } from 'acfunlive-http-api';
import { DanmuSessionState } from 'acfunlive-http-api';

export interface DanmuItem {
  id: string;
  type: 'comment' | 'gift' | 'like' | 'enter' | 'follow' | 'richtext' | 'joinclub' | 'share';
  timestamp: number;
  userInfo: UserInfo;
  content?: string;
  giftName?: string;
  giftCount?: number;
  giftValue?: number;
  likeCount?: number;
  rawData?: any;
}

export interface DanmuStats {
  total: number;
  comment: number;
  gift: number;
  like: number;
  enter: number;
  follow: number;
  other: number;
}

export interface DanmuFilter {
  keyword?: string;
  eventType?: string;
  userId?: string;
  startTime?: Date;
  endTime?: Date;
}

export const useDanmuStore = defineStore('danmu', () => {
  // 状态
  const danmuList = ref<DanmuItem[]>([]);
  const currentRoom = ref<string>('');
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const error = ref<string | null>(null);
  const filter = ref<DanmuFilter>({});
  const autoScroll = ref(true);
  const maxItems = ref(1000); // 最大保存条数
  
  // WebSocket相关
  const wsConnection = ref<WebSocket | null>(null);
  const sessionState = ref<DanmuSessionState>(DanmuSessionState.Idle);
  
  // 计算属性
  const stats = computed<DanmuStats>(() => {
    const filtered = filteredDanmuList.value;
    return {
      total: filtered.length,
      comment: filtered.filter(item => item.type === 'comment').length,
      gift: filtered.filter(item => item.type === 'gift').length,
      like: filtered.filter(item => item.type === 'like').length,
      enter: filtered.filter(item => item.type === 'enter').length,
      follow: filtered.filter(item => item.type === 'follow').length,
      other: filtered.filter(item => !['comment', 'gift', 'like', 'enter', 'follow'].includes(item.type)).length,
    };
  });
  
  const filteredDanmuList = computed(() => {
    let filtered = danmuList.value;
    
    // 关键词过滤
    if (filter.value.keyword) {
      const keyword = filter.value.keyword.toLowerCase();
      filtered = filtered.filter(item => 
        item.content?.toLowerCase().includes(keyword) ||
        item.userInfo.nickname?.toLowerCase().includes(keyword) ||
        item.giftName?.toLowerCase().includes(keyword)
      );
    }
    
    // 事件类型过滤
    if (filter.value.eventType && filter.value.eventType !== 'all') {
      filtered = filtered.filter(item => item.type === filter.value.eventType);
    }
    
    // 用户过滤
    if (filter.value.userId) {
      filtered = filtered.filter(item => item.userInfo.userID?.toString() === filter.value.userId);
    }
    
    // 时间过滤
    if (filter.value.startTime) {
      filtered = filtered.filter(item => item.timestamp >= filter.value.startTime!.getTime());
    }
    
    if (filter.value.endTime) {
      filtered = filtered.filter(item => item.timestamp <= filter.value.endTime!.getTime());
    }
    
    return filtered;
  });
  
  // 动作
  async function connectRoom(roomId: string) {
    if (isConnecting.value || (isConnected.value && currentRoom.value === roomId)) {
      return;
    }
    
    try {
      isConnecting.value = true;
      error.value = null;
      
      // 断开现有连接
      if (wsConnection.value) {
        wsConnection.value.close();
      }
      
      // 建立新连接
      const ws = new WebSocket(`ws://localhost:8080/danmu/${roomId}`);
      
      ws.onopen = () => {
        console.log('Danmu WebSocket connected');
        isConnected.value = true;
        isConnecting.value = false;
        currentRoom.value = roomId;
        sessionState.value = DanmuSessionState.Active;
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleDanmuEvent(data);
        } catch (err) {
          console.error('Failed to parse danmu message:', err);
        }
      };
      
      ws.onclose = () => {
        console.log('Danmu WebSocket disconnected');
        isConnected.value = false;
        sessionState.value = DanmuSessionState.Idle;
      };
      
      ws.onerror = (err) => {
        console.error('Danmu WebSocket error:', err);
        error.value = '连接失败';
        isConnecting.value = false;
        sessionState.value = DanmuSessionState.Error;
      };
      
      wsConnection.value = ws;
      
    } catch (err) {
      console.error('Failed to connect danmu:', err);
      error.value = err instanceof Error ? err.message : '连接失败';
      isConnecting.value = false;
      sessionState.value = DanmuSessionState.Error;
    }
  }
  
  function disconnectRoom() {
    if (wsConnection.value) {
      wsConnection.value.close();
      wsConnection.value = null;
    }
    isConnected.value = false;
    isConnecting.value = false;
    currentRoom.value = '';
    sessionState.value = DanmuSessionState.Idle;
  }
  
  function handleDanmuEvent(event: any) {
    const danmuItem: DanmuItem = {
      id: `${Date.now()}-${Math.random()}`,
      type: event.type || 'comment',
      timestamp: event.timestamp || Date.now(),
      userInfo: event.userInfo || {},
      rawData: event,
    };
    
    // 根据事件类型设置特定字段
    switch (event.type) {
      case 'comment':
        danmuItem.content = event.content;
        break;
      case 'gift':
        danmuItem.giftName = event.giftDetail?.giftName;
        danmuItem.giftCount = event.count;
        danmuItem.giftValue = event.value;
        break;
      case 'like':
        danmuItem.likeCount = event.data?.count || 1;
        break;
    }
    
    // 添加到列表
    danmuList.value.push(danmuItem);
    
    // 限制列表长度
    if (danmuList.value.length > maxItems.value) {
      danmuList.value = danmuList.value.slice(-maxItems.value);
    }
  }
  
  function clearDanmu() {
    danmuList.value = [];
  }
  
  function exportDanmu() {
    const data = JSON.stringify(filteredDanmuList.value, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `danmu-${currentRoom.value}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function copyDanmu() {
    const text = filteredDanmuList.value
      .map(item => {
        const time = new Date(item.timestamp).toLocaleTimeString();
        const user = item.userInfo.nickname || '匿名';
        
        switch (item.type) {
          case 'comment':
            return `[${time}] ${user}: ${item.content}`;
          case 'gift':
            return `[${time}] ${user} 送出 ${item.giftName} x${item.giftCount}`;
          case 'like':
            return `[${time}] ${user} 点赞 x${item.likeCount}`;
          default:
            return `[${time}] ${user} ${item.type}`;
        }
      })
      .join('\n');
    
    navigator.clipboard.writeText(text);
  }
  
  function deleteDanmu(id: string) {
    const index = danmuList.value.findIndex(item => item.id === id);
    if (index !== -1) {
      danmuList.value.splice(index, 1);
    }
  }
  
  function updateFilter(newFilter: Partial<DanmuFilter>) {
    filter.value = { ...filter.value, ...newFilter };
  }
  
  return {
    // 状态
    danmuList,
    currentRoom,
    isConnected,
    isConnecting,
    error,
    filter,
    autoScroll,
    maxItems,
    sessionState,
    
    // 计算属性
    stats,
    filteredDanmuList,
    
    // 动作
    connectRoom,
    disconnectRoom,
    clearDanmu,
    exportDanmu,
    copyDanmu,
    deleteDanmu,
    updateFilter,
  };
});