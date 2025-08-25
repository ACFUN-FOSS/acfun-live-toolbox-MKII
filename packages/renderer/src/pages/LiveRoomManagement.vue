<template>
  <div class="live-room-management">
    <t-card class="page-header-card" title="直播房间管理">
      <template #extra>
        <t-button @click="refreshRoomInfo" icon="refresh" theme="primary">刷新</t-button>
      </template>
    </t-card>

    <t-row :gutter="20" class="mt-4">
      <t-col :span="24" :md="16">
        <t-card title="房间信息" :loading="loading.roomInfo">
          <div v-if="error.roomInfo" class="error-message">{{ error.roomInfo }}</div>
          <div v-else class="room-info-container">
            <div class="room-basic-info">
              <div class="room-title">
                <span class="label">标题:</span>
                <t-input v-model="roomInfo.title" placeholder="输入房间标题" />
              </div>
              <div class="room-cover">
                <span class="label">封面:</span>
                <div class="cover-preview" :style="{ backgroundImage: `url(${roomInfo.coverUrl || defaultCover})` }"></div>
                <t-button theme="default" @click="openFileDialog">上传封面</t-button>
              </div>
              <div class="room-category">
                <span class="label">分类:</span>
                <t-select v-model="roomInfo.category" :options="categories" placeholder="选择分类" />
              </div>
              <div class="room-subcategory">
                <span class="label">子分类:</span>
                <t-select v-model="roomInfo.subCategory" :options="subCategories" placeholder="选择子分类" />
              </div>
              <div class="room-clip">
                <span class="label">允许剪辑:</span>
                <t-switch v-model="roomInfo.allowClip" />
              </div>
            </div>
            <t-button @click="updateRoomInfo" theme="primary" class="mt-4">保存修改</t-button>
          </div>
        </t-card>
      </t-col>

      <t-col :span="24" :md="8">
        <t-card title="推流信息" :loading="loading.streamInfo">
          <div v-if="error.streamInfo" class="error-message">{{ error.streamInfo }}</div>
          <div v-else class="stream-info-container">
            <div class="stream-server">
              <span class="label">推流服务器:</span>
              <t-input v-model="streamInfo.server" readonly />
            </div>
            <div class="stream-key">
              <span class="label">推流码:</span>
              <t-input v-model="streamInfo.key" readonly type="password" />
              <t-button @click="showStreamKey" theme="default" size="small" class="ml-2">显示</t-button>
        <t-button @click="showStreamKeyDialog = true" theme="primary" size="small" class="ml-2">查看推流码</t-button>
      </div>
      <t-button @click="refreshStreamKey" theme="default" class="mt-2 mr-2">刷新推流码</t-button>
      <t-button @click="copyStreamInfo" theme="default" class="mt-2">复制推流信息</t-button>
          </div>
        </t-card>

        <t-card title="推流状态" class="mt-4">
          <div class="status-container">
            <div class="obs-status">
              <span class="label">OBS状态:</span>
              <span class="status-badge" :class="obsStatus === 'online' ? 'online' : obsStatus === 'connecting' ? 'connecting' : 'offline'">{{ obsStatus === 'online' ? '在线' : obsStatus === 'connecting' ? '连接中' : '离线' }}</span>
              <t-button @click="connectOBS" theme="default" size="small" class="ml-2" :disabled="obsStatus === 'online' || obsStatus === 'connecting'">连接OBS</t-button>
            </div>
            <div class="stream-status">
              <span class="label">推流状态:</span>
              <span class="status-badge" :class="streamStatus === 'live' ? 'online' : streamStatus === 'waiting' ? 'waiting' : 'offline'">{{ streamStatus === 'live' ? '直播中' : streamStatus === 'waiting' ? '等待中' : '未开播' }}</span>
              <t-button @click="startStream" theme="primary" size="small" class="ml-2 mr-2" :disabled="streamStatus === 'live' || obsStatus !== 'online'">{{ streamStatus === 'live' ? '正在直播' : '开始直播' }}</t-button>
              <t-button @click="stopStream" theme="danger" size="small" :disabled="streamStatus !== 'live'">{{ streamStatus === 'live' ? '停止直播' : '未开播' }}</t-button>
            </div>
          </div>
        </t-card>
      </t-col>
    </t-row>
  </div>

  <!-- 推流码显示对话框 -->
  <t-dialog v-model:visible="showStreamKeyDialog" title="推流码" width="400px">
    <div class="stream-key-dialog-content">
      <p>服务器: {{ streamInfo.server }}</p>
      <div class="stream-key-display">
        <span>{{ currentStreamKey }}</span>
        <t-button @click="copyStreamKey" theme="default" size="small" class="ml-2">复制</t-button>
      </div>
      <p class="tips mt-2">请将推流码配置到OBS等推流软件中</p>
    </div>
  </t-dialog>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { ipcRenderer } from 'electron';
import { TMessage } from 'tdesign-vue-next';

// 定义接口
interface RoomInfo {
  title: string;
  coverUrl: string;
  allowClip: boolean;
  category: string;
  subCategory: string;
  customDanmuUrl: string;
  officialDanmuUrl: string;
}

