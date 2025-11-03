import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

// 导入布局组件
const LayoutShell = () => import('../layouts/LayoutShell.vue');

// 导入页面组件
const HomePage = () => import('../pages/HomePage.vue');
const LivePage = () => import('../pages/LivePage.vue');
const LiveRoomPage = () => import('../pages/LiveRoomPage.vue');
const LiveDanmuPage = () => import('../pages/LiveDanmuPage.vue');
const PluginsPage = () => import('../pages/PluginsPage.vue');
const PluginManagementPage = () => import('../pages/PluginManagementPage.vue');
const PluginFramePage = () => import('../pages/PluginFramePage.vue');
const SystemPage = () => import('../pages/SystemPage.vue');
const Settings = () => import('../pages/Settings.vue');
const Console = () => import('../pages/Console.vue');
const ApiDocs = () => import('../pages/ApiDocs.vue');
const ErrorPage = () => import('../pages/ErrorPage.vue');
const NotFoundPage = () => import('../pages/NotFoundPage.vue');

// 定义路由配置，匹配ui2.json中的routes_tree结构
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/',
    component: LayoutShell,
    children: [
      {
        path: 'home',
        name: 'Home',
        component: HomePage,
        meta: {
          title: '首页',
          icon: 'home',
          showInSidebar: true
        }
      },
      {
        path: 'live',
        name: 'Live',
        component: LivePage,
        meta: {
          title: '直播',
          icon: 'video',
          showInSidebar: true
        },
        children: [
          {
            path: 'room',
            name: 'LiveRoom',
            component: LiveRoomPage,
            meta: {
              title: '房间管理',
              parent: 'Live'
            }
          },
          {
            path: 'danmu',
            name: 'LiveDanmu',
            component: LiveDanmuPage,
            meta: {
              title: '弹幕设置',
              parent: 'Live'
            }
          }
        ]
      },
      {
        path: 'plugins',
        name: 'Plugins',
        component: PluginsPage,
        meta: {
          title: '插件',
          icon: 'app',
          showInSidebar: true
        },
        children: [
          {
            path: 'management',
            name: 'PluginManagement',
            component: PluginManagementPage,
            meta: {
              title: '插件管理',
              parent: 'Plugins'
            }
          },
          {
            path: 'frame',
            name: 'PluginFrame',
            component: PluginFramePage,
            meta: {
              title: '插件框架',
              parent: 'Plugins'
            }
          }
        ]
      },
      {
        path: 'system',
        name: 'System',
        component: SystemPage,
        meta: {
          title: '系统',
          icon: 'setting',
          showInSidebar: true
        },
        children: [
          {
            path: 'settings',
            name: 'Settings',
            component: Settings,
            meta: {
              title: '设置',
              parent: 'System'
            }
          },
          {
            path: 'console',
            name: 'Console',
            component: Console,
            meta: {
              title: '控制台',
              parent: 'System'
            }
          },
          {
            path: 'develop',
            name: 'SystemDevelop',
            component: ApiDocs,
            meta: {
              title: '开发文档',
              parent: 'System'
            }
          }
        ]
      },
      {
        path: 'error',
        name: 'Error',
        component: ErrorPage,
        meta: {
          title: '错误页面',
          hideInSidebar: true
        }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFoundPage,
    meta: {
      title: '页面未找到',
      hideInSidebar: true
    }
  }
];

// 动态插件路由注册
const dynamicPluginRoutes = new Map<string, RouteRecordRaw>();

export function registerPluginRoute(pluginId: string, route: RouteRecordRaw) {
  dynamicPluginRoutes.set(pluginId, route);
  router.addRoute('Plugins', route);
}

export function unregisterPluginRoute(pluginId: string) {
  const route = dynamicPluginRoutes.get(pluginId);
  if (route && route.name) {
    router.removeRoute(route.name);
    dynamicPluginRoutes.delete(pluginId);
  }
}

export function getRegisteredPluginRoutes() {
  return Array.from(dynamicPluginRoutes.values());
}

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - ACLiveFrame`;
  }
  
  next();
});

export default router;