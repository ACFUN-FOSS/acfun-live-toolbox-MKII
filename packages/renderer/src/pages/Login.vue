<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1 class="login-title">ACLiveFrame</h1>
      <p class="login-subtitle">适用于ACFUN的开放式直播框架工具</p>
      </div>

      <!-- 登录状态卡片 -->
      <div class="status-card" :class="statusCardClass">
        <div class="status-icon">
          <svg v-if="loginState === 'idle'" class="icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <svg v-else-if="loginState === 'qr_ready'" class="icon spin" viewBox="0 0 24 24">
            <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
          </svg>
          <svg v-else-if="loginState === 'success'" class="icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <svg v-else-if="loginState === 'error'" class="icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        </div>
        <div class="status-content">
          <h3 class="status-title">{{ statusTitle }}</h3>
          <p class="status-message">{{ statusMessage }}</p>
        </div>
      </div>

      <!-- 二维码区域 -->
      <div v-if="loginState === 'qr_ready'" class="qr-section">
        <div class="qr-container">
          <div class="qr-code-wrapper">
            <img :src="qrDataUrl" alt="QR Code" class="qr-code" />
            <div class="qr-overlay" v-if="isQrExpiring">
              <div class="qr-overlay-content">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                </svg>
                <p>二维码即将过期</p>
              </div>
            </div>
          </div>
          <div class="qr-info">
            <div class="qr-timer">
              <svg class="icon" viewBox="0 0 24 24">
                <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
              </svg>
              <span>剩余时间: {{ formatTime(remainingTime) }}</span>
            </div>
            <div class="qr-steps">
              <div class="step" :class="{ active: currentStep >= 1 }">
                <div class="step-number">1</div>
                <span>打开 AcFun App</span>
              </div>
              <div class="step" :class="{ active: currentStep >= 2 }">
                <div class="step-number">2</div>
                <span>扫描二维码</span>
              </div>
              <div class="step" :class="{ active: currentStep >= 3 }">
                <div class="step-number">3</div>
                <span>确认登录</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 用户信息 -->
      <div v-if="loginState === 'success'" class="user-info">
        <div class="user-avatar">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
          </svg>
        </div>
        <div class="user-details">
          <h3>{{ loginUserId }}</h3>
          <p>登录成功</p>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="login-actions">
        <t-button 
          v-if="loginState === 'idle' || loginState === 'error'" 
          theme="primary"
          size="large"
          @click="startQrLogin"
          :loading="isLoading"
        >
          <template #icon>
            <t-icon name="qrcode" />
          </template>
          开始扫码登录
        </t-button>
        
        <t-button 
          v-if="loginState === 'qr_ready'" 
          variant="outline"
          size="large"
          @click="refreshQrCode"
          :loading="isLoading"
        >
          <template #icon>
            <t-icon name="refresh" />
          </template>
          刷新二维码
        </t-button>
        
        <t-button 
          v-if="loginState === 'success'" 
          theme="danger"
          size="large"
          @click="logout"
          :loading="isLoading"
        >
          <template #icon>
            <t-icon name="logout" />
          </template>
          退出登录
        </t-button>
      </div>

      <!-- 错误信息 -->
      <div v-if="loginState === 'error'" class="error-details">
        <t-alert theme="error" :message="errorMessage">
          <template #operation>
            <t-button variant="text" theme="primary" @click="startQrLogin">重试</t-button>
          </template>
        </t-alert>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted } from 'vue';
import { Button as TButton, Icon as TIcon, Alert as TAlert } from 'tdesign-vue-next';

// 响应式状态
const loginState = ref<'idle' | 'qr_ready' | 'success' | 'error'>('idle');
const qrDataUrl = ref<string>('');
const expiresIn = ref<number>(0);
const pollStatus = ref<string>('');
const loginUserId = ref<string>('');
const isLoading = ref<boolean>(false);
const errorMessage = ref<string>('');
const refreshAttempts = ref<number>(0);
const currentStep = ref<number>(0);
const remainingTime = ref<number>(0);

// 定时器
let pollTimer: any = null;
let countdownTimer: any = null;

