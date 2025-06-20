import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
// 使用preload脚本暴露的ipcRenderer
const { ipcRenderer } = window;

import Home from '../pages/index.vue';
import AppView from '../pages/AppView.vue';

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

// 初始化时加载应用路由
loadAppRoutes();

export default router;