import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    component: () => import('./pages/HomePage.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/login',
    component: () => import('./pages/Login.vue'),
    meta: { title: '登录' }
  },
  // 直播功能路由
  {
    path: '/live',
    redirect: '/live/room'
  },
  {
    path: '/live/room',
    component: () => import('./pages/LiveRoomPage.vue'),
    meta: { title: '房间管理' }
  },
  {
    path: '/live/danmu',
    component: () => import('./pages/LiveDanmuPage.vue'),
    meta: { title: '弹幕管理' }
  },
  // 插件管理路由
  {
    path: '/plugins',
    redirect: '/plugins/management'
  },
  {
    path: '/plugins/management',
    component: () => import('./pages/PluginManagementPage.vue'),
    meta: { title: '插件管理' }
  },
  {
    path: '/plugins/:plugname',
    component: () => import('./pages/PluginFramePage.vue'),
    meta: { title: '插件' }
  },
  // 系统功能路由
  {
    path: '/system',
    redirect: '/system/settings'
  },
  {
    path: '/system/settings',
    component: () => import('./pages/Settings.vue'),
    meta: { title: '系统设置' }
  },
  {
    path: '/system/console',
    component: () => import('./pages/Console.vue'),
    meta: { title: '控制台' }
  },
  {
    path: '/system/develop',
    component: () => import('./pages/ApiDocs.vue'),
    meta: { title: '开发工具' }
  },
  // 其他页面
  {
    path: '/events',
    component: () => import('./pages/EventsHistory.vue'),
    meta: { title: '事件历史' }
  },
  {
    path: '/stats',
    component: () => import('./pages/Stats.vue'),
    meta: { title: '统计' }
  },
  {
    path: '/overlay/:overlayId',
    component: () => import('./pages/Overlay.vue'),
    meta: { title: 'Overlay' }
  },
  {
    path: '/error',
    component: () => import('./pages/ErrorPage.vue'),
    meta: { title: '错误' }
  },
  {
    path: '/404',
    component: () => import('./pages/NotFoundPage.vue'),
    meta: { title: '未找到' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404'
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;