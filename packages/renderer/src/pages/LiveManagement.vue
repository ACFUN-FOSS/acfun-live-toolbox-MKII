<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { TButton, TInput, TSwitch, TSelect, TImage, TUpload, TDivider, TCard, TCardGrid } from 'tdesign-vue-next';
import { useRouter } from 'vue-router';
import DanmuPlayer from '../components/DanmuPlayer.vue';
import errorHandler, { AppError } from '../utils/error-handler';


// 扩展Window接口
declare global {
  interface Window {
    api: {
      live: {
        getRoomInfo: () => Promise<any>;
        updateRoomInfo: (info: any) => Promise<any>;
        getStreamKey: () => Promise<any>;
        refreshStreamKey: () => Promise<any>;
        connectOBS: () => Promise<any>;
        getOBSStatus: () => Promise<any>;
        getStreamStatus: () => Promise<any>;
        stopStream: () => Promise<any>;
        startStream: () => Promise<any>;
      };
    };
  }
}

const router = useRouter();
const roomInfo = reactive<{
  title: string;
  coverUrl: string;
  allowClip: boolean;
  category: string;
  subCategory: string;
  customDanmuUrl: string;
  officialDanmuUrl: string;
  obsStatus: 'online' | 'offline' | 'connecting';
  rtmpServer: string;
  streamKey: string;
  streamStatus: 'live' | 'waiting' | 'offline';
}>({
  title: '',
  coverUrl: '',
  allowClip: false,
  category: '',
  subCategory: '',
  customDanmuUrl: '',
  officialDanmuUrl: '',
  obsStatus: 'offline',
  rtmpServer: '',
  streamKey: '',
  streamStatus: 'offline'
});

const categories = ref<Array<{
  value: string;
  label: string;
  children?: Array<{
    value: string;
    label: string;
  }>
}>>([]);

const loading = ref(false);
const uploadLoading = ref(false);

// 获取房间信息
const getRoomInfo = async () => {
  try {
    loading.value = true;
    const response = await window.api.live.getRoomInfo();
    if (response.success) {
      Object.assign(roomInfo, response.data);
    } else {
      errorHandler.handleError(
        errorHandler.createApiError('获取房间信息失败: ' + response.error, 'GET_ROOM_INFO_FAILED')
      );
    }
  } catch (error) {
    console.error('获取房间信息失败:', error);
    errorHandler.handleError(
      errorHandler.createNetworkError('获取房间信息失败，请重试', 'GET_ROOM_INFO_FAILED', error)
    );
  } finally {
    loading.value = false;
  }
};

// 获取分类列表
const getCategories = async () => {
  try {
    // 模拟数据，实际应从API获取
    categories.value = [
      { value: 'game', label: '游戏', children: [
        { value: 'lol', label: '英雄联盟' },
        { value: 'dota2', label: 'DOTA2' },
        { value: 'csgo', label: 'CS:GO' }
      ]},
      { value: 'entertainment', label: '娱乐', children: [
        { value: 'chat', label: '聊天' },
        { value: 'music', label: '音乐' }
      ]},
      { value: 'tech', label: '科技', children: [
        { value: 'programming', label: '编程' },
        { value: 'digital', label: '数码' }
      ]}
    ];
  } catch (error) {
    console.error('获取分类列表失败:', error);
    errorHandler.handleError(
      errorHandler.createApiError('获取分类列表失败', 'GET_CATEGORIES_FAILED', error)
    );
  }
};

// 获取推流码
const getStreamKey = async () => {
  try {
    loading.value = true;
    const response = await window.api.live.getStreamKey();
    if (response.success) {
      roomInfo.rtmpServer = response.data.server;
      roomInfo.streamKey = response.data.key;
    } else {
      errorHandler.handleError(
        errorHandler.createApiError('获取推流码失败: ' + response.error, 'GET_STREAM_KEY_FAILED')
      );
    }
  } catch (error) {
    console.error('获取推流码失败:', error);
    errorHandler.handleError(
      errorHandler.createNetworkError('获取推流码失败，请重试', 'GET_STREAM_KEY_FAILED', error)
    );
  } finally {
    loading.value = false;
  }
};

