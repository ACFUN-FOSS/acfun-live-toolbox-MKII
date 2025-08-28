<template>
  <div class="live-management-container">
    <t-tabs v-model="activeTab" class="live-tabs">
      <t-tab-panel value="room-config" label="房间配置">
        <t-form ref="roomConfigForm" :data="roomConfig" :rules="roomConfigRules" class="config-form">
          <t-form-item name="title" label="直播标题">
            <t-input v-model="roomConfig.title" placeholder="请输入直播标题" maxlength="50" />
          </t-form-item>
          <t-form-item name="cover" label="封面图片">
            <t-upload
              v-model="roomConfig.cover"
              :auto-upload="true"
              :accept="['image/png', 'image/jpeg']"
              :max-size="5 * 1024 * 1024"
              :on-success="handleCoverUpload"
            >
              <t-button variant="outline">选择图片</t-button>
            </t-upload>
            <div class="cover-preview" v-if="roomConfig.cover">
              <img :src="roomConfig.cover" alt="封面预览" class="preview-image" />
            </div>
          </t-form-item>
          <t-form-item name="category" label="直播分区">
            <t-select v-model="roomConfig.category" :options="categories" placeholder="选择分区" />
          </t-form-item>
          <t-form-item name="allowClip" label="允许观众剪辑">
            <t-switch v-model="roomConfig.allowClip" />
          </t-form-item>
          <t-form-item>
            <t-button type="primary" @click="saveRoomConfig">保存配置</t-button>
          </t-form-item>
        </t-form>
      </t-tab-panel>

      <t-tab-panel value="stream-control" label="推流管理">
        <div class="stream-control-panel">
          <div class="stream-status" v-if="streamStatus">
            <t-badge :value="streamStatus.active ? '直播中' : '未开播'" :variant="streamStatus.active ? 'danger' : 'default'" />
            <p class="status-detail">当前状态: {{ streamStatus.active ? '正在推流' : '已停止' }}</p>
            <p class="status-detail" v-if="streamStatus.active">推流时长: {{ formatDuration(streamStatus.duration) }}</p>
          </div>

          <div class="stream-info" v-if="streamInfo">
            <t-card class="info-card">
              <h3 class="card-title">RTMP推流信息</h3>
              <div class="info-item">
                <span class="info-label">服务器地址:</span>
                <t-input :value="streamInfo.serverUrl" readonly />
                <t-button size="small" @click="copyToClipboard(streamInfo.serverUrl)">复制</t-button>
              </div>
              <div class="info-item">
                <span class="info-label">直播码:</span>
                <t-input :value="streamInfo.streamKey" readonly type="password" />
                <t-button size="small" @click="copyToClipboard(streamInfo.streamKey)">复制</t-button>
              </div>
            </t-card>
          </div>

          <div class="stream-actions">
            <t-button
              type="primary"
              variant="danger"
              @click="handleStartStream"
              :disabled="streamStatus?.active"
              :loading="streamLoading"
            >
              开始推流
            </t-button>
            <t-button
              variant="outline"
              @click="handleStopStream"
              :disabled="!streamStatus?.active"
              :loading="streamLoading"
            >
              停止推流
            </t-button>
          </div>
        </div>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { Tabs, TabPanel, Form, FormItem, Input, Button, Upload, Switch, Select, Card, Badge, Tooltip } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';
import { CopyIcon } from '@tdesign/icons-vue-next';

// 状态管理
const activeTab = ref('room-config');
const roomConfig = reactive({
  title: '',
  cover: '',
  category: '',
  allowClip: false
});
const categories = ref([]);
const streamStatus = ref(null);
const streamInfo = ref(null);
const streamLoading = ref(false);

// 表单验证规则
const roomConfigRules = {
  title: [{ required: true, message: '请输入直播标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择直播分区', trigger: 'change' }]
};

// 生命周期钩子
onMounted(async () => {
  // 加载分类数据
  loadCategories();
  // 获取当前直播状态
  getStreamStatus();
  // 获取推流信息
  getStreamInfo();
});

// 加载分类数据
const loadCategories = async () => {
  try {
    const result = await ipcRenderer.invoke('live:getCategories');
    if (result.success) {
      categories.value = result.data;
    }
  } catch (error) {
    console.error('加载分类失败:', error);
  }
};

// 获取直播状态
const getStreamStatus = async () => {
  try {
    const result = await ipcRenderer.invoke('live:getStreamStatus');
    if (result.success) {
      streamStatus.value = result.data;
    }
  } catch (error) {
    console.error('获取直播状态失败:', error);
  }
};

// 获取推流信息
const getStreamInfo = async () => {
  try {
    const result = await ipcRenderer.invoke('live:getStreamInfo');
    if (result.success) {
      streamInfo.value = result.data;
    }
  } catch (error) {
    console.error('获取推流信息失败:', error);
  }
};

// 保存房间配置
const saveRoomConfig = async () => {
  const form = document.querySelector('t-form') as any;
  const valid = await form.validate();
  if (!valid) return;

  try {
    const result = await ipcRenderer.invoke('live:configureRoom', roomConfig);
    if (result.success) {
      // 显示成功提示
      alert('房间配置保存成功');
    } else {
      alert('保存失败: ' + result.error);
    }
  } catch (error) {
    console.error('保存房间配置失败:', error);
    alert('保存配置时发生错误');
  }
};

// 处理封面上传
const handleCoverUpload = (response) => {
  if (response.success) {
    roomConfig.cover = response.data.url;
  }
};

// 开始推流
const handleStartStream = async () => {
  streamLoading.value = true;
  try {
    const result = await ipcRenderer.invoke('live:startStreaming', {
      useObs: true
    });
    if (result.success) {
      streamInfo.value = result.data;
      alert('推流已开始');
      // 定期更新状态
      setInterval(getStreamStatus, 5000);
    } else {
      alert('启动推流失败: ' + result.error);
    }
  } catch (error) {
    console.error('启动推流失败:', error);
    alert('启动推流时发生错误');
  } finally {
    streamLoading.value = false;
    getStreamStatus();
  }
};

// 停止推流
const handleStopStream = async () => {
  streamLoading.value = true;
  try {
    const result = await ipcRenderer.invoke('live:stopStreaming');
    if (result.success) {
      alert('推流已停止');
    } else {
      alert('停止推流失败: ' + result.error);
    }
  } catch (error) {
    console.error('停止推流失败:', error);
    alert('停止推流时发生错误');
  } finally {
    streamLoading.value = false;
    getStreamStatus();
  }
};

// 格式化时长
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

// 复制到剪贴板
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    alert('已复制到剪贴板');
  });
};
</script>

<style scoped>
.live-management-container {
  padding: 20px;
}

.config-form {
  max-width: 600px;
}

.cover-preview {
  margin-top: 16px;
}

.preview-image {
  width: 200px;
  height: 112px;
  object-fit: cover;
  border-radius: 4px;
}

.stream-control-panel {
  padding: 20px;
}

.stream-status {
  margin-bottom: 24px;
}

.status-detail {
  margin-top: 8px;
  color: #666;
}

.stream-info {
  margin-bottom: 24px;
}

.info-card {
  margin-bottom: 24px;
}

.card-title {
  margin-bottom: 16px;
  font-size: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.info-label {
  width: 100px;
  margin-right: 16px;
}

.info-item .t-input {
  flex: 1;
  margin-right: 8px;
}

.stream-actions {
  display: flex;
  gap: 16px;
}
</style>