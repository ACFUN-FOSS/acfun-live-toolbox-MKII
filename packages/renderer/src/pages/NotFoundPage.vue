<template>
  <div class="not-found-page">
    <div class="not-found-container">
      <div class="not-found-icon">
        <t-icon name="file-search" size="80px" />
      </div>
      
      <div class="not-found-content">
        <h1 class="not-found-title">404</h1>
        <h2 class="not-found-subtitle">页面未找到</h2>
        <p class="not-found-message">
          抱歉，您访问的页面不存在或已被移动。
        </p>
        
        <div class="search-section">
          <t-input
            v-model="searchQuery"
            placeholder="搜索页面或功能..."
            clearable
            @enter="handleSearch"
          >
            <template #suffix-icon>
              <t-icon name="search" @click="handleSearch" />
            </template>
          </t-input>
        </div>
        
        <div class="not-found-actions">
          <t-button theme="primary" @click="goHome">
            <template #icon><t-icon name="home" /></template>
            返回首页
          </t-button>
          <t-button variant="outline" @click="goBack">
            <template #icon><t-icon name="arrow-left" /></template>
            返回上页
          </t-button>
        </div>
      </div>
    </div>
    
    <div class="quick-links">
      <h3>快速导航</h3>
      <div class="links-grid">
        <div class="link-item" @click="navigateTo('/home')">
          <t-icon name="home" size="24px" />
          <span>首页</span>
        </div>
        <div class="link-item" @click="navigateTo('/live/room')">
          <t-icon name="video" size="24px" />
          <span>直播间</span>
        </div>
        <div class="link-item" @click="navigateTo('/plugins/management')">
          <t-icon name="app" size="24px" />
          <span>插件管理</span>
        </div>
        <div class="link-item" @click="navigateTo('/system/settings')">
          <t-icon name="setting" size="24px" />
          <span>系统设置</span>
        </div>
        <div class="link-item" @click="navigateTo('/system/console')">
          <t-icon name="console" size="24px" />
          <span>系统控制台</span>
        </div>
        <div class="link-item" @click="navigateTo('/settings')">
          <t-icon name="tools" size="24px" />
          <span>应用设置</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';

const router = useRouter();
const searchQuery = ref('');

function goHome() {
  router.push('/home');
}

function goBack() {
  if (window.history.length > 1) {
    router.go(-1);
  } else {
    goHome();
  }
}

function navigateTo(path: string) {
  router.push(path);
}

function handleSearch() {
  if (!searchQuery.value.trim()) {
    MessagePlugin.warning('请输入搜索内容');
    return;
  }
  
  // 简单的页面搜索逻辑
  const query = searchQuery.value.toLowerCase();
  const routes = [
    { path: '/home', keywords: ['首页', '主页', 'home'] },
    { path: '/live/room', keywords: ['直播', '房间', 'live', 'room'] },
    { path: '/plugins/management', keywords: ['插件', '管理', 'plugin', 'management'] },
    { path: '/system/settings', keywords: ['系统', '设置', 'system', 'settings'] },
    { path: '/system/console', keywords: ['控制台', '日志', 'console', 'log'] },
    { path: '/settings', keywords: ['配置', '设置', 'config', 'settings'] }
  ];
  
  const matchedRoute = routes.find(route => 
    route.keywords.some(keyword => keyword.includes(query) || query.includes(keyword))
  );
  
  if (matchedRoute) {
    router.push(matchedRoute.path);
    MessagePlugin.success('已为您跳转到相关页面');
  } else {
    MessagePlugin.info('未找到相关页面，请尝试其他关键词');
  }
}
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--td-bg-color-page);
}

.not-found-container {
  max-width: 600px;
  width: 100%;
  text-align: center;
  background: var(--td-bg-color-container);
  border-radius: 12px;
  padding: 48px 32px;
  box-shadow: var(--td-shadow-3);
  margin-bottom: 32px;
}

.not-found-icon {
  margin-bottom: 24px;
  color: var(--td-text-color-placeholder);
}

.not-found-title {
  font-size: 72px;
  font-weight: 700;
  color: var(--td-brand-color);
  margin: 0 0 16px 0;
  line-height: 1;
}

.not-found-subtitle {
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin: 0 0 16px 0;
}

.not-found-message {
  font-size: 16px;
  color: var(--td-text-color-secondary);
  margin: 0 0 32px 0;
  line-height: 1.6;
}

.search-section {
  margin-bottom: 32px;
}

.search-section .t-input {
  max-width: 400px;
}

.not-found-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.quick-links {
  max-width: 600px;
  width: 100%;
  background: var(--td-bg-color-container);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--td-shadow-3);
}

.quick-links h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  text-align: center;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.link-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--td-bg-color-component);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.link-item:hover {
  background: var(--td-bg-color-component-hover);
  border-color: var(--td-brand-color);
  transform: translateY(-2px);
}

.link-item .t-icon {
  color: var(--td-brand-color);
}

.link-item span {
  font-size: 14px;
  color: var(--td-text-color-primary);
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .not-found-page {
    padding: 16px;
  }
  
  .not-found-container {
    padding: 32px 24px;
  }
  
  .not-found-title {
    font-size: 56px;
  }
  
  .not-found-subtitle {
    font-size: 20px;
  }
  
  .not-found-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .not-found-actions .t-button {
    width: 100%;
    max-width: 200px;
  }
  
  .links-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .links-grid {
    grid-template-columns: 1fr;
  }
}
</style>