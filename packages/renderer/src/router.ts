import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    component: () => import('./pages/Home.vue')
  },
  {
    path: '/login',
    component: () => import('./pages/Login.vue')
  },
  {
    path: '/rooms',
    component: () => import('./pages/Rooms.vue')
  },
  {
    path: '/events',
    component: () => import('./pages/EventsHistory.vue')
  },
  {
    path: '/stats',
    component: () => import('./pages/Statistics.vue')
  },
  {
    path: '/api-docs',
    component: () => import('./pages/ApiDocs.vue')
  },
  {
    path: '/console',
    component: () => import('./pages/Console.vue')
  },
  {
    path: '/overlay/:overlayId',
    component: () => import('./pages/Overlay.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;