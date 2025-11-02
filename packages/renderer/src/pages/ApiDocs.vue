<template>
  <div class="api-docs">
    <div class="header">
      <h1>AcFun Live Toolbox API</h1>
      <div class="server-info" v-if="serverInfo">
        <div class="status-badge" :class="{ online: serverInfo.status === 'running' }">
          {{ serverInfo.status === 'running' ? '在线' : '离线' }}
        </div>
        <span class="version">v{{ serverInfo.version }}</span>
      </div>
    </div>

    <div class="content" v-if="serverInfo">
      <div class="server-status">
        <h2>服务器状态</h2>
        <div class="status-grid">
          <div class="status-item">
            <span class="label">服务器名称:</span>
            <span class="value">{{ serverInfo.name }}</span>
          </div>
          <div class="status-item">
            <span class="label">状态:</span>
            <span class="value">{{ serverInfo.status }}</span>
          </div>
          <div class="status-item">
            <span class="label">版本:</span>
            <span class="value">{{ serverInfo.version }}</span>
          </div>
          <div class="stat-item">
            <span class="label">WebSocket 连接:</span>
            <span class="value">{{ serverInfo.websocket_clients }} 个</span>
          </div>
        </div>
      </div>

      <div class="api-endpoints">
        <h2>API 端点</h2>
        
        <div class="endpoint-group" v-for="(endpoints, groupName) in serverInfo.endpoints" :key="groupName">
          <h3>{{ groupName.toUpperCase() }} API</h3>
          <div class="endpoints-list">
            <div 
              v-for="endpoint in endpoints" 
              :key="endpoint.path"
              class="endpoint-item"
            >
              <div class="endpoint-header">
                <span class="method" :class="endpoint.method?.toLowerCase() || 'get'">
                  {{ endpoint.method || 'GET' }}
                </span>
                <span class="path">{{ endpoint.path }}</span>
              </div>
              <div class="endpoint-description">
                {{ endpoint.description }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="loading" v-else>
      <div class="spinner"></div>
      <p>正在加载服务器信息...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface ServerInfo {
  name: string
  status: string
  version: string
  websocket_clients: number
  websocket_endpoint: string
  endpoints: {
    api: Array<{
      method: string
      path: string
      description: string
    }>
    console: Array<{
      method: string
      path: string
      description: string
    }>
    overlay: Array<{
      method: string
      path: string
      description: string
    }>
  }
}

const serverInfo = ref<ServerInfo | null>(null)

const fetchServerInfo = async () => {
  try {
    const response = await fetch('http://127.0.0.1:18299/')
    if (response.ok) {
      serverInfo.value = await response.json()
    }
  } catch (error) {
    console.error('Failed to fetch server info:', error)
  }
}

onMounted(() => {
  fetchServerInfo()
})
</script>

<style scoped>
.api-docs {
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

.server-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
  background: #e74c3c;
  color: white;
}

.status-badge.online {
  background: #27ae60;
}

.version {
  padding: 4px 8px;
  background: #3498db;
  color: white;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.server-status {
  background: #f8f9fa;
  padding: 25px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.server-status h2 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
}

.status-item .label {
  font-weight: 600;
  color: #7f8c8d;
}

.status-item .value {
  color: #2c3e50;
  font-weight: 500;
}

.api-endpoints h2 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.endpoint-group {
  margin-bottom: 30px;
}

.endpoint-group h3 {
  margin: 0 0 15px 0;
  color: #34495e;
  font-size: 1.2rem;
  padding-bottom: 8px;
  border-bottom: 2px solid #3498db;
}

.endpoints-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.endpoint-item {
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 20px;
  transition: box-shadow 0.2s ease;
}

.endpoint-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px;
}

.method {
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  min-width: 60px;
  text-align: center;
}

.method.get {
  background: #27ae60;
  color: white;
}

.method.post {
  background: #3498db;
  color: white;
}

.method.put {
  background: #f39c12;
  color: white;
}

.method.delete {
  background: #e74c3c;
  color: white;
}

.path {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #2c3e50;
}

.endpoint-description {
  color: #7f8c8d;
  line-height: 1.5;
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