interface StreamInfo {
  server: string;
  key: string;
}

interface LoadingState {
  roomInfo: boolean;
  streamInfo: boolean;
}

interface ErrorState {
  roomInfo: string | null;
  streamInfo: string | null;
}

// 状态定义
const roomInfo = ref<RoomInfo>({
  title: '未设置标题',
  coverUrl: '',
  allowClip: false,
  category: '',
  subCategory: '',
  customDanmuUrl: '',
  officialDanmuUrl: ''
});

const streamInfo = ref<StreamInfo>({
  server: '',
  key: ''
});
const showStreamKeyDialog = ref(false);

const obsStatus = ref<'online' | 'offline' | 'connecting'>('offline');
const streamStatus = ref<'live' | 'waiting' | 'offline'>('offline');
const loading = ref<LoadingState>({
  roomInfo: false,
  streamInfo: false
});
const error = ref<ErrorState>({
  roomInfo: null,
  streamInfo: null
});
const showStreamKeyDialog = ref(false);

// 计算属性，获取完整推流码
const currentStreamKey = computed(() => {
  return streamInfo.value.key ? `${streamInfo.value.server}/${streamInfo.value.key}` : '';
});
const defaultCover = 'https://picsum.photos/400/225';
const categories = [
  { label: '游戏', value: 'game' },
  { label: '娱乐', value: 'entertainment' },
  { label: '音乐', value: 'music' },
  { label: '科技', value: 'technology' },
  { label: '生活', value: 'life' },
  { label: '其他', value: 'other' }
];
const subCategories = computed(() => {
  // 根据分类动态生成子分类
  switch (roomInfo.value.category) {
    case 'game':
      return [
        { label: '英雄联盟', value: 'lol' },
        { label: '王者荣耀', value: 'honor' },
        { label: '原神', value: 'genshin' },
        { label: '绝地求生', value: 'pubg' },
        { label: '其他游戏', value: 'other_game' }
      ];
    case 'entertainment':
      return [
        { label: '聊天', value: 'chat' },
        { label: '颜值', value: 'beauty' },
        { label: '美食', value: 'food' },
        { label: '旅行', value: 'travel' },
        { label: '其他娱乐', value: 'other_entertainment' }
      ];
    default:
      return [
        { label: '无', value: '' },
      ];
  }
});

// 方法定义
const fetchRoomInfo = async () => {
  loading.value.roomInfo = true;
  error.value.roomInfo = null;
  try {
      const result = await ipcRenderer.invoke('live:getRoomInfo');
      if (result.success) {
        roomInfo.value = result.data;
      } else {
        error.value.roomInfo = `获取房间信息失败: ${result.error || '未知错误'}`;
      }
    } catch (err) {
    error.value.roomInfo = `获取房间信息失败: ${err instanceof Error ? err.message : String(err)}`;
    console.error('Failed to fetch room info:', err);
  } finally {
    loading.value.roomInfo = false;
  }
};

const fetchStreamInfo = async () => {
  loading.value.streamInfo = true;
  error.value.streamInfo = null;
  try {
      const result = await ipcRenderer.invoke('live:getStreamKey');
      if (result.success) {
        streamInfo.value = result.data;
      } else {
        error.value.streamInfo = `获取推流信息失败: ${result.error || '未知错误'}`;
      }
    } catch (err) {
    error.value.streamInfo = `获取推流信息失败: ${err instanceof Error ? err.message : String(err)}`;
    console.error('Failed to fetch stream info:', err);
  } finally {
    loading.value.streamInfo = false;
  }
};

const updateRoomInfo = async () => {
  loading.value.roomInfo = true;
  error.value.roomInfo = null;
  try {
    await ipcRenderer.invoke('live:updateRoomInfo', roomInfo.value);
    TMessage.success('房间信息更新成功');
  } catch (err) {
    error.value.roomInfo = `更新房间信息失败: ${err instanceof Error ? err.message : String(err)}`;
    console.error('Failed to update room info:', err);
  } finally {
    loading.value.roomInfo = false;
  }
};

const refreshRoomInfo = async () => {
  await fetchRoomInfo();
};

function copyStreamKey() {
  if (currentStreamKey.value) {
    navigator.clipboard.writeText(currentStreamKey.value)
      .then(() => TMessage.success('推流码已复制到剪贴板'))
      .catch(err => {
        console.error('Failed to copy stream key:', err);
        TMessage.error('复制失败，请手动复制');
      });
  }
}

const refreshStreamKey = async () => {
  loading.value.streamInfo = true;
  error.value.streamInfo = null;
  try {
      const result = await ipcRenderer.invoke('live:refreshStreamKey');
      if (result.success) {
        streamInfo.value = result.data;
        TMessage.success('推流码刷新成功');
      } else {
        error.value.streamInfo = `刷新推流码失败: ${result.error || '未知错误'}`;
      }
    } catch (err) {
    error.value.streamInfo = `刷新推流码失败: ${err instanceof Error ? err.message : String(err)}`;
    console.error('Failed to refresh stream key:', err);
  } finally {
    loading.value.streamInfo = false;
  }
};