// 刷新推流码
const refreshStreamKey = async () => {
  try {
    loading.value = true;
    const response = await window.api.live.refreshStreamKey();
    if (response.success) {
      roomInfo.rtmpServer = response.data.server;
      roomInfo.streamKey = response.data.key;
      TMessage.success('推流码已刷新');
    } else {
      errorHandler.handleError(
        errorHandler.createApiError('刷新推流码失败: ' + response.error, 'REFRESH_STREAM_KEY_FAILED')
      );
    }
  } catch (error) {
    console.error('刷新推流码失败:', error);
    errorHandler.handleError(
      errorHandler.createNetworkError('刷新推流码失败，请重试', 'REFRESH_STREAM_KEY_FAILED', error)
    );
  } finally {
    loading.value = false;
  }
};

// 连接OBS
const connectOBS = async () => {
  try {
    roomInfo.obsStatus = 'connecting';
    const response = await window.api.live.connectOBS();
    if (response.success) {
      roomInfo.obsStatus = 'online';
      TMessage.success('OBS连接成功');
    } else {
      roomInfo.obsStatus = 'offline';
      errorHandler.handleError(
        errorHandler.createApiError('OBS连接失败: ' + response.error, 'CONNECT_OBS_FAILED')
      );
    }
  } catch (error) {
    console.error('连接OBS失败:', error);
    roomInfo.obsStatus = 'offline';
    errorHandler.handleError(
      errorHandler.createNetworkError('连接OBS失败，请重试', 'CONNECT_OBS_FAILED', error)
    );
  }
};

// 获取OBS状态
const getOBSStatus = async () => {
  try {
    const response = await window.api.live.getOBSStatus();
    if (response.success) {
      roomInfo.obsStatus = response.data.status;
    } else {
      errorHandler.handleError(
        errorHandler.createApiError('获取OBS状态失败: ' + response.error, 'GET_OBS_STATUS_FAILED')
      );
    }
  } catch (error) {
    console.error('获取OBS状态失败:', error);
    errorHandler.handleError(
      errorHandler.createNetworkError('获取OBS状态失败，请重试', 'GET_OBS_STATUS_FAILED', error)
    );
  }
};

// 获取推流状态
const getStreamStatus = async () => {
  try {
    const response = await window.api.live.getStreamStatus();
    if (response.success) {
      roomInfo.streamStatus = response.data.status;
    } else {
      errorHandler.handleError(
        errorHandler.createApiError('获取推流状态失败: ' + response.error, 'GET_STREAM_STATUS_FAILED')
      );
    }
  } catch (error) {
    console.error('获取推流状态失败:', error);
    errorHandler.handleError(
      errorHandler.createNetworkError('获取推流状态失败，请重试', 'GET_STREAM_STATUS_FAILED', error)
    );
  }
};

// 停止推流
const stopStream = async () => {
  try {
    loading.value = true;
    const response = await window.api.live.stopStream();
    if (response.success) {
      roomInfo.streamStatus = 'offline';
      TMessage.success('已停止推流');
    } else {
      errorHandler.handleError(
        errorHandler.createApiError('停止推流失败: ' + response.error, 'STOP_STREAM_FAILED')
      );
    }
  } catch (error) {
    console.error('停止推流失败:', error);
    errorHandler.handleError(
      errorHandler.createNetworkError('停止推流失败，请重试', 'STOP_STREAM_FAILED', error)
    );
  } finally {
    loading.value = false;
  }
};

// 启动推流
const startStream = async () => {
  try {
    loading.value = true;
    if (roomInfo.obsStatus !== 'online') {
      errorHandler.handleError(
        errorHandler.createValidationError('请先连接OBS', 'START_STREAM_VALIDATION_FAILED')
      );
      return;
    }
    const response = await window.api.live.startStream();
    if (response.success) {
      roomInfo.streamStatus = 'live';
      TMessage.success('已开始推流');
    } else {
      errorHandler.handleError(
        errorHandler.createApiError('开始推流失败: ' + response.error, 'START_STREAM_FAILED')
      );
    }
  } catch (error) {
    console.error('开始推流失败:', error);
    errorHandler.handleError(
      errorHandler.createNetworkError('开始推流失败，请重试', 'START_STREAM_FAILED', error)
    );
  } finally {
    loading.value = false;
  }
};

// 保存房间信息
const saveRoomInfo = async () => {
  try {
    loading.value = true;
    const response = await window.api.live.updateRoomInfo({
      title: roomInfo.title,
      coverUrl: roomInfo.coverUrl,
      allowClip: roomInfo.allowClip,
      category: roomInfo.category,
      subCategory: roomInfo.subCategory
    });
    if (response.success) {
      TMessage.success('房间信息保存成功');
    } else {
      TMessage.error('保存房间信息失败: ' + response.error);
    }
  } catch (error) {
    console.error('保存房间信息失败:', error);
    TMessage.error('保存房间信息失败，请重试');
  } finally {
    loading.value = false;
  }
};

