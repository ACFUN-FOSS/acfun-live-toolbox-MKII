<template>
  <div class="mini-program-management">
    <t-card class="page-header-card" title="小程序管理中心">
      <template #extra>
        <t-input placeholder="搜索小程序..." class="search-input" />
        <t-button icon="plus" theme="primary" class="ml-2">添加小程序</t-button>
      </template>
    </t-card>

    <t-tabs class="category-tabs mt-4" defaultValue="all">
      <t-tab-panel value="all" label="全部">全部小程序</t-tab-panel>
      <t-tab-panel value="live" label="直播工具">直播相关小程序</t-tab-panel>
      <t-tab-panel value="utility" label="实用工具">实用工具类小程序</t-tab-panel>
      <t-tab-panel value="custom" label="自定义">自定义开发小程序</t-tab-panel>
    </t-tabs>

    <div class="program-grid mt-4">
      <t-card class="program-card" v-for="program in programList" :key="program.id">
        <div class="program-icon">
          <img :src="program.icon" alt="{{ program.name }}" />
        </div>
        <div class="program-info">
          <h3 class="program-name">{{ program.name }}</h3>
          <p class="program-desc">{{ program.description }}</p>
          <div class="program-meta">
            <span class="version">v{{ program.version }}</span>
            <span class="status-badge" :class="program.status">{{ formatStatus(program.status) }}</span>
          </div>
        </div>
        <div class="program-actions">
          <t-button @click="handleAction(program, 'start')" :disabled="program.status === 'running'">
            {{ program.status === 'running' ? '运行中' : '启动' }}
          </t-button>
          <t-button @click="handleAction(program, 'stop')" :disabled="program.status !== 'running'" theme="default">
            停止
          </t-button>
          <t-dropdown>
            <t-button icon="more" theme="default" />
            <template #content>
              <t-dropdown-item @click="handleAction(program, 'update')">更新</t-dropdown-item>
              <t-dropdown-item @click="handleAction(program, 'settings')">设置</t-dropdown-item>
              <t-dropdown-item @click="handleAction(program, 'remove')" theme="danger">移除</t-dropdown-item>
            </template>
          </t-dropdown>
        </div>
      </t-card>
    </div>

    <div class="bottom-status-bar">
      <span>共 {{ programList.length }} 个小程序</span>
      <t-pagination :total="programList.length" :page-size="8" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { TCard, TInput, TButton, TTabs, TTabPanel, TDropdown, TDropdownItem, TPagination } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';
import { TMessage } from 'tdesign-vue-next';

interface MiniProgram {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  status: 'running' | 'stopped' | 'error' | 'updating';
  category: string;
  resourceUsage?: {
    cpu: number;
    memory: number;
  };
}

const programList = ref<MiniProgram[]>([
  {
    id: '1',
    name: '弹幕助手',
    description: '增强弹幕互动体验的工具',
    icon: '/icons/danmu-assistant.png',
    version: '1.2.0',
    status: 'running',
    category: 'live'
  },
  {
    id: '2',
    name: '自动回复',
    description: '设置关键词自动回复',
    icon: '/icons/auto-reply.png',
    version: '1.0.3',
    status: 'stopped',
    category: 'utility'
  },
  {
    id: '3',
    name: '数据统计',
    description: '详细的直播数据分析工具',
    icon: '/icons/statistics.png',
    version: '2.1.0',
    status: 'stopped',
    category: 'utility'
  }
]);

const formatStatus = (status: string) => {
  const statusMap = {
    running: '运行中',
    stopped: '已停止',
    error: '异常',
    updating: '更新中'
  };
  return statusMap[status] || status;
};

const handleAction = async (program: MiniProgram, action: string) => {
  try {
    switch (action) {
      case 'start':
        // Implement start logic
        program.status = 'running';
        TMessage.success(`已启动 ${program.name}`);
        break;
      case 'stop':
        // Implement stop logic
        program.status = 'stopped';
        TMessage.success(`已停止 ${program.name}`);
        break;
      case 'update':
        // Implement update logic
        TMessage.info(`正在更新 ${program.name}...`);
        break;
      case 'settings':
        // Open settings dialog
        TMessage.info(`打开 ${program.name} 设置`);
        break;
      case 'remove':
        // Implement remove logic
        programList.value = programList.value.filter(p => p.id !== program.id);
        TMessage.success(`已移除 ${program.name}`);
        break;
    }
  } catch (err) {
    console.error(`Failed to ${action} program:`, err);
    TMessage.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
  }
};
</script>

<style scoped>
.mini-program-management {
  padding: 20px;
}

.search-input {
  width: 300px;
  margin-right: 10px;
}

.category-tabs {
  margin-bottom: 20px;
}

.program-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.program-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.program-icon {
  text-align: center;
  padding: 16px 0;
}

.program-icon img {
  width: 64px;
  height: 64px;
  border-radius: 4px;
}

.program-info {
  flex: 1;
  padding: 0 16px 16px;
}

.program-name {
  margin: 0 0 8px;
  font-size: 16px;
}

.program-desc {
  margin: 0 0 12px;
  color: #666;
  font-size: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.program-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version {
  font-size: 12px;
  color: #999;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.status-badge.running {
  background-color: #e8f5e9;
  color: #4caf50;
}

.status-badge.stopped {
  background-color: #f5f5f5;
  color: #757575;
}

.status-badge.error {
  background-color: #ffebee;
  color: #f44336;
}

.program-actions {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #f0f0f0;
}

.program-actions t-button {
  flex: 1;
}

.bottom-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>