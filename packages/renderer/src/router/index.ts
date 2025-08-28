import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import Login from '../views/Login.vue';
import Dashboard from '../views/Dashboard.vue';
import { ipcRenderer } from 'electron';
import Home from '../pages/index.vue';
import AppView from '../pages/AppView.vue';
import LiveManagement from '../pages/LiveManagement.vue';
import Settings from '../pages/Settings.vue';
import StreamMonitor from '../pages/StreamMonitor.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: {
      requiresAuth: false
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

// 动态加载应用路由
const loadAppRoutes = async () => {
  try {
    const response = await window.api.app.getInstalledApps();
    if (response.success) {
      response.data.forEach(app => {
        if (app.supportedDisplays && app.supportedDisplays.includes('main')) {
          // 检查路由是否已存在
          const routeExists = router.hasRoute(`app-${app.id}`);
          if (!routeExists) {
            router.addRoute({
              path: `/app/${app.id}`,
              name: `app-${app.id}`,
              component: AppView,
              meta: {
                title: app.name || '应用视图',
              },
              props: { appId: app.id }
            });
          }
        }
      });
    }
  } catch (error) {
    console.error('Failed to load app routes:', error);
  }
};

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// 路由守卫
router.beforeEach(async (to, from, next) => {
  // 检查是否需要认证
  if (to.meta.requiresAuth) {
    try {
      // 获取存储的会话令牌
      const sessionStr = localStorage.getItem('session') || sessionStorage.getItem('session');
      if (!sessionStr) {
        next('/login');
        return;
      }

      const session = JSON.parse(sessionStr);
      // 检查会话状态
      const authStatus = await ipcRenderer.invoke('checkAuthStatus', session.token);
      if (authStatus.success && authStatus.status) {
        // 会话有效，继续访问
        next();
      } else {
        // 会话无效，重定向到登录页
        localStorage.removeItem('session');
        sessionStorage.removeItem('session');
        next('/login');
      }
    } catch (error) {
      console.error('路由守卫错误:', error);
      next('/login');
    }
  } else {
    // 不需要认证的页面
    next();
  }
});

// 路由守卫
router.beforeEach((to, from, next) => {
  // 检查页面是否需要认证
  if (to.meta.requiresAuth) {
    // 模拟检查登录状态
    const isLoggedIn = !!window.sessionStorage.getItem('token');
    if (isLoggedIn) {
      next();
    } else {
      // 未登录，重定向到登录页
      next({ name: 'login' });
    }
  } else {
    next();
  }
});

// 初始化时加载应用路由
loadAppRoutes();

export default router;