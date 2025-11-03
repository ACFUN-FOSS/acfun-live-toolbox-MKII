import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { registerPluginRoute, unregisterPluginRoute } from '../router/index';

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  status: 'active' | 'inactive' | 'error' | 'loading';
  enabled: boolean;
  autoStart: boolean;
  installTime: Date;
  lastUpdate: Date;
  
  // 插件配置
  config?: Record<string, any>;
  
  // 侧边栏显示配置
  sidebarDisplay?: {
    show: boolean;
    order?: number;
    group?: string;
    icon?: string;
    title?: string;
  };
  
  // 路由配置
  routes?: PluginRoute[];
  
  // Wujie配置
  wujie?: {
    url: string;
    name: string;
    width?: string;
    height?: string;
    props?: Record<string, any>;
    attrs?: Record<string, any>;
    sync?: boolean;
    alive?: boolean;
  };
  
  // 错误信息
  error?: string;
}

export interface PluginRoute {
  path: string;
  name: string;
  component?: string;
  meta?: Record<string, any>;
}

export interface PluginStats {
  total: number;
  active: number;
  inactive: number;
  error: number;
  loading: number;
}

export const usePluginStore = defineStore('plugin', () => {
  // 状态
  const plugins = ref<PluginInfo[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const installingPlugins = ref<Set<string>>(new Set());

  // 计算属性
  const activePlugins = computed(() => plugins.value.filter(p => p.status === 'active'));
  const inactivePlugins = computed(() => plugins.value.filter(p => p.status === 'inactive'));
  const errorPlugins = computed(() => plugins.value.filter(p => p.status === 'error'));
  const loadingPlugins = computed(() => plugins.value.filter(p => p.status === 'loading'));
  
  const sidebarPlugins = computed(() => 
    plugins.value
      .filter(p => p.sidebarDisplay?.show && p.status === 'active')
      .sort((a, b) => (a.sidebarDisplay?.order || 999) - (b.sidebarDisplay?.order || 999))
  );
  
  const stats = computed<PluginStats>(() => ({
    total: plugins.value.length,
    active: activePlugins.value.length,
    inactive: inactivePlugins.value.length,
    error: errorPlugins.value.length,
    loading: loadingPlugins.value.length,
  }));

  // 动作
  async function loadPlugins() {
    try {
      isLoading.value = true;
      error.value = null;
      
      // 从本地存储加载插件列表
      const savedPlugins = localStorage.getItem('installedPlugins');
      if (savedPlugins) {
        const parsed = JSON.parse(savedPlugins);
        plugins.value = parsed.map((plugin: any) => ({
          ...plugin,
          installTime: new Date(plugin.installTime),
          lastUpdate: new Date(plugin.lastUpdate),
        }));
      }
      
      // 从API获取最新插件状态
      await refreshPluginStatus();
    } catch (err) {
      console.error('Failed to load plugins:', err);
      error.value = err instanceof Error ? err.message : '加载插件列表失败';
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshPluginStatus() {
    try {
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/plugins/status');
      // const data = await response.json();
      
      // Mock数据
      const data = {
        success: true,
        plugins: plugins.value.map(plugin => ({
          ...plugin,
          status: Math.random() > 0.7 ? 'active' as const : Math.random() > 0.5 ? 'inactive' as const : 'error' as const,
          lastUpdate: new Date().toISOString()
        }))
      };
      
      if (data.success && data.plugins) {
        // 更新插件状态
        plugins.value = plugins.value.map(plugin => {
          const updatedPlugin = data.plugins.find((p: any) => p.id === plugin.id);
            if (updatedPlugin) {
              return {
              ...plugin,
              ...updatedPlugin,
              lastUpdate: new Date(),
            };
          }
          return plugin;
        });
        
        savePluginsToStorage();
      }
    } catch (err) {
      console.error('Failed to refresh plugin status:', err);
    }
  }

  async function installPlugin(pluginUrl: string) {
    try {
      installingPlugins.value.add(pluginUrl);
      
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/plugins/install', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ url: pluginUrl }),
      // });
      // const data = await response.json();
      
      // Mock数据
      const pluginId = `plugin_${Date.now()}`;
      const data = {
        success: true,
        plugin: {
          id: pluginId,
          name: `插件 ${pluginId}`,
          version: '1.0.0',
          description: '这是一个示例插件',
          author: '示例作者',
          status: 'inactive' as 'error' | 'loading' | 'active' | 'inactive',
          enabled: false,
          autoStart: false,
          installTime: new Date(),
          lastUpdate: new Date(),
          config: {},
          sidebarDisplay: {
             show: true,
             title: `插件 ${pluginId}`,
             icon: 'plugin',
             order: 0
           }
        },
        message: ''
      };
      
      if (data.success && data.plugin) {
        const newPlugin: PluginInfo = {
          ...data.plugin,
          installTime: new Date(),
          lastUpdate: new Date(),
        };
        
        // 检查是否已存在
        const existingIndex = plugins.value.findIndex(p => p.id === newPlugin.id);
        if (existingIndex >= 0) {
          plugins.value[existingIndex] = newPlugin;
        } else {
          plugins.value.push(newPlugin);
        }
        
        savePluginsToStorage();
        
        // 如果插件启用，注册路由
        if (newPlugin.enabled && newPlugin.routes) {
          registerPluginRoutes(newPlugin);
        }
        
        return newPlugin;
      } else {
        throw new Error(data.message || '安装插件失败');
      }
    } catch (err) {
      console.error('Failed to install plugin:', err);
      throw err;
    } finally {
      installingPlugins.value.delete(pluginUrl);
    }
  }

  // 从URL安装插件的别名方法
  async function installPluginFromUrl(url: string) {
    return installPlugin(url);
  }

  // 从商店安装插件的方法
  async function installPluginFromStore(pluginId: string) {
    try {
      installingPlugins.value.add(pluginId);
      
      const response = await fetch(`/api/plugins/store/${pluginId}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success && data.plugin) {
        const newPlugin: PluginInfo = {
          ...data.plugin,
          installTime: new Date(),
          lastUpdate: new Date(),
        };
        
        // 检查是否已存在
        const existingIndex = plugins.value.findIndex(p => p.id === newPlugin.id);
        if (existingIndex >= 0) {
          plugins.value[existingIndex] = newPlugin;
        } else {
          plugins.value.push(newPlugin);
        }
        
        savePluginsToStorage();
        
        // 如果插件启用，注册路由
        if (newPlugin.enabled && newPlugin.routes) {
          registerPluginRoutes(newPlugin);
        }
        
        return newPlugin;
      } else {
        throw new Error(data.message || '从商店安装插件失败');
      }
    } catch (err) {
      console.error('Failed to install plugin from store:', err);
      throw err;
    } finally {
      installingPlugins.value.delete(pluginId);
    }
  }

  // 刷新插件状态的别名方法
  async function refreshPlugins() {
    return refreshPluginStatus();
  }

  // 重新加载插件的方法
  async function reloadPlugin(pluginId: string) {
    try {
      const plugin = getPluginById(pluginId);
      if (!plugin) {
        throw new Error('插件不存在');
      }

      // 先停用插件
      if (plugin.enabled) {
        await togglePlugin(pluginId, false);
      }

      // 重新加载插件信息
      await refreshPluginStatus();

      // 如果之前是启用状态，重新启用
      if (plugin.enabled) {
        await togglePlugin(pluginId, true);
      }
    } catch (err) {
      console.error('Failed to reload plugin:', err);
      throw err;
    }
  }

  async function uninstallPlugin(pluginId: string) {
    try {
      const plugin = getPluginById(pluginId);
      if (!plugin) return;
      
      // 先停用插件
      if (plugin.enabled) {
        await togglePlugin(pluginId, false);
      }
      
      const response = await fetch(`/api/plugins/${pluginId}/uninstall`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 从列表中移除
        const index = plugins.value.findIndex(p => p.id === pluginId);
        if (index >= 0) {
          plugins.value.splice(index, 1);
        }
        
        savePluginsToStorage();
      } else {
        throw new Error(data.message || '卸载插件失败');
      }
    } catch (err) {
      console.error('Failed to uninstall plugin:', err);
      throw err;
    }
  }

  async function togglePlugin(pluginId: string, enabled: boolean) {
    try {
      const plugin = getPluginById(pluginId);
      if (!plugin) return;
      
      const response = await fetch(`/api/plugins/${pluginId}/${enabled ? 'enable' : 'disable'}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 更新插件状态
        plugin.enabled = enabled;
        plugin.status = enabled ? 'active' : 'inactive';
        plugin.lastUpdate = new Date();
        
        // 处理路由注册/注销
        if (enabled && plugin.routes) {
          registerPluginRoutes(plugin);
        } else if (!enabled && plugin.routes) {
          unregisterPluginRoutes(plugin);
        }
        
        savePluginsToStorage();
      } else {
        throw new Error(data.message || `${enabled ? '启用' : '停用'}插件失败`);
      }
    } catch (err) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} plugin:`, err);
      throw err;
    }
  }

  function updatePluginConfig(pluginId: string, config: Record<string, any>) {
    const plugin = getPluginById(pluginId);
    if (plugin) {
      plugin.config = { ...plugin.config, ...config };
      plugin.lastUpdate = new Date();
      savePluginsToStorage();
    }
  }

  function updatePluginSidebarDisplay(pluginId: string, sidebarDisplay: PluginInfo['sidebarDisplay']) {
    const plugin = getPluginById(pluginId);
    if (plugin) {
      plugin.sidebarDisplay = sidebarDisplay;
      plugin.lastUpdate = new Date();
      savePluginsToStorage();
    }
  }

  function getPluginById(pluginId: string): PluginInfo | undefined {
    return plugins.value.find(p => p.id === pluginId);
  }

  function savePluginsToStorage() {
    try {
      localStorage.setItem('installedPlugins', JSON.stringify(plugins.value));
    } catch (err) {
      console.error('Failed to save plugins to storage:', err);
    }
  }

  // 路由管理
  function registerPluginRoutes(plugin: PluginInfo) {
    if (!plugin.routes) return;
    
    plugin.routes.forEach(route => {
      const routeRecord: any = {
        path: route.path,
        name: route.name,
        meta: route.meta,
      };
      
      if (route.component) {
        routeRecord.component = () => import(/* @vite-ignore */ route.component!);
      }
      
      registerPluginRoute(plugin.id, routeRecord);
    });
  }

  function unregisterPluginRoutes(plugin: PluginInfo) {
    if (!plugin.routes) return;
    
    plugin.routes.forEach(_route => {
      unregisterPluginRoute(plugin.id);
    });
  }

  // 插件搜索和过滤
  function searchPlugins(query: string) {
    const lowerQuery = query.toLowerCase();
    return plugins.value.filter(plugin => 
      plugin.name.toLowerCase().includes(lowerQuery) ||
      plugin.description?.toLowerCase().includes(lowerQuery) ||
      plugin.author?.toLowerCase().includes(lowerQuery) ||
      plugin.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))
    );
  }

  // 获取插件日志
  async function getPluginLogs(pluginId: string) {
    try {
      const response = await fetch(`/api/plugins/${pluginId}/logs`);
      const data = await response.json();
      return data.logs || [];
    } catch (err) {
      console.error('Failed to get plugin logs:', err);
      return [];
    }
  }

  // 切换调试模式
  async function toggleDebugMode(pluginId: string) {
    try {
      const plugin = getPluginById(pluginId);
      if (!plugin) {
        throw new Error('插件不存在');
      }

      const response = await fetch(`/api/plugins/${pluginId}/debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !plugin.config?.debug }),
      });

      const data = await response.json();
      if (data.success) {
        // 更新插件配置
        if (plugin.config) {
          plugin.config.debug = !plugin.config.debug;
        } else {
          plugin.config = { debug: true };
        }
        savePluginsToStorage();
      }
    } catch (err) {
      console.error('Failed to toggle debug mode:', err);
      throw err;
    }
  }

  // 强制停止插件
  async function killPlugin(pluginId: string) {
    try {
      const response = await fetch(`/api/plugins/${pluginId}/kill`, {
        method: 'POST',
      });

      const data = await response.json();
      if (data.success) {
        const plugin = getPluginById(pluginId);
        if (plugin) {
          plugin.status = 'inactive';
          plugin.enabled = false;
          savePluginsToStorage();
        }
      }
    } catch (err) {
      console.error('Failed to kill plugin:', err);
      throw err;
    }
  }

  // 启动插件
  async function startPlugin(pluginId: string) {
    try {
      const response = await fetch(`/api/plugins/${pluginId}/start`, {
        method: 'POST',
      });

      const data = await response.json();
      if (data.success) {
        const plugin = getPluginById(pluginId);
        if (plugin) {
          plugin.status = 'active';
          plugin.enabled = true;
          savePluginsToStorage();
        }
      }
    } catch (err) {
      console.error('Failed to start plugin:', err);
      throw err;
    }
  }

  // 停止插件
  async function stopPlugin(pluginId: string) {
    try {
      const response = await fetch(`/api/plugins/${pluginId}/stop`, {
        method: 'POST',
      });

      const data = await response.json();
      if (data.success) {
        const plugin = getPluginById(pluginId);
        if (plugin) {
          plugin.status = 'inactive';
          plugin.enabled = false;
          savePluginsToStorage();
        }
      }
    } catch (err) {
      console.error('Failed to stop plugin:', err);
      throw err;
    }
  }

  // 重启插件
  async function restartPlugin(pluginId: string) {
    try {
      await stopPlugin(pluginId);
      await startPlugin(pluginId);
    } catch (err) {
      console.error('Failed to restart plugin:', err);
      throw err;
    }
  }

  // 获取运行时插件列表
  async function getRuntimePlugins() {
    try {
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/plugins/runtime');
      // const data = await response.json();
      // return data.plugins || [];
      
      // Mock数据
      return plugins.value.filter(p => p.status === 'active');
    } catch (err) {
      console.error('Failed to get runtime plugins:', err);
      return [];
    }
  }

  // 获取性能数据
  async function getPerformanceData() {
    try {
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/plugins/performance');
      // const data = await response.json();
      // return data.performance || {};
      
      // Mock数据
      return {
        cpu: Math.random() * 100,
        memory: Math.random() * 1024,
        uptime: Date.now() - 3600000,
        plugins: plugins.value.map(p => ({
          id: p.id,
          cpu: Math.random() * 10,
          memory: Math.random() * 100
        }))
      };
    } catch (err) {
      console.error('Failed to get performance data:', err);
      return {};
    }
  }

  // 获取事件统计
  async function getEventStats() {
    try {
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/plugins/events/stats');
      // const data = await response.json();
      // return data.stats || {};
      
      // Mock数据
      return {
        totalEvents: Math.floor(Math.random() * 10000),
        eventsPerSecond: Math.random() * 100,
        errorRate: Math.random() * 0.1,
        plugins: plugins.value.map(p => ({
          id: p.id,
          events: Math.floor(Math.random() * 1000),
          errors: Math.floor(Math.random() * 10)
        }))
      };
    } catch (err) {
      console.error('Failed to get event stats:', err);
      return {};
    }
  }

  // 获取系统日志
  async function getSystemLogs() {
    try {
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/system/logs');
      // const data = await response.json();
      // return data.logs || [];
      
      // Mock数据
      return [
        {
          timestamp: Date.now(),
          level: 'info' as const,
          message: '系统启动完成',
          source: 'system'
        },
        {
          timestamp: Date.now() - 60000,
          level: 'warn' as const,
          message: '插件加载警告',
          source: 'plugin'
        }
      ];
    } catch (err) {
      console.error('Failed to get system logs:', err);
      return [];
    }
  }

  function filterPluginsByStatus(status: PluginInfo['status']) {
    return plugins.value.filter(plugin => plugin.status === status);
  }

  // 启动所有插件
  const startAllPlugins = async () => {
    try {
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/plugins/start-all', {
      //   method: 'POST'
      // });
      // if (!response.ok) {
      //   throw new Error(`启动所有插件失败: ${response.statusText}`);
      // }
      
      // Mock数据 - 启动所有插件
      plugins.value.forEach(plugin => {
        if (plugin.status === 'inactive') {
          plugin.status = 'active';
          plugin.enabled = true;
        }
      });
      savePluginsToStorage();
      
      await refreshPluginStatus();
    } catch (error) {
      console.error('启动所有插件失败:', error);
      throw error;
    }
  };

  // 停止所有插件
  const stopAllPlugins = async () => {
    try {
      // TODO: 未实现 - 使用mock数据
      // const response = await fetch('/api/plugins/stop-all', {
      //   method: 'POST'
      // });
      // if (!response.ok) {
      //   throw new Error(`停止所有插件失败: ${response.statusText}`);
      // }
      
      // Mock数据 - 停止所有插件
      plugins.value.forEach(plugin => {
        if (plugin.status === 'active') {
          plugin.status = 'inactive';
          plugin.enabled = false;
        }
      });
      savePluginsToStorage();
      
      await refreshPluginStatus();
    } catch (error) {
      console.error('停止所有插件失败:', error);
      throw error;
    }
  };

  // 初始化
  loadPlugins();

  return {
    // 状态
    plugins,
    isLoading,
    error,
    installingPlugins,
    
    // 计算属性
    activePlugins,
    inactivePlugins,
    errorPlugins,
    loadingPlugins,
    sidebarPlugins,
    stats,
    
    // 动作
    loadPlugins,
    refreshPluginStatus,
    refreshPlugins,
    installPlugin,
    installPluginFromUrl,
    installPluginFromStore,
    uninstallPlugin,
    reloadPlugin,
    togglePlugin,
    updatePluginConfig,
    updatePluginSidebarDisplay,
    getPluginById,
    getPluginLogs,
    toggleDebugMode,
    killPlugin,
    startPlugin,
    stopPlugin,
    restartPlugin,
    getRuntimePlugins,
    getPerformanceData,
    getEventStats,
    getSystemLogs,
    searchPlugins,
    filterPluginsByStatus,
    startAllPlugins,
    stopAllPlugins,
  };
});