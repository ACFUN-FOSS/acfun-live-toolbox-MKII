<template>
  <div class="error-page">
    <div class="error-container">
      <div class="error-icon">
        <t-icon
          name="error-circle"
          size="64px"
        />
      </div>
      
      <div class="error-content">
        <h1 class="error-title">
          {{ errorTitle }}
        </h1>
        <p class="error-message">
          {{ errorMessage }}
        </p>
        
        <div
          v-if="errorDetails"
          class="error-details"
        >
          <t-collapse>
            <t-collapse-panel
              header="错误详情"
              value="details"
            >
              <pre class="error-stack">{{ errorDetails }}</pre>
            </t-collapse-panel>
          </t-collapse>
        </div>
        
        <div class="error-actions">
          <t-button
            theme="primary"
            @click="goHome"
          >
            <template #icon>
              <t-icon name="home" />
            </template>
            返回首页
          </t-button>
          <t-button
            variant="outline"
            @click="goBack"
          >
            <template #icon>
              <t-icon name="arrow-left" />
            </template>
            返回上页
          </t-button>
          <t-button
            variant="outline"
            @click="reload"
          >
            <template #icon>
              <t-icon name="refresh" />
            </template>
            重新加载
          </t-button>
          <t-button
            variant="outline"
            @click="reportError"
          >
            <template #icon>
              <t-icon name="bug-report" />
            </template>
            报告错误
          </t-button>
        </div>
      </div>
    </div>
    
    <div class="error-suggestions">
      <h3>可能的解决方案：</h3>
      <ul>
        <li>检查网络连接是否正常</li>
        <li>重启应用程序</li>
        <li>清除应用缓存</li>
        <li>联系技术支持</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';

const router = useRouter();
const route = useRoute();

const errorTitle = ref('应用程序错误');
const errorMessage = ref('抱歉，应用程序遇到了一个错误。');
const errorDetails = ref('');

// 从路由参数或查询参数获取错误信息
onMounted(() => {
  const { title, message, details } = route.query;
  
  if (title) {
    errorTitle.value = title as string;
  }
  
  if (message) {
    errorMessage.value = message as string;
  }
  
  if (details) {
    errorDetails.value = details as string;
  }
});

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

function reload() {
  window.location.reload();
}

function reportError() {
  // 构建错误报告
  const errorReport = {
    title: errorTitle.value,
    message: errorMessage.value,
    details: errorDetails.value,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };
  
  // 复制到剪贴板
  navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2)).then(() => {
    MessagePlugin.success('错误信息已复制到剪贴板');
  }).catch(() => {
    MessagePlugin.error('复制失败，请手动复制错误信息');
  });
}
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--td-bg-color-page);
}

.error-container {
  max-width: 600px;
  width: 100%;
  text-align: center;
  background: var(--td-bg-color-container);
  border-radius: 12px;
  padding: 48px 32px;
  box-shadow: var(--td-shadow-3);
  margin-bottom: 32px;
}

.error-icon {
  margin-bottom: 24px;
  color: var(--td-error-color);
}

.error-content {
  margin-bottom: 32px;
}

.error-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin: 0 0 16px 0;
}

.error-message {
  font-size: 16px;
  color: var(--td-text-color-secondary);
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.error-details {
  margin: 24px 0;
  text-align: left;
}

.error-stack {
  background: var(--td-bg-color-component);
  padding: 16px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.error-suggestions {
  max-width: 600px;
  width: 100%;
  background: var(--td-bg-color-container);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--td-shadow-3);
}

.error-suggestions h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.error-suggestions ul {
  margin: 0;
  padding-left: 20px;
  color: var(--td-text-color-secondary);
}

.error-suggestions li {
  margin-bottom: 8px;
  line-height: 1.5;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .error-page {
    padding: 16px;
  }
  
  .error-container {
    padding: 32px 24px;
  }
  
  .error-title {
    font-size: 24px;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .error-actions .t-button {
    width: 100%;
    max-width: 200px;
  }
}
</style>