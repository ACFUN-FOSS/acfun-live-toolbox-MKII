<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Button, Input, Switch, Message, Tooltip } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';

// 设置状态
const settings = ref<{
  syncStreamTool: boolean,
  streamToolPath: string,
  serverPort: number,
  signalingPort: number,
  cacheSize: string
}>({
  syncStreamTool: false,
  streamToolPath: '',
  serverPort: 1299,
  signalingPort: 4396,
  cacheSize: '0 MB'
});

// 页面加载时获取设置
onMounted(async () => {
  try {
    const data = await ipcRenderer.invoke('settings:getSettings');
    settings.value = data;
  } catch (error) {
    Message.error(`获取设置失败: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// 保存设置
const saveSettings = async () => {
  try {
    await ipcRenderer.invoke('settings:updateSettings', settings.value);
    Message.success('设置保存成功');
  } catch (error) {
    Message.error(`保存设置失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 打开文件夹
const openFolder = async (folderType: string) => {
  try {
    await ipcRenderer.invoke('settings:openSettingsFolder', folderType);
    Message.success(`成功打开${folderType}文件夹`);
  } catch (error) {
    Message.error(`打开${folderType}文件夹失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 选择推流工具路径
const selectStreamToolPath = async () => {
  try {
    const path = await ipcRenderer.invoke('settings:selectStreamToolPath');
    if (path) {
      settings.value.streamToolPath = path;
    }
  } catch (error) {
    Message.error(`选择推流工具路径失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 备份配置
const backupConfig = async () => {
  try {
    await ipcRenderer.invoke('settings:backupConfig');
    Message.success('配置备份成功');
  } catch (error) {
    Message.error(`配置备份失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 还原配置
const restoreConfig = async () => {
  try {
    const data = await ipcRenderer.invoke('settings:restoreConfig');
    if (data) {
      settings.value = data;
      Message.success('配置还原成功');
    }
  } catch (error) {
    Message.error(`配置还原失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 清理账号缓存
const clearAccountCache = async () => {
  try {
    await ipcRenderer.invoke('settings:clearCache', 'account');
    Message.success('账号缓存清理成功');
  } catch (error) {
    Message.error(`账号缓存清理失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 清理配置缓存
const clearConfigCache = async () => {
  try {
    await ipcRenderer.invoke('settings:clearCache', 'config');
    settings.value.cacheSize = '0 MB';
    Message.success('配置缓存清理成功');
  } catch (error) {
    Message.error(`配置缓存清理失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

</script>

<template>
  <div class="settings-container">
    <h1 class="page-title">通用设置</h1>

    <!-- 使用说明区域 -->
    <div class="setting-section row-frame">
      <h2 class="section-title">使用说明</h2>
      <p class="section-desc">查看详细的使用文档和帮助指南</p>
      <Button @click="openFolder('文档')" class="action-btn">
        打开文档
      </Button>
    </div>

    <!-- 系统区域 -->
    <div class="setting-section">
      <h2 class="section-title">系统</h2>
      <p class="section-desc">系统相关设置和操作</p>
      <Button @click="openFolder('控制台')" class="action-btn">
        打开控制台
      </Button>
    </div>

    <!-- 推流工具路径区域 -->
    <div class="setting-section">
      <h2 class="section-title">推流工具设置</h2>
      <div class="setting-item">
        <div class="setting-label">
          <span>同步启动推流工具</span>
          <Tooltip content="启动直播时自动打开推流工具">
            <i class="question-icon">?</i>
          </Tooltip>
        </div>
        <Switch v-model="settings.syncStreamTool" />
      </div>
      <div class="setting-item">
        <div class="setting-label">推流工具路径</div>
        <div class="path-input-container">
          <Input
            v-model="settings.streamToolPath"
            placeholder="请选择推流工具可执行文件"
            readonly
            class="path-input"
          />
          <Button @click="selectStreamToolPath" class="browse-btn">
            浏览
          </Button>
        </div>
      </div>
    </div>

    <!-- 设置端口区域 -->
    <div class="setting-section">
      <h2 class="section-title">端口设置</h2>
      <div class="setting-item">
        <div class="setting-label">服务器端口</div>
        <Input
          v-model="settings.serverPort"
          type="number"
          min="1024"
          max="65535"
          class="port-input"
        />
      </div>
      <div class="setting-item">
        <div class="setting-label">信令端口</div>
        <Input
          v-model="settings.signalingPort"
          type="number"
          min="1024"
          max="65535"
          class="port-input"
        />
      </div>
    </div>

    <!-- 配置文件区域 -->
    <div class="setting-section">
      <h2 class="section-title">配置管理</h2>
      <div class="button-group">
        <Button @click="openFolder('配置')" class="action-btn">
          打开配置文件夹
        </Button>
        <Button @click="backupConfig" class="action-btn">
          配置备份
        </Button>
        <Button @click="restoreConfig" class="action-btn">
          配置还原
        </Button>
      </div>
    </div>

    <!-- 配置缓存区域 -->
    <div class="setting-section">
      <h2 class="section-title">缓存管理</h2>
      <div class="setting-item">
        <div class="setting-label">配置缓存大小</div>
        <div class="cache-info">
          {{ settings.cacheSize }}
          <Button @click="clearConfigCache" class="action-btn">清理缓存</Button>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-label">账号缓存</div>
        <Button @click="clearAccountCache" class="action-btn">
          清理账号缓存
        </Button>
      </div>
    </div>

    <!-- 保存按钮 -->
    <div class="save-button-container">
      <Button type="primary" size="large" @click="saveSettings">
        保存设置
      </Button>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  padding: 20px;
  background-color: #0f172a; /* 页面背景色 - UI规范 */
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 30px;
  color: #f8fafc; /* 主要文本色 - UI规范 */
}

.setting-section {
  margin-bottom: 30px;
  padding: 20px;
  background-color: #1e293b; /* 卡片背景色 - UI规范 */
  border-radius: 4px; /* 统一圆角 - UI规范 */
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #f8fafc; /* 主要文本色 - UI规范 */
}

.section-desc {
  color: #cbd5e1; /* 次要文本色 - UI规范 */
  margin-bottom: 20px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #334155; /* 边框颜色 - 深色主题适配 */
}

.setting-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.setting-label {
  display: flex;
  align-items: center;
  color: #cbd5e1; /* 次要文本色 - UI规范 */
}

.question-icon {
  margin-left: 8px;
  width: 16px;
  height: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #0f172a; /* 背景色 - UI规范 */
  border-radius: 50%;
  font-size: 12px;
  color: #cbd5e1; /* 次要文本色 - UI规范 */
  cursor: help;
}

.path-input-container {
  display: flex;
  width: 100%;
  max-width: 400px;
}

.path-input {
  flex: 1;
  margin-right: 10px;
}

.port-input {
  width: 100px;
}

.button-group {
  display: flex;
  gap: 10px;
}

.action-btn {
  margin-right: 10px;
}

.cache-info {
  display: flex;
  align-items: center;
}

.disabled-btn {
  margin-left: 10px;
  cursor: not-allowed;
}

.save-button-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 40px;
  padding: 20px;
  background-color: #1e293b;
  border-radius: 4px;
}

/* 主按钮样式 - UI规范 */
:deep(.t-button--primary) {
  background-color: #1890ff !important;
  border-color: #1890ff !important;
}
</style>