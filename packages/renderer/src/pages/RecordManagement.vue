<template>
  <div class="record-management-container">
    <div class="top-area">
      <div class="info-text">
        <p>这里是您的直播记录列表，包含所有历史直播数据</p>
      </div>
      <t-button @click="openDocumentation" theme="default">
        查看说明文档
      </t-button>
    </div>

    <div class="record-list-container">
      <t-list class="record-list">
        <t-list-item v-for="record in records" :key="record.id" class="record-item">
          <template #main>
            <div class="record-info">
              <div class="record-time">{{ formatDateTime(record.timestamp) }}</div>
              <div class="record-actions">
                <t-button @click="copyDownloadLink(record.id)" size="small">
                  复制下载链接
                </t-button>
              </div>
            </div>
          </template>
        </t-list-item>
      </t-list>

      <div v-if="records.length === 0" class="empty-state">
        <t-empty description="暂无直播记录"></t-empty>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { TButton, TList, TEmpty } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface LiveRecord {
  id: string;
  timestamp: number;
  downloadUrl: string;
}

const records = ref<LiveRecord[]>([]);

onMounted(async () => {
  try {
    const recordData = await ipcRenderer.invoke('records:getLiveRecords');
    records.value = recordData;
  } catch (error) {
    console.error('Failed to fetch live records:', error);
  }
});

const formatDateTime = (timestamp: number): string => {
  return format(new Date(timestamp), 'yyyy年MM月dd日 HH:mm:ss', { locale: zhCN });
};

const copyDownloadLink = async (recordId: string) => {
  try {
    const record = records.value.find(r => r.id === recordId);
    if (record) {
      await navigator.clipboard.writeText(record.downloadUrl);
      // Show success message
    } else {
      console.error('Record not found:', recordId);
    }
  } catch (error) {
    console.error('Failed to copy download link:', error);
  }
};

const openDocumentation = () => {
  ipcRenderer.send('open-documentation', 'record-management');
};
</script>

<style scoped>
.record-management-container {
  padding: 20px;
  height: 100%;
  box-sizing: border-box;
}

.top-area {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.info-text {
  color: var(--t-color-text-secondary);
}

.record-list-container {
  background-color: var(--t-color-bg-container);
  border-radius: var(--t-radius-medium);
  padding: 16px;
  height: calc(100% - 80px);
  overflow-y: auto;
}

.record-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--t-color-border);
}

.record-item:last-child {
  border-bottom: none;
}

.record-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.record-time {
  font-size: var(--t-font-size-medium);
  color: var(--t-color-text-primary);
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}
</style>