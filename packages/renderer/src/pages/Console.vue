<template>
  <div class="console-page">
    <div class="header">
      <h1>控制台</h1>
      <div
        v-if="consoleData"
        class="stats"
      >
        <div class="stat-item">
          <span class="label">WebSocket 连接:</span>
          <span class="value">{{ consoleData.websocketClients }}</span>
        </div>
        <div class="stat-item">
          <span class="label">活跃会话:</span>
          <span class="value">{{ consoleData.activeSessions?.length || 0 }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="consoleData"
      class="content"
    >
      <div class="commands-section">
        <h2>可用命令</h2>
        <div class="commands-grid">
          <div 
            v-for="command in consoleData.commands" 
            :key="command.name"
            class="command-card"
          >
            <div class="command-header">
              <span class="command-name">{{ command.name }}</span>
              <span
                class="command-category"
                :class="getCategoryClass(command.category)"
              >
                {{ command.category }}
              </span>
            </div>
            <div class="command-description">
              {{ command.description }}
            </div>
            <div
              v-if="command.usage"
              class="command-usage"
            >
              <strong>用法:</strong> <code>{{ command.usage }}</code>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="consoleData?.activeSessions?.length > 0"
        class="sessions-section"
      >
        <h2>活跃会话</h2>
        <div class="sessions-list">
          <div 
            v-for="session in consoleData.activeSessions" 
            :key="session.id"
            class="session-card"
          >
            <div class="session-header">
              <span class="session-id">会话 #{{ session.id }}</span>
              <span
                class="session-status"
                :class="getStatusClass(session.status)"
              >
                {{ getStatusText(session.status) }}
              </span>
            </div>
            <div class="session-info">
              <div class="info-item">
                <span class="label">房间:</span>
                <span class="value">{{ session.room || '未指定' }}</span>
              </div>
              <div class="info-item">
                <span class="label">开始时间:</span>
                <span class="value">{{ formatDate(session.startTime) }}</span>
              </div>
              <div
                v-if="session.lastActivity"
                class="info-item"
              >
                <span class="label">最后活动:</span>
                <span class="value">{{ formatDate(session.lastActivity) }}</span>
              </div>
            </div>
            <div
              v-if="session.details"
              class="session-details"
            >
              <strong>详情:</strong> {{ session.details }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="empty-sessions"
      >
        <div class="empty-icon">
          📭
        </div>
        <p>当前没有活跃的会话</p>
      </div>
    </div>

    <div
      v-else
      class="loading"
    >
      <div class="spinner" />
      <p>正在加载控制台数据...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Command {
  name: string
  description: string
  category: string
  usage?: string
}

interface Session {
  id: string
  room?: string
  startTime: string
  lastActivity?: string
  status: string
  details?: string
}

interface ConsoleData {
  commands: Command[]
  activeSessions: Session[]
  websocketClients: number
}

const consoleData = ref<ConsoleData | null>(null)
let refreshInterval: number | null = null

const fetchConsoleData = async () => {
  try {
    const response = await fetch('http://127.0.0.1:18299/api/console/data')
    if (response.ok) {
      consoleData.value = await response.json()
    }
  } catch (error) {
    console.error('Failed to fetch console data:', error)
  }
}

const getCategoryClass = (category: string) => {
  const categoryMap: Record<string, string> = {
    'system': 'category-system',
    'room': 'category-room',
    'event': 'category-event',
    'debug': 'category-debug',
    'plugin': 'category-plugin'
  }
  return categoryMap[category.toLowerCase()] || 'category-default'
}

const getStatusClass = (status: string) => {
  const statusMap: Record<string, string> = {
    'active': 'status-active',
    'idle': 'status-idle',
    'connecting': 'status-connecting',
    'error': 'status-error'
  }
  return statusMap[status.toLowerCase()] || 'status-default'
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    'active': '活跃',
    'idle': '空闲',
    'connecting': '连接中',
    'error': '错误'
  }
  return statusMap[status.toLowerCase()] || status
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchConsoleData()
  // 每30秒刷新一次数据
  refreshInterval = window.setInterval(fetchConsoleData, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.console-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e1e5e9;
}

.header h1 {
  margin: 0;
  color: #2c3e50;
  font-size: 2.5rem;
}

.stats {
  display: flex;
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-item .label {
  font-size: 0.8rem;
  color: #7f8c8d;
  margin-bottom: 5px;
}

.stat-item .value {
  font-size: 1.2rem;
  font-weight: 600;
  color: #2c3e50;
}

.commands-section, .sessions-section {
  margin-bottom: 40px;
}

.commands-section h2, .sessions-section h2 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.commands-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.command-card {
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 20px;
  transition: box-shadow 0.2s ease;
}

.command-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.command-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.command-name {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
}

.command-category {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.category-system { background: #3498db; color: white; }
.category-room { background: #27ae60; color: white; }
.category-event { background: #f39c12; color: white; }
.category-debug { background: #e74c3c; color: white; }
.category-plugin { background: #9b59b6; color: white; }
.category-default { background: #95a5a6; color: white; }

.command-description {
  color: #7f8c8d;
  line-height: 1.5;
  margin-bottom: 10px;
}

.command-usage {
  font-size: 0.9rem;
}

.command-usage code {
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.session-card {
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 20px;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.session-id {
  font-weight: 600;
  color: #2c3e50;
}

.session-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-active { background: #27ae60; color: white; }
.status-idle { background: #f39c12; color: white; }
.status-connecting { background: #3498db; color: white; }
.status-error { background: #e74c3c; color: white; }
.status-default { background: #95a5a6; color: white; }

.session-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.info-item {
  display: flex;
  justify-content: space-between;
}

.info-item .label {
  font-weight: 600;
  color: #7f8c8d;
}

.info-item .value {
  color: #2c3e50;
}

.session-details {
  color: #7f8c8d;
  font-size: 0.9rem;
  line-height: 1.4;
}

.empty-sessions {
  text-align: center;
  padding: 40px;
  color: #7f8c8d;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #7f8c8d;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e1e5e9;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>