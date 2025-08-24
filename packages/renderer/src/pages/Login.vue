<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo-container">
        <img src="/assets/images/logo.png" alt="ACFUN直播工具箱" class="logo">
        <h1 class="app-name">ACFUN直播工具箱</h1>
      </div>
      <div class="login-form">
        <h2 class="form-title">扫码登录</h2>
        <p class="form-subtitle">使用ACFUN手机客户端扫码登录</p>
        
        <div class="qr-code-container" v-if="qrCodeUrl">
          <img :src="qrCodeUrl" alt="登录二维码" class="qr-code" :class="{ 'expired': isExpired }">
          <div class="qr-status" :class="{ 'scanned': isScanned, 'expired': isExpired, 'checking': checkingStatus }">
            <template v-if="isScanned">已扫描，请在手机上确认</template>
            <template v-else-if="isExpired">二维码已过期，请刷新</template>
            <template v-else-if="checkingStatus">检查扫描状态中...</template>
            <template v-else>请扫描二维码</template>
          </div>
        </div>
        <div class="loading-indicator" v-else>
          <div class="spinner"></div>
          <p>正在生成二维码...</p>
        </div>
        
        <div class="action-buttons">
          <button @click="refreshQrCode" class="btn-refresh" :disabled="checkingStatus">刷新二维码</button>
          <button @click="cancelLogin" class="btn-cancel" :disabled="checkingStatus">取消</button>
        </div>

        <div class="switch-login-method">
          <span>其他登录方式：</span>
          <button @click="switchToPasswordLogin" class="btn-password-login">账号密码登录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';

// 状态定义
const qrCodeUrl = ref<string | null>(null);
const qrToken = ref<string | null>(null);
const isScanned = ref(false);
const isExpired = ref(false);
const checkingStatus = ref(false);
const router = useRouter();
let statusCheckInterval: ReturnType<typeof setInterval> | null = null;

// 初始化
onMounted(() => {
  // 生成登录二维码
  generateLoginQrCode();

  // 监听二维码生成事件
  window.api.auth.onQrCodeGenerated((data) => {
    qrCodeUrl.value = data.qrCodeUrl;
    qrToken.value = data.token;
    startStatusCheck();
  });

  // 监听二维码扫描事件
  window.api.auth.onQrScanned(() => {
    isScanned.value = true;
  });

  // 监听二维码过期事件
  window.api.auth.onQrExpired(() => {
    isExpired.value = true;
    stopStatusCheck();
  });

  // 监听登录成功事件
  window.api.auth.onLoginSuccess((userInfo) => {
    console.log('登录成功:', userInfo);
    stopStatusCheck();
    router.push('/dashboard');
  });

  // 监听登录失败事件
  window.api.auth.onLoginFailed((error) => {
    console.error('登录失败:', error);
    stopStatusCheck();
    alert('登录失败: ' + (error.message || '未知错误'));
    // 重新生成二维码
    generateLoginQrCode();
  });

  // 监听认证状态变化
  window.api.auth.onAuthStatusChanged((status) => {
    console.log('认证状态变化:', status);
    if (status.isAuthenticated) {
      router.push('/dashboard');
    }
  });
});

// 清理
onUnmounted(() => {
  // 移除事件监听
  window.api.auth.off('auth:qr-code-generated');
  window.api.auth.off('auth:qr-scanned');
  window.api.auth.off('auth:qr-expired');
  window.api.auth.off('auth:login-success');
  window.api.auth.off('auth:login-failed');
  window.api.auth.off('auth:status-changed');
  stopStatusCheck();
});

// 生成登录二维码
async function generateLoginQrCode() {
  try {
    isScanned.value = false;
    isExpired.value = false;
    qrCodeUrl.value = null;
    qrToken.value = null;
    stopStatusCheck();

    await window.api.auth.generateLoginQrCode();
  } catch (error) {
    console.error('生成二维码异常:', error);
    alert('生成二维码异常: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

// 开始检查二维码状态
function startStatusCheck() {
  // 停止之前可能存在的检查
  stopStatusCheck();

  if (!qrToken.value) return;

  // 立即检查一次
  checkQrCodeStatus();

  // 然后每隔3秒检查一次
  statusCheckInterval = setInterval(() => {
    checkQrCodeStatus();
  }, 3000);
}

// 检查二维码状态
async function checkQrCodeStatus() {
  if (!qrToken.value || checkingStatus.value || isScanned.value || isExpired.value) {
    return;
  }

  try {
    checkingStatus.value = true;
    const result = await window.api.auth.checkQrCodeStatus(qrToken.value);

    if (result.status === 'scanned') {
      isScanned.value = true;
    } else if (result.status === 'expired') {
      isExpired.value = true;
      alert('二维码已过期，请刷新');
      generateLoginQrCode();
    }
    // 如果是'waiting'状态，继续等待
  } catch (error) {
    console.error('检查二维码状态异常:', error);
  } finally {
    checkingStatus.value = false;
  }
}

// 停止检查二维码状态
function stopStatusCheck() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
  checkingStatus.value = false;
}

// 刷新二维码
function refreshQrCode() {
  generateLoginQrCode();
}

// 取消登录
function cancelLogin() {
  router.push('/');
}

// 切换到密码登录
function switchToPasswordLogin() {
  router.push('/login/password');
}
</script>

<style scoped>
:root {
  --primary-color: #ff6b6b;
  --secondary-color: #4ecdc4;
  --text-color: #292f36;
  --light-text: #f7fff7;
  --background-color: #f7fff7;
  --card-background: #ffffff;
  --border-color: #e0e0e0;
  --success-color: #10b981;
}

.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--background-color);
  padding: 20px;
}

.login-card {
  background-color: var(--card-background);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 420px;
  overflow: hidden;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 20px;
  background-color: var(--primary-color);
  color: var(--light-text);
}

.logo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 15px;
  background-color: white;
  padding: 5px;
}

.app-name {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.login-form {
  padding: 30px 25px;
}

.form-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-color);
  margin-top: 0;
  margin-bottom: 5px;
  text-align: center;
}

.form-subtitle {
  font-size: 14px;
  color: #666;
  text-align: center;
  margin-bottom: 25px;
}

.qr-code-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 25px;
}

.qr-code {
  width: 200px;
  height: 200px;
  padding: 10px;
  background-color: white;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 15px;
}

.qr-status {
  font-size: 14px;
  color: #666;
}

.qr-status.scanned {
  color: var(--success-color);
  font-weight: 500;
}

.qr-status.expired {
  color: var(--primary-color);
  font-weight: 500;
}

.qr-status.checking {
  color: var(--secondary-color);
  font-style: italic;
}

.switch-login-method {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 30px;
  font-size: 14px;
  color: #666;
}

.btn-password-login {
  margin-left: 10px;
  padding: 6px 12px;
  background-color: transparent;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-password-login:hover {
  background-color: var(--primary-color);
  color: white;
}

.qr-code.expired {
  opacity: 0.6;
  filter: grayscale(100%);
}

.btn-refresh:disabled,
.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.btn-refresh,
.btn-cancel {
  padding: 12px 15px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.btn-refresh {
  background-color: var(--primary-color);
  color: white;
  border: none;
}

.btn-refresh:hover {
  background-color: #ff5252;
}

.btn-cancel {
  background-color: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.btn-cancel:hover {
  background-color: #f0f0f0;
}

@media (max-width: 480px) {
  .login-card {
    max-width: 100%;
  }

  .qr-code {
    width: 160px;
    height: 160px;
  }
}
</style>