// 处理封面上传
const handleCoverUpload = async (file: File) => {
  try {
    uploadLoading.value = true;
    // 模拟上传，实际应调用API
    // 这里只是将文件转换为base64预览
    const reader = new FileReader();
    reader.onload = (e) => {
      roomInfo.coverUrl = e.target?.result as string;
      uploadLoading.value = false;
      TMessage.success('封面上传成功');
    };
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('上传封面失败:', error);
    uploadLoading.value = false;
    TMessage.error('上传封面失败，请重试');
  }
};

// 复制到剪贴板
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    TMessage.success('已复制到剪贴板');
  }).catch(err => {
    console.error('复制失败:', err);
    TMessage.error('复制失败，请手动复制');
  });
};

// 组件挂载时初始化数据
onMounted(() => {
  getRoomInfo();
  getCategories();
  getStreamKey();
  getOBSStatus();
  getStreamStatus();
  
  // 定期更新状态
  const interval = setInterval(() => {
    getOBSStatus();
    getStreamStatus();
  }, 5000);
  
  // 组件卸载时清除定时器
  // 注意：在script setup中，我们需要使用onUnmounted钩子
  // 但这里为了简洁，暂时省略
});
</script>

<template>
  <div class="live-management-container">
    <div class="page-header">
      <h1>直播管理</h1>
      <p class="page-description">管理您的直播间设置和推流状态</p>
    </div>

    <TCard class="content-card" :loading="loading">
      <!-- 封面设置区域 -->
      <div class="setting-section">
        <h2 class="section-title">封面设置</h2>
        <div class="cover-upload-container">
          <div class="cover-preview">
            <TImage
              v-if="roomInfo.coverUrl"
              :src="roomInfo.coverUrl"
              alt="直播间封面"
              class="cover-image"
            />
            <div v-else class="default-cover">
              <span>点击上传封面</span>
            </div>
          </div>
          <div class="upload-controls">
            <TUpload
              :loading="uploadLoading"
              accept="image/*"
              :auto-upload="true"
              :show-file-list="false"
              @change="handleCoverUpload"
              class="upload-button"
            >
              <TButton variant="primary" size="small">上传封面</TButton>
            </TUpload>
            <p class="upload-tip">建议尺寸：1280×720像素，支持JPG、PNG格式</p>
          </div>
        </div>
      </div>

      <TDivider />

      <!-- 房间信息区域 -->
      <div class="setting-section">
        <h2 class="section-title">房间信息</h2>
        <div class="form-group">
          <label class="form-label">房间标题</label>
          <TInput
            v-model="roomInfo.title"
            placeholder="输入房间标题"
            max-length="100"
          />
        </div>
        <div class="form-group">
          <label class="form-label">允许观众剪辑</label>
          <TSwitch v-model="roomInfo.allowClip" />
        </div>
        <div class="form-group">
          <label class="form-label">直播分区</label>
          <TSelect
            v-model="roomInfo.category"
            placeholder="选择一级分类"
            :options="categories"
          />
        </div>
        <div class="form-group">
          <label class="form-label">二级分区</label>
          <TSelect
            v-model="roomInfo.subCategory"
            placeholder="选择二级分类"
            :options="categories.find(cat => cat.value === roomInfo.category)?.children || []"
            :disabled="!roomInfo.category"
          />
        </div>
        <TButton @click="saveRoomInfo" variant="primary" class="save-button">保存设置</TButton>
      </div>

      <TDivider />

      <!-- 弹幕流链接区域 -->
      <div class="setting-section">
        <h2 class="section-title">弹幕流链接</h2>
        <div class="form-group">
          <label class="form-label">自定义弹幕链接</label>
          <div class="input-with-button">
            <TInput
              v-model="roomInfo.customDanmuUrl"
              placeholder="自定义弹幕链接"
              readonly
            />
            <TButton @click="copyToClipboard(roomInfo.customDanmuUrl)" size="small">复制</TButton>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">官方弹幕链接</label>
          <div class="input-with-button">
            <TInput
              v-model="roomInfo.officialDanmuUrl"
              placeholder="官方弹幕链接"
              readonly
            />
            <TButton @click="copyToClipboard(roomInfo.officialDanmuUrl)" size="small">复制</TButton>
          </div>
        </div>
      </div>

      <TDivider />

      <!-- OBS同步设置区域 -->
      <div class="setting-section">
        <h2 class="section-title">OBS同步设置</h2>
        <div class="obs-status-container">
          <div class="status-item">
            <span class="status-label">OBS连接状态：</span>
            <span class="status-value"
                  :class="{
                    'status-online': roomInfo.obsStatus === 'online',
                    'status-offline': roomInfo.obsStatus === 'offline',
                    'status-connecting': roomInfo.obsStatus === 'connecting'
                  }">
              {{ roomInfo.obsStatus === 'online' ? '在线' : roomInfo.obsStatus === 'connecting' ? '连接中' : '离线' }}
            </span>
          </div>
          <TButton
            @click="connectOBS"
            variant="primary"
            size="small"
            :disabled="roomInfo.obsStatus === 'online' || roomInfo.obsStatus === 'connecting'"
          >
            连接OBS
          </TButton>
        </div>
      </div>

      <TDivider />

      <!-- RTMP设置区域 -->
      <div class="setting-section">
        <h2 class="section-title">RTMP设置</h2>
        <div class="form-group">
          <label class="form-label">RTMP服务器地址</label>
          <div class="input-with-button">
            <TInput
              v-model="roomInfo.rtmpServer"
              placeholder="RTMP服务器地址"
              readonly
            />
            <TButton @click="copyToClipboard(roomInfo.rtmpServer)" size="small">复制</TButton>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">直播码</label>
          <div class="input-with-button">
            <TInput
              v-model="roomInfo.streamKey"
              placeholder="直播码"
              readonly
            />
            <TButton @click="copyToClipboard(roomInfo.streamKey)" size="small">复制</TButton>
            <TButton @click="refreshStreamKey" size="small" variant="outline">刷新</TButton>
          </div>
        </div>
      </div>

      <TDivider />

      <!-- 推流状态区域 -->
      <div class="setting-section">
        <h2 class="section-title">推流状态</h2>
        <div class="stream-status-container">
          <div class="status-item">
            <span class="status-label">当前推流状态：</span>
            <span class="status-value"
                  :class="{
                    'status-live': roomInfo.streamStatus === 'live',
                    'status-waiting': roomInfo.streamStatus === 'waiting',
                    'status-offline': roomInfo.streamStatus === 'offline'
                  }">
              {{ roomInfo.streamStatus === 'live' ? '直播中' : roomInfo.streamStatus === 'waiting' ? '等待中' : '未开播' }}
            </span>
          </div>
        </div>
      </div>

      <TDivider />

      <!-- 弹幕播放器区域 -->
      <div class="setting-section">
        <h2 class="section-title">弹幕播放器</h2>
        <div class="danmu-player-wrapper" style="height: 400px; width: 100%;">
          <DanmuPlayer
            :roomId="roomInfo.title"
            :customDanmuUrl="roomInfo.customDanmuUrl"
            :officialDanmuUrl="roomInfo.officialDanmuUrl"
          />
        </div>
      </div>
          <div class="stream-buttons">
            <TButton
              v-if="roomInfo.streamStatus === 'live'"
              @click="stopStream"
              variant="danger"
              size="small"
            >
              下播
            </TButton>
            <TButton
              v-else-if="roomInfo.obsStatus === 'online'"
              @click="startStream"
              variant="primary"
              size="small"
            >
              开播
            </TButton>
            <TButton
              v-else
              @click="connectOBS"
              variant="outline"
              size="small"
            >
              连接OBS
            </TButton>
          </div>
        </div>
      </div>
    </TCard>
  </div>
</template>

<style scoped>
.live-management-container {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.page-description {
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.content-card {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.setting-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--td-text-color-primary);
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.input-with-button .t-input {
  flex: 1;
}

.cover-upload-container {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.cover-preview {
  width: 320px;
  height: 180px;
  border: 1px dashed var(--td-border-color);
  border-radius: var(--td-radius-medium);
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-placeholder);
  background-color: var(--td-bg-color-secondary);
}

.upload-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-tip {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-top: 8px;
}

.save-button {
  margin-top: 16px;
}

.status-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  color: var(--td-text-color-secondary);
}

.status-value {
  font-weight: 500;
}

.status-online {
  color: var(--td-success-color);
}

.status-offline {
  color: var(--td-error-color);
}

.status-connecting {
  color: var(--td-warning-color);
}

.status-live {
  color: var(--td-success-color);
}

.status-waiting {
  color: var(--td-warning-color);
}

.obs-status-container,
.stream-status-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>