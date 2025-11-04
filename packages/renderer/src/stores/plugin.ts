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
      // 开发环境保护：在纯 Vite 预览中，window.electronApi 可能不存在
      if (!window.electronApi?.plugin) {
        console.warn('[plugin] electronApi.plugin 未初始化，跳过插件加载（开发预览环境）');
        plugins.value = [];
        isLoading.value = false;
        return;
      }
      
      // 使用真实的preload API获取插件列表
      const result = await window.electronApi.plugin.list();
      
      if ('plugins' in result) {
        plugins.value = result.plugins.map((plugin: any) => ({
          ...plugin,
          installTime: new Date(plugin.installTime),
          lastUpdate: new Date(plugin.lastUpdate),
        }));
      } else if ('error' in result) {
        throw new Error(result.error || '获取插件列表失败');
      }
      
      // 获取最新插件状态
      await refreshPluginStatus();
    } catch (err) {
      console.error('Failed to load plugins:', err);
      error.value = err instanceof Error ? err.message : '加载插件列表失败';
      
      // 如果API调用失败，尝试从本地存储加载
      try {
        const savedPlugins = localStorage.getItem('installedPlugins');
        if (savedPlugins) {
          const parsed = JSON.parse(savedPlugins);
          plugins.value = parsed.map((plugin: any) => ({
            ...plugin,
            installTime: new Date(plugin.installTime),
            lastUpdate: new Date(plugin.lastUpdate),
          }));
        }
      } catch (storageErr) {
        console.error('Failed to load plugins from storage:', storageErr);
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshPluginStatus() {
    try {
      if (!window.electronApi?.plugin) {
        console.warn('[plugin] electronApi.plugin 未初始化，跳过插件状态刷新（开发预览环境）');
        return;
      }
      // 使用真实的preload API获取插件统计信息
      const statsResult = await window.electronApi.plugin.stats();
      
      if ('plugins' in statsResult) {
        // 更新插件状态
        plugins.value = plugins.value.map(plugin => {
          const updatedPlugin = (statsResult.plugins as any[]).find((p: any) => p.id === plugin.id);
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
      
      // 使用真实的preload API安装插件
      const result = await window.electronApi.plugin.install({ url: pluginUrl });
      
      if (!result.success) {
        throw new Error(result.error || '安装插件失败');
      }
      
      if (result.pluginId) {
        // 安装成功后，重新加载插件列表以获取完整的插件信息
        await loadPlugins();
        
        // 找到新安装的插件
        const newPlugin = plugins.value.find(p => p.id === result.pluginId);
        if (newPlugin) {
          console.log('Plugin installed successfully:', newPlugin.name);
          
          // 如果插件启用，注册路由
          if (newPlugin.enabled && newPlugin.routes) {
            registerPluginRoutes(newPlugin);
          }
          
          return newPlugin;
        } else {
          throw new Error('安装插件失败：未找到已安装的插件');
        }
      } else {
        throw new Error('安装插件失败：未返回插件ID');
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
      
      // 使用真实的preload API卸载插件
      const result = await window.electronApi.plugin.uninstall(pluginId);
      
      if (!result.success) {
        throw new Error(result.error || '卸载插件失败');
      }
      
      // 从列表中移除
      const index = plugins.value.findIndex(p => p.id === pluginId);
      if (index >= 0) {
        plugins.value.splice(index, 1);
      }
      
      savePluginsToStorage();
    } catch (err) {
      console.error('Failed to uninstall plugin:', err);
      throw err;
    }
  }

  async function togglePlugin(pluginId: string, enabled: boolean) {
    try {
      const plugin = getPluginById(pluginId);
      if (!plugin) return;
      
      // 使用真实的preload API启用/停用插件
      const result = enabled 
        ? await window.electronApi.plugin.enable(pluginId)
        : await window.electronApi.plugin.disable(pluginId);
      
      if (!result.success) {
        throw new Error(result.error || `${enabled ? '启用' : '停用'}插件失败`);
      }
      
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
      // 使用真实的preload API获取插件日志
      const result = await window.electronApi.plugin.logs(pluginId);
      
      if ('logs' in result) {
        // 转换日志格式以匹配期望的类型
        return (result.logs || []).map((log: any) => ({
          timestamp: log.timestamp,
          level: log.level as 'error' | 'warn' | 'info' | 'debug',
          source: log.source || 'system',
          message: log.message
        }));
      } else if ('error' in result) {
        console.error('Failed to get plugin logs:', result.error);
        return [];
      } else {
        return [];
      }
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
      // 使用现有的插件列表，过滤出活跃状态的插件
      return plugins.value.filter(p => p.status === 'active');
    } catch (err) {
      console.error('Failed to get runtime plugins:', err);
      return [];
    }
  }

  // 获取性能数据
  async function getPerformanceData() {
    try {
      // 使用真实的preload API获取插件统计信息
      const statsResult = await window.electronApi.plugin.stats();
      
      if ('stats' in statsResult && 'performance' in statsResult) {
        return statsResult.performance;
      } else {
        // 如果API不支持性能数据，返回基本信息
        return {
          cpu: 0,
          memory: 0,
          uptime: Date.now() - 3600000,
          plugins: plugins.value.map(p => ({
            id: p.id,
            cpu: 0,
            memory: 0
          }))
        };
      }
    } catch (err) {
      console.error('Failed to get performance data:', err);
      return {};
    }
  }

  // 获取事件统计
  async function getEventStats() {
    try {
      // 使用真实的preload API获取错误统计
      const errorStatsResult = await window.electronApi.plugin.errorStats();
      
      if ('stats' in errorStatsResult) {
        return errorStatsResult.stats;
      } else {
        // 如果API不支持事件统计，返回基本信息
        return {
          totalEvents: 0,
          eventsPerSecond: 0,
          errorRate: 0,
          plugins: plugins.value.map(p => ({
            id: p.id,
            events: 0,
            errors: 0
          }))
        };
      }
    } catch (err) {
      console.error('Failed to get event stats:', err);
      return {};
    }
  }

  // 获取系统日志
  async function getSystemLogs() {
    try {
      // 使用真实的preload API获取系统日志
      const result = await window.electronApi.plugin.logs(undefined, 100);
      
      if ('logs' in result) {
        // 转换日志格式以匹配期望的类型
        return (result.logs || []).map((log: any) => ({
          timestamp: log.timestamp,
          level: log.level as 'error' | 'warn' | 'info' | 'debug',
          source: log.source || 'system',
          message: log.message
        }));
      } else if ('error' in result) {
        console.error('Failed to get system logs:', result.error);
        return [];
      } else {
        return [];
      }
    } catch (err) {
      console.error('Failed to get system logs:', err);
      return [];
    }
  }

  function filterPluginsByStatus(status: PluginInfo['status']) {
    return plugins.value.filter(plugin => plugin.status === status);
  }

  // 启动所有插件
  async function startAllPlugins() {
    try {
      const results = [];
      for (const plugin of plugins.value) {
        if (plugin.status === 'inactive') {
          try {
            const result = await window.electronApi.plugin.enable(plugin.id);
            if (result.success) {
              plugin.status = 'active';
              results.push({ id: plugin.id, success: true });
            } else {
              results.push({ id: plugin.id, success: false, error: 'error' in result ? result.error : 'Unknown error' });
            }
          } catch (err) {
            results.push({ id: plugin.id, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        } else {
          results.push({ id: plugin.id, success: true, message: 'Already active' });
        }
      }
      
      await savePluginsToStorage();
      return results;
    } catch (err) {
      console.error('Failed to start all plugins:', err);
      return [];
    }
  }

  // 停止所有插件
  async function stopAllPlugins() {
    try {
      const results = [];
      for (const plugin of plugins.value) {
        if (plugin.status === 'active') {
          try {
            const result = await window.electronApi.plugin.disable(plugin.id);
            if (result.success) {
              plugin.status = 'inactive';
              results.push({ id: plugin.id, success: true });
            } else {
              results.push({ id: plugin.id, success: false, error: 'error' in result ? result.error : 'Unknown error' });
            }
          } catch (err) {
            results.push({ id: plugin.id, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        } else {
          results.push({ id: plugin.id, success: true, message: 'Already disabled' });
        }
      }
      
      await savePluginsToStorage();
      return results;
    } catch (err) {
      console.error('Failed to stop all plugins:', err);
      return [];
    }
  }

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