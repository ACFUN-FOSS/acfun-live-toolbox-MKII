import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import Home from '../pages/index.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: Home,
    meta: {
      title: '首页',
    },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;