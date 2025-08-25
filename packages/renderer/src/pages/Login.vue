<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Button, Checkbox, Message } from 'tdesign-vue-next';
import { useRouter } from 'vue-router';

// 状态管理
const isLoginMode = ref(true); // true: 二维码登录, false: 欢迎界面
const agreeTerms = ref(false);
const loginStatus = ref('');
const qrCodeUrl = ref('https://picsum.photos/200/200');
const version = ref('3.1.0');

const router = useRouter();

// 模拟登录状态检查
onMounted(() => {
  // 检查是否已登录
  checkLoginStatus();
});

// 检查登录状态
const checkLoginStatus = () => {
  // 模拟API调用
  setTimeout(() => {
    // 假设未登录
    loginStatus.value = '未登录';
  }, 1000);
};

// 刷新二维码
const refreshQrCode = () => {
  // 模拟刷新二维码
  qrCodeUrl.value = `https://picsum.photos/200/200?random=${Math.random()}`;
  loginStatus.value = '二维码已刷新，请扫码登录';
  Message.success('二维码已刷新');
};

// 切换登录模式
const toggleLoginMode = () => {
  isLoginMode.value = !isLoginMode.value;
};

// 登录处理
const handleLogin = () => {
  if (!agreeTerms.value) {
    Message.warning('请同意用户协议和隐私政策');
    return;
  }

  loginStatus.value = '登录中...';

  // 模拟登录API调用
  setTimeout(() => {
    loginStatus.value = '登录成功，正在跳转...';
    Message.success('登录成功');
    // 跳转到仪表盘
    router.push('/');
  }, 2000);
};

// 打开免责声明
const openDisclaimer = () => {
  Message.info('免责声明弹窗');
  // 这里应该打开一个弹窗显示免责声明
};
</script>

<template>
  <div class="login-container">
    <!-- 顶部导航栏 -->
    <div class="top-bar">
      <div class="logo">ACFUN直播工具箱</div>
    </div>

    <!-- 中部登录区域 -->
    <div class="login-area">
      <template v-if="isLoginMode">
        <div class="login-card">
          <h2 class="login-title">扫码登录</h2>
          <div class="qr-code-container">
            <img :src="qrCodeUrl" alt="登录二维码" class="qr-code">
            <button @click="refreshQrCode" class="refresh-btn">刷新二维码</button>
          </div>
          <p class="login-status">{{ loginStatus }}</p>
          <div class="terms-agreement">
            <Checkbox v-model="agreeTerms" size="small">
              我已阅读并同意 <a href="#" @click="openDisclaimer" class="link">用户协议</a> 和 <a href="#" @click="openDisclaimer" class="link">隐私政策</a>
            </Checkbox>
          </div>
          <Button type="primary" class="login-btn" @click="handleLogin" :disabled="!agreeTerms">
            登录
          </Button>
          <div class="switch-mode" @click="toggleLoginMode">
            返回欢迎界面
          </div>
        </div>
      </template>
      <template v-else>
        <div class="welcome-card">
          <div class="welcome-logo">
            <img src="https://picsum.photos/100/100" alt="ACFUN Logo" class="logo-img">
          </div>
          <h1 class="welcome-title">ACFUN直播工具箱</h1>
          <p class="welcome-desc">专业的直播辅助工具，让你的直播更精彩</p>
          <Button type="primary" class="enter-btn" @click="toggleLoginMode">
            开始使用
          </Button>
        </div>
      </template>
    </div>

    <!-- 底部区域 -->
    <div class="bottom-bar">
      <div class="version-info">版本: {{ version }}</div>
      <div class="copyright-info">© 2023 ACFUN. 保留所有权利</div>
    </div>

    <!-- 背景图片 -->
    <div class="background-image"></div>
  </div>
</template>

<style scoped>
.login-container {
  position: relative;
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  background-color: #0f172a;
  overflow: hidden;
}

.top-bar {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background-color: #1e293b;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.logo {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.login-area {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.login-card {
  width: 350px;
  padding: 30px;
  background-color: #1e293b;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  color: #fff;
}

.login-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  text-align: center;
  color: #e2e8f0;
}

.qr-code-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.qr-code {
  width: 200px;
  height: 200px;
  border: 2px solid #334155;
  border-radius: 8px;
  margin-bottom: 15px;
}

.refresh-btn {
  padding: 6px 12px;
  background-color: #334155;
  color: #e2e8f0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.refresh-btn:hover {
  background-color: #475569;
}

.login-status {
  text-align: center;
  margin-bottom: 20px;
  color: #94a3b8;
  min-height: 20px;
}

.terms-agreement {
  margin-bottom: 20px;
  font-size: 12px;
  color: #94a3b8;
}

.link {
  color: #3b82f6;
  text-decoration: underline;
  cursor: pointer;
}

.login-btn {
  width: 100%;
  height: 40px;
  margin-bottom: 15px;
}

.switch-mode {
  text-align: center;
  color: #3b82f6;
  cursor: pointer;
  font-size: 14px;
}

.welcome-card {
  width: 400px;
  padding: 40px;
  background-color: #1e293b;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.welcome-logo {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background-color: #334155;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
}

.logo-img {
  width: 70px;
  height: 70px;
  border-radius: 50%;
}

.welcome-title {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #e2e8f0;
}

.welcome-desc {
  font-size: 16px;
  color: #94a3b8;
  margin-bottom: 30px;
}

.enter-btn {
  width: 180px;
  height: 45px;
  font-size: 16px;
}

.bottom-bar {
  height: 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background-color: #1e293b;
  color: #94a3b8;
  font-size: 12px;
}

.background-image {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 500px;
  height: 500px;
  background-image: url('https://picsum.photos/500/500');
  background-size: cover;
  background-position: center;
  opacity: 0.1;
  z-index: 0;
}
</style>