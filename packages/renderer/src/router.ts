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
  }
  ,
  {
    path: '/events',
    component: () => import('./pages/EventsHistory.vue')
  }
  ,
  {
    path: '/stats',
    component: () => import('./pages/Statistics.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;