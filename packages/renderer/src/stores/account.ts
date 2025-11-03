import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserInfo } from 'acfunlive-http-api';

export interface LoginState {
  isLoggedIn: boolean;
  isLogging: boolean;
  qrCode?: string;
  loginError?: string;
  qrLoginToken?: string;
  qrLoginSignature?: string;
  expiresAt?: number;
}

export const useAccountStore = defineStore('account', () => {
  // 状态
  const userInfo = ref<UserInfo | null>(null);
  const loginState = ref<LoginState>({
    isLoggedIn: false,
    isLogging: false,
  });

  // 计算属性
  const isLoggedIn = computed(() => loginState.value.isLoggedIn);
  const isLogging = computed(() => loginState.value.isLogging);
  const displayName = computed(() => userInfo.value?.nickname || '游客');

  // 动作
  async function loadUserInfo() {
    try {
      // 从本地存储或API加载用户信息
      const savedUserInfo = localStorage.getItem('userInfo');
      if (savedUserInfo) {
        const parsed = JSON.parse(savedUserInfo);
        userInfo.value = parsed;
        loginState.value.isLoggedIn = !!parsed.userID;
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  }

  async function startLogin() {
    try {
      loginState.value.isLogging = true;
      loginState.value.loginError = undefined;
      
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/auth/qrcode');
      // const data = await response.json();
      
      // Mock数据
      const data = {
         success: true,
         qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
         token: 'mock_qr_token_' + Date.now(),
         expiresAt: Date.now() + 300000, // 5分钟后过期
         message: ''
       };
      
      if (data.success) {
        loginState.value.qrCode = data.qrCode;
        // 开始轮询登录状态
        pollLoginStatus();
      } else {
        throw new Error(data.message || '获取登录二维码失败');
      }
    } catch (error) {
      console.error('Failed to start login:', error);
      loginState.value.loginError = error instanceof Error ? error.message : '登录失败';
      loginState.value.isLogging = false;
    }
  }

  async function pollLoginStatus() {
    const maxAttempts = 60; // 最多轮询60次（5分钟）
    let attempts = 0;
    
    const poll = async () => {
      if (attempts >= maxAttempts || !loginState.value.isLogging) {
        loginState.value.isLogging = false;
        loginState.value.qrCode = undefined;
        return;
      }
      
      try {
        // TODO: 未实现 - 使用mock数据
        // const response = await fetch('/api/auth/status');
        // const data = await response.json();
        
        // Mock数据 - 模拟登录成功（30%概率）
        const data = Math.random() > 0.7 ? {
          success: true,
          userInfo: {
            userID: 12345,
            nickname: '模拟用户',
            avatar: '',
            followingCount: 100,
            fansCount: 50,
            contributeCount: 1000,
            signature: '这是一个模拟用户',
            verifiedText: '',
            isFollowing: false,
            isFollowed: false,
            medal: {
             uperID: 0,
             userID: 12345,
             clubName: '测试粉丝团',
             level: 1
           },
            managerType: 0
          }
        } : Math.random() > 0.5 ? {
          success: false,
          expired: true,
          message: '二维码已过期'
        } : {
          success: false,
          message: '等待扫码登录'
        };
        
        if (data.success && data.userInfo) {
          // 登录成功
          userInfo.value = data.userInfo;
          loginState.value.isLoggedIn = true;
          loginState.value.isLogging = false;
          loginState.value.qrCode = undefined;
          
          // 保存到本地存储
          localStorage.setItem('userInfo', JSON.stringify(data.userInfo));
          
          console.log('Login successful:', data.userInfo);
        } else if (data.expired) {
          // 二维码过期
          loginState.value.loginError = '二维码已过期，请重新获取';
          loginState.value.isLogging = false;
          loginState.value.qrCode = undefined;
        } else {
          // 继续轮询
          attempts++;
          setTimeout(poll, 5000); // 5秒后再次检查
        }
      } catch (error) {
        console.error('Failed to poll login status:', error);
        attempts++;
        setTimeout(poll, 5000);
      }
    };
    
    poll();
  }

  async function logout() {
    try {
      // TODO: 未实现 - 使用mock数据
      // await fetch('/api/auth/logout', { method: 'POST' });
      
      // Mock数据 - 模拟退出登录成功
      console.log('Mock logout successful');
    } catch (error) {
      console.error('Failed to logout:', error);
    } finally {
      // 清除本地状态
      userInfo.value = null;
      loginState.value.isLoggedIn = false;
      loginState.value.isLogging = false;
      loginState.value.qrCode = undefined;
      loginState.value.loginError = undefined;
      
      // 清除本地存储
      localStorage.removeItem('userInfo');
      
      console.log('Logout completed');
    }
  }

  async function refreshUserInfo() {
    if (!loginState.value.isLoggedIn) return;
    
    try {
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/user/info');
      // const data = await response.json();
      
      // Mock数据
       const data = {
         success: true,
         userInfo: {
           ...userInfo.value,
           followingCount: Math.floor(Math.random() * 1000),
           fansCount: Math.floor(Math.random() * 10000),
           contributeCount: Math.floor(Math.random() * 100000),
           lastUpdate: new Date().toISOString(),
           userID: userInfo.value?.userID || 12345,
           nickname: userInfo.value?.nickname || '测试用户',
           avatar: userInfo.value?.avatar || '',
           medal: userInfo.value?.medal || {
             uperID: 0,
             userID: 12345,
             clubName: '测试粉丝团',
             level: 1
           },
           managerType: userInfo.value?.managerType || 0
         }
       };
      
      if (data.success) {
        userInfo.value = { ...userInfo.value, ...data.userInfo };
        localStorage.setItem('userInfo', JSON.stringify(userInfo.value));
      }
    } catch (error) {
      console.error('Failed to refresh user info:', error);
    }
  }

  // 初始化时加载用户信息
  loadUserInfo();

  return {
    // 状态
    userInfo,
    loginState,
    
    // 计算属性
    isLoggedIn,
    isLogging,
    displayName,
    
    // 动作
    loadUserInfo,
    startLogin,
    logout,
    refreshUserInfo,
  };
});