// 计算属性
const statusCardClass = computed(() => ({
  'status-idle': loginState.value === 'idle',
  'status-loading': loginState.value === 'qr_ready',
  'status-success': loginState.value === 'success',
  'status-error': loginState.value === 'error'
}));

const statusTitle = computed(() => {
  switch (loginState.value) {
    case 'idle': return '准备登录';
    case 'qr_ready': return '等待扫码';
    case 'success': return '登录成功';
    case 'error': return '登录失败';
    default: return '';
  }
});

const statusMessage = computed(() => {
  switch (loginState.value) {
    case 'idle': return '点击下方按钮开始登录';
    case 'qr_ready': return pollStatus.value || '请使用 AcFun App 扫描二维码';
    case 'success': return `欢迎回来，${loginUserId.value}`;
    case 'error': return errorMessage.value || '登录过程中出现错误';
    default: return '';
  }
});

const isQrExpiring = computed(() => {
  return remainingTime.value > 0 && remainingTime.value <= 30;
});

// 工具函数
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const clearTimers = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
};

const startCountdown = () => {
  remainingTime.value = expiresIn.value;
  countdownTimer = setInterval(() => {
    remainingTime.value--;
    if (remainingTime.value <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
};

const updateStep = (step: number) => {
  currentStep.value = step;
};

// 主要功能函数
async function startQrLogin() {
  try {
    isLoading.value = true;
    errorMessage.value = '';
    refreshAttempts.value = 0;
    
    const res = await window.electronApi.login.qrStart();
    
    if ((res as any)?.error) {
      loginState.value = 'error';
      errorMessage.value = (res as any).error;
      return;
    }
    
    const data = res as { qrCodeDataUrl: string; expiresIn: number };
    qrDataUrl.value = data.qrCodeDataUrl;
    expiresIn.value = data.expiresIn;
    loginState.value = 'qr_ready';
    pollStatus.value = '等待扫码…';
    
    updateStep(1);
    startCountdown();
    startPolling();
    
  } catch (e: any) {
    loginState.value = 'error';
    errorMessage.value = e?.message || String(e);
  } finally {
    isLoading.value = false;
  }
}

async function refreshQrCode() {
  clearTimers();
  await startQrLogin();
}

function startPolling() {
  clearTimers();
  
  pollTimer = setInterval(async () => {
    try {
      const st = await window.electronApi.login.qrCheck();
      
      if (st.success) {
        loginUserId.value = st.userId || '';
        loginState.value = 'success';
        pollStatus.value = '';
        updateStep(3);
        clearTimers();
      } else if (st.error) {
        if (/过期/i.test(st.error)) {
          clearTimers();
          if (refreshAttempts.value < 3) {
            refreshAttempts.value++;
            pollStatus.value = '二维码已过期，正在刷新…';
            await refreshQrCode();
          } else {
            loginState.value = 'error';
            errorMessage.value = st.error;
          }
        } else if (/取消/i.test(st.error)) {
          clearTimers();
          loginState.value = 'error';
          errorMessage.value = st.error;
        } else if (/扫描/i.test(st.error)) {
          updateStep(2);
          pollStatus.value = st.error;
        } else {
          pollStatus.value = st.error;
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 2000);
}

async function logout() {
  try {
    isLoading.value = true;
    await window.electronApi.login.logout();
    
    loginState.value = 'idle';
    loginUserId.value = '';
    qrDataUrl.value = '';
    expiresIn.value = 0;
    pollStatus.value = '';
    errorMessage.value = '';
    refreshAttempts.value = 0;
    currentStep.value = 0;
    remainingTime.value = 0;
    
    clearTimers();
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    isLoading.value = false;
  }
}

// 生命周期钩子
onMounted(() => {
  // 检查当前登录状态
  // 这里可以添加检查当前登录状态的逻辑
});

onUnmounted(() => {
  clearTimers();
});
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: var(--td-bg-color-page);
}

.login-container {
  width: 100%;
  max-width: 480px;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-large);
  box-shadow: var(--td-shadow-3);
  overflow: hidden;
}

.login-header {
  padding: 32px 32px 24px;
  text-align: center;
  background: var(--td-bg-color-container);
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.app-logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  background: var(--td-brand-color);
  border-radius: var(--td-radius-circle);
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-logo .icon {
  width: 32px;
  height: 32px;
  fill: var(--td-text-color-anti);
}

.app-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.app-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.login-content {
  padding: 24px 32px 32px;
}

/* 状态卡片 */
.status-card {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: var(--td-radius-default);
  margin-bottom: 24px;
  transition: all 0.3s ease;
}

.status-card.status-idle {
  background: var(--td-bg-color-component);
  border: 1px solid var(--td-border-level-1-color);
}

.status-card.status-loading {
  background: var(--td-brand-color-1);
  border: 1px solid var(--td-brand-color-3);
}

.status-card.status-success {
  background: var(--td-success-color-1);
  border: 1px solid var(--td-success-color-3);
}

.status-card.status-error {
  background: var(--td-error-color-1);
  border: 1px solid var(--td-error-color-3);
}

.status-icon {
  margin-right: 16px;
}

.status-icon .icon {
  width: 32px;
  height: 32px;
}

.status-card.status-idle .icon {
  fill: var(--td-text-color-placeholder);
}

.status-card.status-loading .icon {
  fill: var(--td-brand-color);
}

.status-card.status-success .icon {
  fill: var(--td-success-color);
}

.status-card.status-error .icon {
  fill: var(--td-error-color);
}

.status-content {
  text-align: left;
  flex: 1;
}

.status-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--td-text-color-primary);
}

.status-message {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin: 0;
}

/* 二维码区域 */
.qr-section {
  margin-bottom: 24px;
}

.qr-container {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.qr-code-wrapper {
  position: relative;
  flex-shrink: 0;
}

.qr-code {
  width: 200px;
  height: 200px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  background: var(--td-bg-color-container);
}

.qr-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  border-radius: var(--td-radius-default);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-anti);
}

.qr-overlay-content {
  text-align: center;
}

.qr-overlay-content .icon {
  width: 32px;
  height: 32px;
  fill: var(--td-error-color);
  margin-bottom: 8px;
}

.qr-overlay-content p {
  margin: 0;
  font-size: 14px;
}

.qr-info {
  flex: 1;
  text-align: left;
}

.qr-timer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding: 12px;
  background: var(--td-bg-color-component);
  border-radius: var(--td-radius-default);
}

.qr-timer .icon {
  width: 20px;
  height: 20px;
  fill: var(--td-text-color-secondary);
}

.qr-timer span {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
}

.qr-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: var(--td-radius-default);
  transition: all 0.3s ease;
}

.step.active {
  background: var(--td-brand-color-1);
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: var(--td-radius-circle);
  background: var(--td-bg-color-component);
  color: var(--td-text-color-placeholder);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.step.active .step-number {
  background: var(--td-brand-color);
  color: var(--td-text-color-anti);
}

.step span {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--td-success-color-1);
  border: 1px solid var(--td-success-color-3);
  border-radius: var(--td-radius-default);
  margin-bottom: 24px;
}

.user-avatar {
  width: 48px;
  height: 48px;
  background: var(--td-success-color);
  border-radius: var(--td-radius-circle);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar .icon {
  width: 24px;
  height: 24px;
  fill: var(--td-text-color-anti);
}

.user-details {
  text-align: left;
}

.user-details h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.user-details p {
  margin: 0;
  font-size: 14px;
  color: var(--td-success-color);
}

/* 按钮样式 - 使用TDesign按钮组件，减少自定义样式 */
.login-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
}

.login-actions .t-button {
  min-width: 120px;
}

/* 错误信息 */
.error-details {
  margin-bottom: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .login-page {
    padding: 16px;
  }
  
  .login-container {
    max-width: 100%;
  }
  
  .login-header {
    padding: 24px 24px 20px;
  }
  
  .login-content {
    padding: 20px 24px 24px;
  }
  
  .qr-container {
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  
  .qr-code {
    width: 160px;
    height: 160px;
  }
  
  .qr-info {
    text-align: center;
  }
}

@media (max-height: 768px) {
  .qr-code {
    width: 140px;
    height: 140px;
  }
}
</style>