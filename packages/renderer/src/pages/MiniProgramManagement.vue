<template>
  <div class="mini-program-management">
    <t-card class="page-header-card" title="小程序管理中心">
      <template #extra>
        <t-input placeholder="搜索小程序..." class="search-input" />
        <t-button icon="plus" theme="primary" class="ml-2" @click="showInstallModal = true">添加小程序</t-button>
          <t-button icon="download" theme="default" class="ml-2" @click="checkUpdates">检查更新</t-button>
      </template>
    </t-card>

    <t-tabs class="category-tabs mt-4" defaultValue="all">
      <t-tab-panel value="all" label="全部">全部小程序</t-tab-panel>
      <t-tab-panel value="live" label="直播工具">直播相关小程序</t-tab-panel>
      <t-tab-panel value="utility" label="实用工具">实用工具类小程序</t-tab-panel>
      <t-tab-panel value="custom" label="自定义">自定义开发小程序</t-tab-panel>
      <t-tab-panel value="marketplace" label="小程序市场">探索更多小程序</t-tab-panel>
    </t-tabs>

    <div class="program-grid mt-4">
      <t-skeleton v-if="isLoading" :rows="6" :columns="3" />
      <template v-else-if="activeTab === 'marketplace'">
        <t-card class="program-card" v-for="app in marketplaceApps" :key="app.id">
          <div class="program-icon">
            <img :src="app.icon || '/icons/default.png'" alt="{{ app.name }}" />
          </div>
          <div class="program-info">
            <h3 class="program-name">{{ app.name }}</h3>
            <p class="program-desc">{{ app.description }}</p>
            <div class="program-meta">
              <span class="version">v{{ app.version }}</span>
              <span class="category">{{ app.category }}</span>
            </div>
          </div>
          <div class="program-actions">
            <t-button @click="handleMarketplaceInstall(app)" theme="primary">安装</t-button>
          </div>
        </t-card>
      </template>
      <template v-else>
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
      <!-- 小程序安装模态框 -->
      <t-dialog
        v-model:visible="showInstallModal"
        header="安装小程序"
        :width="500"
      >
        <div class="install-form">
          <t-input
            v-model="newProgramUrl"
            placeholder="输入小程序URL或上传本地包"
            class="mb-4"
          />
          <t-input
            v-model="newProgramName"
            placeholder="小程序名称"
            class="mb-4"
          />
        </div>
        <template #footer>
          <t-button @click="showInstallModal = false">取消</t-button>
          <t-button theme="primary" @click="handleInstall">安装</t-button>
        </template>
      </t-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
const showInstallModal = ref(false);
const newProgramUrl = ref('');
const newProgramName = ref('');

const handleInstall = () => {
  if (!newProgramUrl.value) {
    TMessage.error('请输入小程序URL');
    return;
  }
  const newProgram = {
    id: Date.now().toString(),
    name: newProgramName.value || '新小程序',
    description: '新安装的小程序',
    icon: '/icons/default.png',
    version: '1.0.0',
    status: 'stopped',
    category: 'custom'
  };
  programList.value.push(newProgram);
  showInstallModal.value = false;
  TMessage.success(`已成功安装 ${newProgram.name}`);
};
  import { TDialog, TInput, TButton, TMessage } from 'tdesign-vue-next';
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

const programList = ref<MiniProgram[]>([]);
const marketplaceApps = ref<any[]>([]);
const activeTab = ref('all');
const isLoading = ref(false);

// 初始化加载已安装小程序
onMounted(async () => {
  fetchInstalledPrograms();
});

const fetchInstalledPrograms = async () => {
  isLoading.value = true;
  try {
    // 实际项目中应替换为真实API调用
    const response = await window.api.getInstalledMiniPrograms();
    programList.value = response;
  } catch (error) {
    TMessage.error('获取已安装小程序失败');
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

const fetchMarketplaceApps = async () => {
  isLoading.value = true;
  try {
    marketplaceApps.value = await window.api.getMarketplaceApps();
  } catch (error) {
    TMessage.error('获取小程序市场列表失败');
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

watch(activeTab, (newVal) => {
  if (newVal === 'marketplace') {
    fetchMarketplaceApps();
  }
});

const formatStatus = (status: string) => {
  const statusMap = {
    running: '运行中',
    stopped: '已停止',
    error: '异常',
    updating: '更新中'
  };
  return statusMap[status] || status;
};

const handleMarketplaceInstall = async (app: any) => {
  newProgramName.value = app.name;
  newProgramUrl.value = app.packageUrl;
  showInstallModal.value = true;
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