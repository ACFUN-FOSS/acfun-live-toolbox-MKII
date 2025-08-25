import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
// 使用preload脚本暴露的ipcRenderer
const { ipcRenderer } = window;

import Login from '../pages/Login.vue';
import Dashboard from '../pages/Dashboard.vue';
import Home from '../pages/index.vue';
import AppView from '../pages/AppView.vue';
import LiveManagement from '../pages/LiveManagement.vue';
import Settings from '../pages/Settings.vue';
import StreamMonitor from '../pages/StreamMonitor.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: {
      title: '登录',
    },
  },
  {
    path: '/',
    name: 'dashboard',
    component: Dashboard,
    meta: {
      title: '仪表盘',
      requiresAuth: true
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
  {
    path: '/live-management',
    name: 'liveManagement',
    component: LiveManagement,
    meta: {
      title: '直播管理',
      requiresAuth: true
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: Settings,
    meta: {
      title: '系统设置',
      requiresAuth: true
    },
  },
  {
    path: '/stream-monitor',
    name: 'streamMonitor',
    component: StreamMonitor,
    meta: {
      title: '直播监控',
      requiresAuth: true
    },
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