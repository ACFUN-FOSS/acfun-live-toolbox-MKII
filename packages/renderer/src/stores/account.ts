import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserInfo } from 'acfunlive-http-api';

// 渲染层最小账户信息结构，去除无用字段（medal、managerType等）
export interface AccountProfile {
  userID: number;
  nickname: string;
  avatar: string;
}

// 不再进行多字段归一，仅使用后端返回的 userName 字段

// 完整用户信息类型改为使用 acfunlive-http-api 的 UserInfo 导出

// 清洗头像URL：去除首尾反引号/空白，防止CSP和URL解析异常
function sanitizeAvatarUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  // 移除所有引号/反引号，并裁剪空白
  let cleaned = String(url).trim().replace(/[`'\"]/g, '');
  if (!/^https?:\/\//i.test(cleaned)) return '';
  return cleaned;
}

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
  const userInfo = ref<AccountProfile | null>(null);
  const fullUserInfo = ref<UserInfo | null>(null);
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
        // 兼容旧缓存结构，统一为最小Profile并进行清洗
        const profile: AccountProfile = {
          userID: Number(parsed.userID) || Number(parsed.userId) || 0,
          nickname: typeof parsed.userName === 'string' && parsed.userName.trim().length > 0
            ? parsed.userName.trim()
            : (typeof parsed.nickname === 'string' && parsed.nickname.trim().length > 0
                ? parsed.nickname.trim()
                : `用户${String(parsed.userID || parsed.userId || '')}`),
          avatar: sanitizeAvatarUrl(parsed.avatar)
        };
        userInfo.value = profile.userID ? profile : null;
        loginState.value.isLoggedIn = !!profile.userID;
      }

      // 启动时始终向主进程请求用户信息，若未认证或过期则回退未登录
      try {
        const result = await window.electronApi.account.getUserInfo();
        if ('success' in result && result.success && result.data) {
          // 统一完整用户信息（将 userName 映射为 UserInfo.username）
          const full: UserInfo = {
            ...(result.data as any),
            username: typeof (result.data as any).userName === 'string' && (result.data as any).userName.trim().length > 0
              ? (result.data as any).userName.trim()
              : (result.data as any).username
          } as UserInfo;
          const updated: AccountProfile = {
            userID: Number(result.data.userId),
            nickname: typeof result.data.userName === 'string' && result.data.userName.trim().length > 0
              ? result.data.userName.trim()
              : `用户${String(result.data.userId)}`,
            avatar: typeof result.data.avatar === 'string' ? result.data.avatar : ''
          };
          userInfo.value = updated;
          fullUserInfo.value = full;
          loginState.value.isLoggedIn = true;
          localStorage.setItem('userInfo', JSON.stringify(updated));
          console.log('Startup auth verified via main, user info:', updated);
          console.log('Startup full user info (normalized):', fullUserInfo.value);
        } else {
          const errMsg = 'error' in result ? result.error : 'unknown_error';
          console.warn('Startup auth check failed:', errMsg);
          // 主进程未保存token或token过期：回退到未登录并清理本地
          userInfo.value = null;
          fullUserInfo.value = null;
          loginState.value.isLoggedIn = false;
          localStorage.removeItem('userInfo');
        }
      } catch (error) {
        console.warn('Startup auth check error:', error);
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
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
        // 不再自动开始轮询，由 HomePage.vue 控制轮询过程
      } else {
        throw new Error('获取登录二维码失败');
      }
    } catch (error) {
      console.error('Failed to start login:', error);
      loginState.value.loginError = error instanceof Error ? error.message : '登录失败';
      loginState.value.isLogging = false;
    }
  }

  // 轮询逻辑由页面层控制（HomePage.vue），此处不再定义未使用的轮询函数

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
      fullUserInfo.value = null;
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
      // 先立即关闭登录对话框，缩短响应时间
      loginState.value.isLogging = false;
      loginState.value.qrCode = undefined;
      loginState.value.loginError = undefined;

      // 每次登录向主进程请求用户信息；若主进程未保存token或已过期则报错并回退未登录
      const result = await window.electronApi.account.getUserInfo();
      if (!('success' in result) || result.success !== true || !result.data) {
        const errMsg = 'error' in result ? result.error : 'unknown_error';
        console.error('Failed to get user info from main:', errMsg);
        // 回退到未登录状态
        userInfo.value = null;
        loginState.value.isLoggedIn = false;
        loginState.value.loginError = `登录处理失败: ${errMsg}`;
        localStorage.removeItem('userInfo');
        return;
      }

      // 使用主进程返回的完整用户信息，提取最小展示所需字段
      const full: UserInfo = {
        ...(result.data as any),
        username: typeof (result.data as any).userName === 'string' && (result.data as any).userName.trim().length > 0
          ? (result.data as any).userName.trim()
          : (result.data as any).username
      } as UserInfo;
      const profile: AccountProfile = {
        userID: Number(result.data.userId),
        nickname: typeof result.data.userName === 'string' && result.data.userName.trim().length > 0
          ? result.data.userName.trim()
          : `用户${String(result.data.userId)}`,
        // 主进程已完成头像URL清洗，这里不再二次清洗
        avatar: typeof result.data.avatar === 'string' ? result.data.avatar : ''
      };
      userInfo.value = profile;
      fullUserInfo.value = full;
      
      // 设置登录状态
      loginState.value.isLoggedIn = true;
      
      // 保存到本地存储
      localStorage.setItem('userInfo', JSON.stringify(userInfo.value));

      console.log('Login completed with user info:', userInfo.value);
      console.log('Login completed with full user info:', fullUserInfo.value);
    } catch (error) {
      console.error('Failed to handle login success:', error);
      loginState.value.loginError = `登录处理失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async function refreshUserInfo() {
    try {
      // 如果用户已经登录，刷新用户信息
      if (loginState.value.isLoggedIn && userInfo.value?.userID) {
        console.log('Refreshing user info for logged in user:', userInfo.value.userID);
        
        try {
          const result = await window.electronApi.account.getUserInfo();
          if ('success' in result && result.success && result.data) {
            const full: UserInfo = {
              ...(result.data as any),
              username: typeof (result.data as any).userName === 'string' && (result.data as any).userName.trim().length > 0
                ? (result.data as any).userName.trim()
                : (result.data as any).username
            } as UserInfo;
            const updated: AccountProfile = {
              userID: Number(result.data.userId),
              nickname: typeof result.data.userName === 'string' && result.data.userName.trim().length > 0
                ? result.data.userName.trim()
                : `用户${String(result.data.userId)}`,
              avatar: (typeof result.data.avatar === 'string' ? result.data.avatar : '') || userInfo.value.avatar
            };
            userInfo.value = updated;
            fullUserInfo.value = full;
            localStorage.setItem('userInfo', JSON.stringify(updated));
            console.log('User info refreshed successfully:', updated);
            console.log('Full user info refreshed successfully:', fullUserInfo.value);
          } else {
            const errMsg = 'error' in result ? result.error : 'unknown_error';
            console.warn('Failed to refresh user info:', errMsg);
            if (errMsg === 'not_authenticated' || errMsg === 'Token expired') {
              // 主进程未认证或过期，回退到未登录
              userInfo.value = null;
              loginState.value.isLoggedIn = false;
              localStorage.removeItem('userInfo');
            }
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
    fullUserInfo,
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