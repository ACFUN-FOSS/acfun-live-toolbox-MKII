import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

// 导入组件
import Home from '../pages/index.vue';
import AppView from '../pages/AppView.vue';
import Dashboard from '../pages/Dashboard.vue';
import Login from '../pages/Login.vue';
import PasswordLogin from '../pages/PasswordLogin.vue';

// 导航守卫：检查用户是否登录
const checkAuth = async (to: any) => {
  // 登录页不需要验证
  if (to.name === 'login') {
    return true;
  }

  // 检查用户是否已登录
  const result = await window.api.auth.getUserInfo();
  if (result.success && result.data) {
    // 已登录，访问首页时重定向到仪表盘
    if (to.name === 'home') {
      return { name: 'dashboard' };
    }
    return true;
  } else {
    // 未登录，重定向到登录页
    return { name: 'login' };
  }
};

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: Home,
    meta: {
      title: '首页',
    },
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: {
      title: '扫码登录',
    },
  },
  {
    path: '/login/password',
    name: 'password-login',
    component: PasswordLogin,
    meta: {
      title: '账号密码登录',
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard,
    meta: {
      title: '仪表盘',
    },
  },
  {
    path: '/app/:appId',
    name: 'app-view',
    component: AppView,
    meta: {
      title: '应用视图',
    },
    props: true
  },
];

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
  routes,
});

// 添加导航守卫
router.beforeEach(async (to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title || 'ACFUN直播工具箱';

  // 检查登录状态
  const authResult = await checkAuth(to);
  if (authResult === true) {
    next();
  } else {
    next(authResult);
  }
});

// 初始化时加载应用路由
loadAppRoutes();

export default router;