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

  // 创建基本用户信息的辅助函数
  function createBasicUserInfo(userId: string): UserInfo {
    return {
      userID: parseInt(userId),
      nickname: `用户${userId}`,
      avatar: '',
      medal: {
        uperID: 0,
        userID: parseInt(userId),
        clubName: '',
        level: 0
      },
      managerType: 0
    };
  }

  async function startLogin() {
    try {
      loginState.value.isLogging = true;
      loginState.value.loginError = undefined;
      
      // 使用真实的preload API
      const result = await window.electronApi.login.qrStart();
      
      if ('error' in result) {
        throw new Error(result.error);
      }
      
      if ('qrCodeDataUrl' in result) {
        loginState.value.qrCode = result.qrCodeDataUrl;
        // 不再自动开始轮询，由HomePage.vue控制轮询过程
        // pollLoginStatus();
      } else {
        throw new Error('获取登录二维码失败');
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
        // 使用真实的preload API
        const result = await window.electronApi.login.qrCheck();
        
        if (result.success && result.tokenInfo) {
          // 登录成功，使用userId获取完整的用户信息
          const userId = result.tokenInfo.userID;
          console.log('Login successful, fetching user info for userId:', userId);
          
          try {
            // 调用HTTP API获取完整的用户信息
            const userInfoResponse = await fetch(`http://127.0.0.1:18299/api/acfun/user/info?userId=${userId}`);
            
            if (userInfoResponse.ok) {
              const userInfoResult = await userInfoResponse.json();
              
              if (userInfoResult.success && userInfoResult.data) {
                // 使用API返回的完整用户信息
                const completeUserInfo: UserInfo = {
                  userID: parseInt(userId),
                  nickname: userInfoResult.data.username || userInfoResult.data.nickname || `用户${userId}`,
                  avatar: userInfoResult.data.avatar || '',
                  medal: {
                    uperID: 0,
                    userID: parseInt(userId),
                    clubName: '',
                    level: userInfoResult.data.level || 0
                  },
                  managerType: 0
                };
                
                userInfo.value = completeUserInfo;
                console.log('Complete user info fetched:', completeUserInfo);
              } else {
                // API调用失败，使用基本信息
                console.warn('Failed to fetch complete user info, using basic info:', userInfoResult.error);
                userInfo.value = createBasicUserInfo(userId);
              }
            } else {
              // HTTP请求失败，使用基本信息
              console.warn('HTTP request failed, using basic user info');
              userInfo.value = createBasicUserInfo(userId);
            }
          } catch (error) {
            // 网络错误，使用基本信息
            console.error('Error fetching user info:', error);
            userInfo.value = createBasicUserInfo(userId);
          }
          
          loginState.value.isLoggedIn = true;
          loginState.value.isLogging = false;
          loginState.value.qrCode = undefined;
          
          // 保存到本地存储
          localStorage.setItem('userInfo', JSON.stringify(userInfo.value));
          
          console.log('Login completed with user info:', userInfo.value);
        } else if ('error' in result && result.error) {
          // 发生错误
          loginState.value.loginError = result.error;
          loginState.value.isLogging = false;
          loginState.value.qrCode = undefined;
        } else {
          // 继续轮询
          attempts++;
          setTimeout(poll, 2000); // 2秒后再次检查
        }
      } catch (error) {
        console.error('Failed to poll login status:', error);
        attempts++;
        setTimeout(poll, 2000);
      }
    };
    
    poll();
  }

  async function logout() {
    try {
      // 使用真实的preload API
      await window.electronApi.login.logout();
      
      // logout API 总是返回 { ok: true }，没有 error 属性
      console.log('Logout successful');
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

  async function handleLoginSuccess(tokenInfo: any) {
    try {
      console.log('处理登录成功，tokenInfo:', tokenInfo);
      
      const userId = tokenInfo.userID || tokenInfo.userId;
      if (!userId) {
        throw new Error('Token info does not contain user ID');
      }

      // 创建基本用户信息
      const createBasicUserInfo = (userId: string): UserInfo => ({
        userID: userId,
        nickname: `用户${userId}`,
        avatar: '',
        medal: {
          uperID: 0,
          userID: userId,
          clubName: '',
          level: 0
        },
        managerType: 0
      });

      try {
        // 尝试获取完整的用户信息
        const userInfoResponse = await fetch(`http://127.0.0.1:18299/api/acfun/user/info?userId=${userId}`);
        
        if (userInfoResponse.ok) {
          const userInfoResult = await userInfoResponse.json();
          
          if (userInfoResult.success && userInfoResult.data) {
            // 使用完整的用户信息
            const completeUserInfo: UserInfo = {
              userID: userId,
              nickname: userInfoResult.data.username || userInfoResult.data.nickname || `用户${userId}`,
              avatar: userInfoResult.data.avatar || '',
              medal: {
                uperID: 0,
                userID: userId,
                clubName: '',
                level: userInfoResult.data.level || 0
              },
              managerType: 0
            };
            
            userInfo.value = completeUserInfo;
            console.log('Complete user info fetched:', completeUserInfo);
          } else {
            // API调用失败，使用基本信息
            console.warn('Failed to fetch complete user info, using basic info:', userInfoResult.error);
            userInfo.value = createBasicUserInfo(userId);
          }
        } else {
          // HTTP请求失败，使用基本信息
          console.warn('HTTP request failed, using basic user info');
          userInfo.value = createBasicUserInfo(userId);
        }
      } catch (error) {
        // 网络错误，使用基本信息
        console.error('Error fetching user info:', error);
        userInfo.value = createBasicUserInfo(userId);
      }
      
      // 设置登录状态
      loginState.value.isLoggedIn = true;
      loginState.value.isLogging = false;
      loginState.value.qrCode = undefined;
      loginState.value.loginError = undefined;
      
      // 保存到本地存储
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value));
      
      console.log('Login completed with user info:', userInfo.value);
    } catch (error) {
      console.error('Failed to handle login success:', error);
      loginState.value.loginError = `登录处理失败: ${error instanceof Error ? error.message : String(error)}`;
      loginState.value.isLogging = false;
    }
  }

  async function refreshUserInfo() {
    try {
      // 如果用户已经登录，刷新用户信息
      if (loginState.value.isLoggedIn && userInfo.value?.userID) {
        console.log('Refreshing user info for logged in user:', userInfo.value.userID);
        
        try {
          // 调用HTTP API获取最新的用户信息
          const userInfoResponse = await fetch(`http://127.0.0.1:18299/api/acfun/user/info?userId=${userInfo.value.userID}`);
          
          if (userInfoResponse.ok) {
            const userInfoResult = await userInfoResponse.json();
            
            if (userInfoResult.success && userInfoResult.data) {
              // 更新用户信息
              const updatedUserInfo: UserInfo = {
                userID: userInfo.value.userID,
                nickname: userInfoResult.data.username || userInfoResult.data.nickname || userInfo.value.nickname,
                avatar: userInfoResult.data.avatar || userInfo.value.avatar,
                medal: {
                  uperID: 0,
                  userID: userInfo.value.userID,
                  clubName: '',
                  level: userInfoResult.data.level || userInfo.value.medal.level
                },
                managerType: userInfo.value.managerType
              };
              
              userInfo.value = updatedUserInfo;
              localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
              console.log('User info refreshed successfully:', updatedUserInfo);
            } else {
              console.warn('Failed to refresh user info:', userInfoResult.error);
            }
          } else {
            console.warn('HTTP request failed when refreshing user info');
          }
        } catch (error) {
          console.error('Error refreshing user info:', error);
        }
        
        return;
      }
      
      // 如果用户未登录，不需要做任何操作
      console.log('User not logged in, no need to refresh user info');
      
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
    handleLoginSuccess,
  };
});