<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h2>ACFUN直播工具箱</h2>
        <p>请选择登录方式</p>
      </div>

      <t-tabs v-model="activeTab" class="login-tabs">
        <t-tab-panel value="qr" label="二维码登录">
          <div class="qr-login">
            <div class="qr-code-container">
              <div class="qr-code" v-if="!qrLoginSuccess">
                <img src="/qr-placeholder.png" alt="登录二维码" class="qr-image">
                <p class="qr-tip">请使用ACFUN手机APP扫描二维码</p>
                <t-count-down :time="300000" format="mm:ss" class="count-down" />
              </div>
              <div class="qr-success" v-else>
                <t-icon name="check-circle" size="64" class="success-icon" />
                <p>扫描成功，请在手机上确认</p>
              </div>
            </div>
          </div>
        </t-tab-panel>

        <t-tab-panel value="password" label="账号密码登录">
          <t-form ref="loginForm" :data="loginFormData" :rules="loginRules" class="login-form">
            <t-form-item name="username" label="用户名">
              <t-input
                v-model="loginFormData.username"
                placeholder="请输入用户名"
                :prefix-icon="User"
              />
            </t-form-item>
            <t-form-item name="password" label="密码">
              <t-input
                v-model="loginFormData.password"
                type="password"
                placeholder="请输入密码"
                :prefix-icon="Lock"
                :suffix="<t-icon name='eye' @click='togglePasswordVisibility' />"
              />
            </t-form-item>
            <t-form-item>
              <t-checkbox v-model="rememberMe">记住我</t-checkbox>
              <t-link class="forgot-password">忘记密码?</t-link>
            </t-form-item>
            <t-form-item>
              <t-button
                type="primary"
                block
                @click="handlePasswordLogin"
                :loading="loginLoading"
              >
                登录
              </t-button>
            </t-form-item>
          </t-form>
        </t-tab-panel>

        <t-tab-panel value="guest" label="游客模式">
          <div class="guest-login">
            <t-card class="guest-info-card">
              <div class="guest-icon">
                <t-icon name="user" size="48" />
              </div>
              <p class="guest-info">游客模式下部分功能将受到限制</p>
              <p class="guest-features">• 无法管理直播房间
• 无法查看详细数据分析
• 无法使用小程序市场</p>
              <t-button
                type="default"
                block
                @click="handleGuestLogin"
                style="margin-top: 20px"
              >
                进入游客模式
              </t-button>
            </t-card>
          </div>
        </t-tab-panel>
      </t-tabs>

      <div class="login-footer">
        <p>© 2024 ACFUN直播工具箱</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { Tabs, TabPanel, Form, FormItem, Input, Button, Checkbox, Link, Card, CountDown, Icon } from 'tdesign-vue-next';
import { User, Lock, Eye, EyeOff, CheckCircle } from '@tdesign/icons-vue-next';
import { ipcRenderer } from 'electron';
import { useRouter } from 'vue-router';

// 组件注册
const User = User;
const Lock = Lock;
const Eye = Eye;
const EyeOff = EyeOff;
const CheckCircle = CheckCircle;

// 状态管理
const activeTab = ref('qr');
const qrLoginSuccess = ref(false);
const passwordVisible = ref(false);
const rememberMe = ref(false);
const loginLoading = ref(false);
const router = useRouter();

// 表单数据
const loginFormData = reactive({
  username: '',
  password: ''
});

// 表单验证规则
const loginRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
};

// 切换密码可见性
const togglePasswordVisibility = () => {
  passwordVisible.value = !passwordVisible.value;
};

// 处理密码登录
const handlePasswordLogin = async () => {
  const form = document.querySelector('t-form') as any;
  const valid = await form.validate();
  if (!valid) return;

  loginLoading.value = true;
  try {
    const result = await ipcRenderer.invoke('login', {
      loginMethod: 'password',
      username: loginFormData.username,
      password: loginFormData.password
    });

    if (result.success) {
      // 保存会话信息
      if (rememberMe.value) {
        localStorage.setItem('session', JSON.stringify(result.session));
      } else {
        sessionStorage.setItem('session', JSON.stringify(result.session));
      }
      // 跳转到主界面
      router.push('/dashboard');
    } else {
      // 显示错误信息
      alert(result.error);
    }
  } catch (error: any) {
    alert('登录失败: ' + error.message);
  } finally {
    loginLoading.value = false;
  }
};

// 处理游客登录
const handleGuestLogin = async () => {
  try {
    const result = await ipcRenderer.invoke('login', {
      loginMethod: 'guest'
    });

    if (result.success) {
      sessionStorage.setItem('session', JSON.stringify(result.session));
      router.push('/dashboard');
    } else {
      alert(result.error);
    }
  } catch (error: any) {
    alert('登录失败: ' + error.message);
  }
};

// 模拟二维码登录轮询检查
const checkQrLoginStatus = () => {
  // 实际项目中应该是轮询后端检查二维码状态
  setTimeout(() => {
    qrLoginSuccess.value = true;
    setTimeout(() => {
      handleGuestLogin(); // 模拟登录成功
    }, 2000);
  }, 5000);
};

// 初始化二维码登录检查
checkQrLoginStatus();
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.login-header {
  padding: 30px 20px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}

.login-header h2 {
  margin: 0 0 10px;
  color: #165DFF;
  font-size: 24px;
}

.login-header p {
  margin: 0;
  color: #666;
}

.login-tabs {
  padding: 20px;
}

.qr-login {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.qr-code-container {
  text-align: center;
}

.qr-code {
  padding: 20px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  display: inline-block;
}

.qr-image {
  width: 180px;
  height: 180px;
  background-color: #f5f5f5;
}

.qr-tip {
  margin: 15px 0 10px;
  color: #666;
}

.count-down {
  color: #165DFF;
  font-size: 14px;
}

.qr-success {
  padding: 40px 20px;
  text-align: center;
}

.success-icon {
  color: #00B42A;
  margin-bottom: 15px;
}

.login-form {
  margin-top: 10px;
}

.forgot-password {
  margin-left: auto;
  display: inline-block;
}

.guest-login {
  padding: 10px 0;
}

.guest-info-card {
  text-align: center;
  padding: 30px 20px;
}

.guest-icon {
  margin-bottom: 20px;
  color: #165DFF;
}

.guest-info {
  color: #333;
  margin-bottom: 15px;
  font-size: 14px;
}

.guest-features {
  text-align: left;
  color: #666;
  font-size: 13px;
  line-height: 1.8;
  margin-bottom: 20px;
}

.login-footer {
  padding: 15px 20px;
  text-align: center;
  border-top: 1px solid #f0f0f0;
}

.login-footer p {
  margin: 0;
  color: #999;
  font-size: 12px;
}
</style>