const connectOBS = async () => {
  obsStatus.value = 'connecting';
  try {
    await ipcRenderer.invoke('live:connectOBS');
    obsStatus.value = 'online';
    TMessage.success('OBS连接成功');
  } catch (err) {
    obsStatus.value = 'offline';
    TMessage.error(`OBS连接失败: ${err instanceof Error ? err.message : String(err)}`);
    console.error('Failed to connect OBS:', err);
  }
};

const startStream = async () => {
  if (obsStatus.value !== 'online') {
    TMessage.warning('请先连接OBS');
    return;
  }
  try {
    await ipcRenderer.invoke('live:startStream');
    streamStatus.value = 'live';
    TMessage.success('直播已开始');
  } catch (err) {
    TMessage.error(`开始直播失败: ${err instanceof Error ? err.message : String(err)}`);
    console.error('Failed to start stream:', err);
  }
};

const stopStream = async () => {
  try {
    await ipcRenderer.invoke('live:stopStream');
    streamStatus.value = 'offline';
    TMessage.success('直播已停止');
  } catch (err) {
    TMessage.error(`停止直播失败: ${err instanceof Error ? err.message : String(err)}`);
    console.error('Failed to stop stream:', err);
  }
};

const showStreamKey = () => {
  currentStreamKey.value = streamInfo.value.key;
  showStreamKeyDialog.value = true;
};

const copyStreamInfo = () => {
  const info = `服务器: ${streamInfo.value.server}\n推流码: ${streamInfo.value.key}`;
  navigator.clipboard.writeText(info).then(() => {
    TMessage.success('推流信息已复制到剪贴板');
  }).catch(err => {
    TMessage.error('复制失败，请手动复制');
    console.error('Failed to copy stream info:', err);
  });
};

const openFileDialog = () => {
  // 这里应该调用文件选择对话框，为简化示例暂不实现
  TMessage.info('文件选择功能暂未实现');
};

// 监听状态更新
const setupListeners = () => {
  const obsStatusListener = ipcRenderer.on('live:obsStatusChanged', (_, status) => {
    obsStatus.value = status;
  });

  const streamStatusListener = ipcRenderer.on('live:streamStatusChanged', (_, status) => {
    streamStatus.value = status;
  });

  return () => {
    obsStatusListener.dispose();
    streamStatusListener.dispose();
  };
};

// 组件挂载时
onMounted(() => {
  fetchRoomInfo();
  fetchStreamInfo();
  // 立即获取一次OBS和推流状态
  fetchOBSStatus();
  fetchStreamStatus();

  // 设置监听器并获取清理函数
  const cleanupListeners = setupListeners();

  // 定期刷新状态
  const interval = setInterval(() => {
    // 避免过于频繁的请求
    if (!loading.value.roomInfo) {
      fetchRoomInfo();
    }
    if (!loading.value.streamInfo) {
      fetchStreamInfo();
    }
  }, 30000);

  // 定期更新OBS和推流状态
  const statusInterval = setInterval(() => {
    fetchOBSStatus();
    fetchStreamStatus();
  }, 5000);

  // 清理函数
  onUnmounted(() => {
    clearInterval(interval);
    clearInterval(statusInterval);
    cleanupListeners();
  });
});

// 获取OBS状态
const fetchOBSStatus = async () => {
  try {
    const result = await ipcRenderer.invoke('live:getOBSStatus');
    if (result.success) {
      obsStatus.value = result.data.status;
    }
  } catch (err) {
    console.error('Failed to fetch OBS status:', err);
  }
};

// 获取推流状态
const fetchStreamStatus = async () => {
  try {
    const result = await ipcRenderer.invoke('live:getStreamStatus');
    if (result.success) {
      streamStatus.value = result.data.status;
    }
  } catch (err) {
    console.error('Failed to fetch stream status:', err);
  }
};

</script>

<style scoped>
.live-room-management {
  padding: 20px;
}

.room-info-container,
.stream-info-container {
  display: flex;
  flex-direction: column;
}

.room-basic-info > div,
.stream-info-container > div {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

.stream-key-dialog-content {
  padding: 20px;
}

.stream-key-display {
  display: flex;
  align-items: center;
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  word-break: break-all;
}

.label {
  width: 80px;
  font-weight: bold;
}

.t-input {
  flex: 1;
}

.cover-preview {
  width: 200px;
  height: 112px;
  background-size: cover;
  background-position: center;
  border-radius: 4px;
  margin-right: 10px;
  border: 1px solid #eee;
}

.room-cover {
  align-items: flex-start !important;
}

.error-message {
  color: #f53f3f;
  padding: 10px;
  background-color: #fff1f0;
  border-radius: 4px;
  margin-bottom: 10px;
}

.status-container > div {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-right: 10px;
}

.online {
  background-color: #00b42a;
  color: white;
}

.offline {
  background-color: #86909c;
  color: white;
}

.connecting,
.waiting {
  background-color: #ff7d00;
  color: white;
}
</style>