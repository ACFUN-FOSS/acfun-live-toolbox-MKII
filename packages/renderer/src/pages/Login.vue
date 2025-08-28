<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { Button, Checkbox, Message, Input, Loading } from 'tdesign-vue-next';
import { useRouter } from 'vue-router';
import axios from 'axios';

// 创建API实例
const api = axios.create({
  baseURL: '/api',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器添加token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 状态管理
const isLoginMode = ref(true); // true: 账号登录, false: 欢迎界面
const isScanMode = ref(false); // 是否扫码登录模式
const qrCodeUrl = ref(''); // 二维码图片URL
const pollingInterval = ref(null); // 轮询定时器
const qrCodeExpireTimer = ref(null); // 二维码过期定时器
const isScanned = ref(false); // 是否已扫码
const agreeTerms = ref(false);
const loginStatus = ref('');
const version = ref('3.1.0');
const formData = reactive({
  username: '',
  password: ''
});
const loading = ref(false);

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

// 清除表单
const resetForm = () => {
  formData.username = '';
  formData.password = '';
};

// 切换登录模式
const toggleLoginMode = () => {
  isLoginMode.value = !isLoginMode.value;
};

// 生成登录二维码
const generateQrCode = async () => {
  try {
    // 清除之前的定时器
    if (qrCodeExpireTimer.value) clearTimeout(qrCodeExpireTimer.value);
    isScanned.value = false;
    qrCodeUrl.value = '';
    const response = await api.get('/auth/qrcode');
    qrCodeUrl.value = response.data.qrCodeUrl;
    startPollingLoginStatus(response.data.qrCodeId);
    // 设置二维码过期自动刷新
    qrCodeExpireTimer.value = setTimeout(() => {
      if (qrCodeUrl.value) {
        generateQrCode();
        Message.info('二维码已过期，已自动刷新');
      }
    }, 180000);
  } catch (error) {
    Message.error('生成二维码失败，请重试');
  }
};

// 开始轮询登录状态
const startPollingLoginStatus = (qrCodeId) => {
  // 清除之前的定时器
  if (pollingInterval.value) clearInterval(pollingInterval.value);

  // 设置新的轮询
  pollingInterval.value = setInterval(async () => {
    try {
      const response = await api.get(`/auth/qrcode/${qrCodeId}/status`);
      if (response.data.status === 'scanned') {
          // 已扫码待确认
          isScanned.value = true;
          Message.info('已扫描，请在手机上确认登录');
        } else if (response.data.status === 'success') {

        // 登录成功
        localStorage.setItem('token', response.data.token);
        clearInterval(pollingInterval.value);
        Message.success('登录成功');
        router.push('/');
      } else if (response.data.status === 'expired') {
        // 二维码过期
        clearInterval(pollingInterval.value);
        Message.warning('二维码已过期，请刷新');
        qrCodeUrl.value = '';
      }
    } catch (error) {
      clearInterval(pollingInterval.value);
      Message.error('检查登录状态失败');
    }
  }, 2000);
};

// 组件卸载时清除定时器
onUnmounted(() => {
  if (pollingInterval.value) clearInterval(pollingInterval.value);
  if (qrCodeExpireTimer.value) clearTimeout(qrCodeExpireTimer.value);
});

// 登录处理
const handleLogin = async () => {
  if (!agreeTerms.value) {
    Message.warning('请同意用户协议和隐私政策');
    return;
  }

  if (!formData.username || !formData.password) {
    Message.warning('请输入用户名和密码');
    return;
  }

  loading.value = true;
  loginStatus.value = '登录中...';

  try {
    const response = await api.post('/auth/login', {
      username: formData.username,
      password: formData.password
    });

    // 存储token
    const { token } = response.data.data;
    localStorage.setItem('token', token);

    loginStatus.value = '登录成功，正在跳转...';
    Message.success('登录成功');
    router.push('/');
  } catch (error) {
    loginStatus.value = '登录失败，请检查账号密码';
    Message.error(error.response?.data?.error || '登录失败，请重试');
  } finally {
    loading.value = false;
  }
};

// 检查登录状态
const checkLoginStatus = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    await api.get('/auth/verify');
    // 令牌有效，直接跳转
    router.push('/');
  } catch (error) {
    // 令牌无效，清除本地存储
    localStorage.removeItem('token');
    loginStatus.value = '请重新登录';
  }
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
          <div class="login-tabs">
  <div :class="{ 'tab-active': !isScanMode }" @click="isScanMode = false">账号密码登录</div>
  <div :class="{ 'tab-active': isScanMode }" @click="isScanMode = true">扫码登录</div>
</div>

<template v-if="!isScanMode">
  <div class="login-form">
    <Input
      v-model="formData.username"
      placeholder="请输入用户名"
      class="login-input"
      :prefix-icon="'user'"
    />
    <Input
      v-model="formData.password"
      type="password"
      placeholder="请输入密码"
      class="login-input"
      :prefix-icon="'lock'"
    />
  </div>
</template>

<template v-if="isScanMode">
  <div class="qr-code-container">
    <div class="qr-code" v-if="qrCodeUrl">
      <img :src="qrCodeUrl" alt="扫码登录">
      <div v-if="isScanned" class="qr-scanned-indicator">
        <i class="scanned-icon">✓</i>
        <span>已扫描，请在手机上确认</span>
      </div>
    </div>
    <div class="qr-loading" v-else>
      <Loading size="large" />
    </div>
    <p class="qr-tip">请使用ACFUN手机APP扫码登录</p>
    <Button type="text" class="refresh-qr" @click="generateQrCode">
      刷新二维码
    </Button>
    <p class="qr-expire-tip">二维码有效期为180秒</p>
  </div>
</template>
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
  width: 100%;
  max-width: 350px;
  padding: 30px;
  background-color: #1e293b;
  border-radius: var(--td-radius-medium); /* 使用主题变量统一圆角 */
  box-shadow: var(--td-shadow-4);
  color: #fff;
}

