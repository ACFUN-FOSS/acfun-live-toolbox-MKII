<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo-container">
        <img src="/assets/images/logo.png" alt="ACFUN直播工具箱" class="logo">
        <h1 class="app-name">ACFUN直播工具箱</h1>
      </div>
      <div class="login-form">
        <h2 class="form-title">账号密码登录</h2>
        <p class="form-subtitle">请输入您的ACFUN账号和密码</p>

        <div class="form-group">
          <label for="username" class="form-label">账号</label>
          <input
            type="text"
            id="username"
            v-model="username"
            placeholder="请输入账号"
            class="form-input"
            :disabled="isLoading"
          >
        </div>

        <div class="form-group">
          <label for="password" class="form-label">密码</label>
          <input
            type="password"
            id="password"
            v-model="password"
            placeholder="请输入密码"
            class="form-input"
            :disabled="isLoading"
          >
        </div>

        <div class="form-group remember-me">
          <input
            type="checkbox"
            id="remember-me"
            v-model="rememberMe"
            :disabled="isLoading"
          >
          <label for="remember-me">记住我</label>
        </div>

        <div class="error-message" v-if="errorMessage">{{ errorMessage }}</div>

        <div class="loading-indicator" v-if="isLoading">
          <div class="spinner"></div>
          <p>登录中...</p>
        </div>

        <div class="action-buttons">
          <button @click="login" class="btn-login" :disabled="isLoading || !username || !password">登录</button>
          <button @click="switchToQrLogin" class="btn-qr-login" :disabled="isLoading">扫码登录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

// 状态定义
const username = ref('');
const password = ref('');
const rememberMe = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');
const router = useRouter();

// 登录
async function login() {
  if (!username.value || !password.value) {
    errorMessage.value = '请输入账号和密码';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    await window.api.auth.login({ username: username.value, password: password.value, rememberMe: rememberMe.value });
    // 登录成功后，认证状态变化事件会触发并导航到仪表盘
  } catch (error) {
    console.error('登录失败:', error);
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请重试';
  } finally {
    isLoading.value = false;
  }
}

// 切换到扫码登录
function switchToQrLogin() {
  router.push('/login');
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
  --error-color: #e74c3c;
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

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  color: var(--text-color);
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.remember-me {
  display: flex;
  align-items: center;
  margin-bottom: 25px;
}

.remember-me input {
  margin-right: 10px;
}

.error-message {
  color: var(--error-color);
  font-size: 14px;
  margin-bottom: 20px;
  text-align: center;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  margin-bottom: 20px;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.btn-login,
.btn-qr-login {
  padding: 12px 15px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.btn-login {
  background-color: var(--primary-color);
  color: white;
  border: none;
}

.btn-login:hover {
  background-color: #ff5252;
}

.btn-login:disabled {
  background-color: #ffb3b3;
  cursor: not-allowed;
}

.btn-qr-login {
  background-color: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.btn-qr-login:hover {
  background-color: #f0f0f0;
}

.btn-qr-login:disabled {
  background-color: #f9f9f9;
  color: #cccccc;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .login-card {
    max-width: 100%;
  }
}
</style>