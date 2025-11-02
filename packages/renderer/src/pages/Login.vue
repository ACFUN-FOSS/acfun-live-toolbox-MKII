<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1 class="login-title">AcFun 直播工具箱</h1>
        <p class="login-subtitle">请使用 AcFun App 扫码登录</p>
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
        <button 
          v-if="loginState === 'idle' || loginState === 'error'" 
          class="btn btn-primary" 
          @click="startQrLogin"
          :disabled="isLoading"
        >
          <svg v-if="isLoading" class="icon spin" viewBox="0 0 24 24">
            <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
          </svg>
          <svg v-else class="icon" viewBox="0 0 24 24">
            <path d="M3,11H5V13H3V11M11,5H13V9H11V5M9,11H13V15H11V13H9V11M15,11H17V13H15V11M19,5H21V9H19V5M5,5H9V9H7V7H5V5M3,19H5V21H3V19M5,15H7V19H5V15M19,15H21V19H19V15M15,19H17V21H15V19M17,5V7H19V5H17M9,19V21H13V19H11V17H9V19M21,11H23V13H21V11M17,15H19V17H17V15M9,5V7H11V5H9Z"/>
          </svg>
          开始扫码登录
        </button>
        
        <button 
          v-if="loginState === 'qr_ready'" 
          class="btn btn-secondary" 
          @click="refreshQrCode"
          :disabled="isLoading"
        >
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
          </svg>
          刷新二维码
        </button>
        
        <button 
          v-if="loginState === 'success'" 
          class="btn btn-danger" 
          @click="logout"
          :disabled="isLoading"
        >
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M16,17V14H9V10H16V7L21,12L16,17M14,2A2,2 0 0,1 16,4V6H14V4H5V20H14V18H16V20A2,2 0 0,1 14,22H5A2,2 0 0,1 3,20V4A2,2 0 0,1 5,2H14Z"/>
          </svg>
          退出登录
        </button>
      </div>

      <!-- 错误信息 -->
      <div v-if="loginState === 'error'" class="error-details">
        <div class="error-message">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>{{ errorMessage }}</span>
        </div>
        <div class="error-actions">
          <button class="btn btn-text" @click="startQrLogin">重试</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted } from 'vue';

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
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  max-width: 500px;
  width: 100%;
  text-align: center;
}

.login-header {
  margin-bottom: 32px;
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 8px 0;
}

.login-subtitle {
  font-size: 16px;
  color: #718096;
  margin: 0;
}

/* 状态卡片 */
.status-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  transition: all 0.3s ease;
}

.status-card.status-idle {
  background: #f7fafc;
  border: 2px solid #e2e8f0;
}

.status-card.status-loading {
  background: #ebf8ff;
  border: 2px solid #3182ce;
}

.status-card.status-success {
  background: #f0fff4;
  border: 2px solid #38a169;
}

.status-card.status-error {
  background: #fed7d7;
  border: 2px solid #e53e3e;
}

.status-icon {
  margin-right: 16px;
}

.status-icon .icon {
  width: 32px;
  height: 32px;
}

.status-card.status-idle .icon {
  fill: #718096;
}

.status-card.status-loading .icon {
  fill: #3182ce;
}

.status-card.status-success .icon {
  fill: #38a169;
}

.status-card.status-error .icon {
  fill: #e53e3e;
}

.status-content {
  text-align: left;
  flex: 1;
}

.status-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #2d3748;
}

.status-message {
  font-size: 14px;
  color: #718096;
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
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  background: white;
}

.qr-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.qr-overlay-content {
  text-align: center;
}

.qr-overlay-content .icon {
  width: 32px;
  height: 32px;
  fill: #fbb6ce;
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
  background: #f7fafc;
  border-radius: 8px;
}

.qr-timer .icon {
  width: 20px;
  height: 20px;
  fill: #4a5568;
}

.qr-timer span {
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
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
  border-radius: 8px;
  transition: all 0.3s ease;
}

.step.active {
  background: #ebf8ff;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #718096;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.step.active .step-number {
  background: #3182ce;
  color: white;
}

.step span {
  font-size: 14px;
  color: #4a5568;
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f0fff4;
  border: 2px solid #38a169;
  border-radius: 12px;
  margin-bottom: 24px;
}

.user-avatar {
  width: 48px;
  height: 48px;
  background: #38a169;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar .icon {
  width: 24px;
  height: 24px;
  fill: white;
}

.user-details {
  text-align: left;
}

.user-details h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
}

.user-details p {
  margin: 0;
  font-size: 14px;
  color: #38a169;
}

/* 按钮样式 */
.login-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn .icon {
  width: 16px;
  height: 16px;
}

.btn-primary {
  background: #3182ce;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2c5aa0;
  transform: translateY(-1px);
}

.btn-secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-secondary:hover:not(:disabled) {
  background: #cbd5e0;
  transform: translateY(-1px);
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c53030;
  transform: translateY(-1px);
}

.btn-text {
  background: transparent;
  color: #3182ce;
  padding: 8px 16px;
}

.btn-text:hover:not(:disabled) {
  background: #ebf8ff;
}

/* 错误信息 */
.error-details {
  text-align: left;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fed7d7;
  border: 1px solid #feb2b2;
  border-radius: 8px;
  margin-bottom: 12px;
}

.error-message .icon {
  width: 20px;
  height: 20px;
  fill: #e53e3e;
  flex-shrink: 0;
}

.error-message span {
  font-size: 14px;
  color: #742a2a;
}

.error-actions {
  text-align: center;
}

/* 动画 */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 640px) {
  .login-container {
    padding: 24px;
    margin: 16px;
  }
  
  .qr-container {
    flex-direction: column;
    align-items: center;
  }
  
  .qr-info {
    text-align: center;
  }
  
  .login-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>