.login-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  text-align: center;
  color: #f8fafc; /* 主要文本色 - UI规范 */
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
  color: #cbd5e1; /* 次要文本色 - UI规范 */
  min-height: 20px;
}

.terms-agreement {
  margin-bottom: 20px;
  font-size: 12px;
  color: #cbd5e1; /* 次要文本色 - UI规范 */
}

.link {
  color: #1890ff; /* 主色调 - UI规范 */
  text-decoration: underline;
  cursor: pointer;
}

.login-btn {
  width: 100%;
  height: 40px;
  margin-bottom: 15px;
}

.login-tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #334155;
}

.login-tabs > div {
  padding: 8px 16px;
  cursor: pointer;
  position: relative;
  font-size: 14px;
}

.tab-active {
  color: #1890ff;
}

.tab-active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: #1890ff;
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
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid #334155;
  border-radius: 8px;
  margin-bottom: 15px;
}

.qr-code img {
  max-width: 180px;
  max-height: 180px;
}

.qr-loading {
  width: 200px;
  height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.qr-tip {
  color: #94a3b8;
  font-size: 14px;
  margin-top: 15px;
}
.qr-expire-tip {
  color: #94a3b8;
  font-size: 12px;
  margin-top: 8px;
}
.qr-scanned-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
  width: 80%;
}
.scanned-icon {
  color: #36d399;
  font-size: 20px;
  margin-right: 5px;
  font-weight: bold;
.qr-scanned {
  color: #36d399;
  font-size: 14px;
  margin-top: 10px;
  text-align: center;
}

.refresh-qr {
  color: #3b82f6;
}

.switch-mode {
  text-align: center;
  color: #3b82f6;
  cursor: pointer;
  font-size: 14px;
}

.welcome-card {  width: 400px;
  padding: 40px;
  background-color: #1e293b;
  border-radius: var(--td-radius-medium); /* 使用主题变量统一圆角 */
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  color: #fff;
} display: flex;
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
  color: #f8fafc; /* 主要文本色 - UI规范 */
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
  background-image: var(--td-bg-image);
  background-size: cover;
  background-position: center;
  opacity: var(--td-bg-opacity);
  z-index: 0;
}
</style>