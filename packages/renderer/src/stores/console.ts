import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ConsoleCommand {
  name: string;
  description: string;
  usage: string;
  category: 'system' | 'room' | 'plugin' | 'debug';
}

export interface ConsoleResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface ConsoleSession {
  id: string;
  userId?: string;
  startTime: number;
  lastActivity: number;
  source: 'local' | 'remote';
  commands: ConsoleCommandHistory[];
}

export interface ConsoleCommandHistory {
  command: string;
  args: string[];
  timestamp: number;
  result: ConsoleResult;
  executionTime: number;
}

export const useConsoleStore = defineStore('console', () => {
  // 状态
  const isConnected = ref(false);
  const currentSession = ref<ConsoleSession | null>(null);
  const availableCommands = ref<ConsoleCommand[]>([]);
  const commandHistory = ref<ConsoleCommandHistory[]>([]);
  const isExecuting = ref(false);

  // 事件监听器
  const commandExecutedListeners = ref<((result: ConsoleResult) => void)[]>([]);

  /**
   * 创建控制台会话
   */
  async function createSession(): Promise<string> {
    try {
      const response = await window.electronApi.console.createSession({
        source: 'local'
      });

      if (response.success) {
        currentSession.value = response.data;
        isConnected.value = true;
        await loadAvailableCommands();
        return response.data.id;
      } else {
        throw new Error(response.error || 'Failed to create session');
      }
    } catch (error) {
      console.error('Failed to create console session:', error);
      throw error;
    }
  }

  /**
   * 结束控制台会话
   */
  async function endSession(): Promise<void> {
    if (!currentSession.value) {
      return;
    }

    try {
      await window.electronApi.console.endSession({
        sessionId: currentSession.value.id
      });

      currentSession.value = null;
      isConnected.value = false;
      commandHistory.value = [];
    } catch (error) {
      console.error('Failed to end console session:', error);
    }
  }

  /**
   * 执行命令
   */
  async function executeCommand(commandLine: string): Promise<ConsoleResult> {
    if (!currentSession.value) {
      throw new Error('No active console session');
    }

    isExecuting.value = true;

    try {
      const response = await window.electronApi.console.executeCommand({
        sessionId: currentSession.value.id,
        commandLine
      });

      if (response.success) {
        const result = response.data;
        
        // 更新命令历史
        const historyEntry: ConsoleCommandHistory = {
          command: commandLine.split(' ')[0],
          args: commandLine.split(' ').slice(1),
          timestamp: Date.now(),
          result,
          executionTime: 0 // 这个会在后端计算
        };
        
        commandHistory.value.push(historyEntry);
        
        // 限制历史记录数量
        if (commandHistory.value.length > 100) {
          commandHistory.value.shift();
        }

        // 通知监听器
        commandExecutedListeners.value.forEach(listener => {
          listener(result);
        });

        return result;
      } else {
        throw new Error(response.error || 'Command execution failed');
      }
    } catch (error) {
      const errorResult: ConsoleResult = {
        success: false,
        message: 'Command execution failed',
        error: error instanceof Error ? error.message : String(error)
      };

      // 通知监听器
      commandExecutedListeners.value.forEach(listener => {
        listener(errorResult);
      });

      throw error;
    } finally {
      isExecuting.value = false;
    }
  }

  /**
   * 加载可用命令列表
   */
  async function loadAvailableCommands(): Promise<ConsoleCommand[]> {
    try {
      const response = await window.electronApi.console.getCommands();

      if (response.success) {
        availableCommands.value = response.data;
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to load commands');
      }
    } catch (error) {
      console.error('Failed to load available commands:', error);
      return [];
    }
  }

  /**
   * 获取可用命令列表
   */
  function getAvailableCommands(): ConsoleCommand[] {
    return availableCommands.value;
  }

  /**
   * 获取命令历史
   */
  function getCommandHistory(): ConsoleCommandHistory[] {
    return commandHistory.value;
  }

  /**
   * 清空命令历史
   */
  function clearCommandHistory(): void {
    commandHistory.value = [];
  }

  /**
   * 获取会话信息
   */
  async function getSessionInfo(): Promise<ConsoleSession | null> {
    if (!currentSession.value) {
      return null;
    }

    try {
      const response = await window.electronApi.console.getSession({
        sessionId: currentSession.value.id
      });

      if (response.success) {
        currentSession.value = response.data;
        return response.data;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Failed to get session info:', error);
      return null;
    }
  }

  /**
   * 搜索命令
   */
  function searchCommands(query: string): ConsoleCommand[] {
    if (!query.trim()) {
      return availableCommands.value;
    }

    const lowerQuery = query.toLowerCase();
    return availableCommands.value.filter(cmd => 
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 获取命令详情
   */
  function getCommandDetails(commandName: string): ConsoleCommand | null {
    return availableCommands.value.find(cmd => cmd.name === commandName) || null;
  }

  /**
   * 监听命令执行完成事件
   */
  function onCommandExecuted(listener: (result: ConsoleResult) => void): () => void {
    commandExecutedListeners.value.push(listener);
    
    // 返回取消监听的函数
    return () => {
      const index = commandExecutedListeners.value.indexOf(listener);
      if (index > -1) {
        commandExecutedListeners.value.splice(index, 1);
      }
    };
  }

  /**
   * 获取系统状态
   */
  async function getSystemStatus(): Promise<any> {
    try {
      const result = await executeCommand('status');
      return result.data;
    } catch (error) {
      console.error('Failed to get system status:', error);
      return null;
    }
  }

  /**
   * 获取插件列表
   */
  async function getPluginList(): Promise<any[]> {
    try {
      const result = await executeCommand('plugins list');
      return result.data || [];
    } catch (error) {
      console.error('Failed to get plugin list:', error);
      return [];
    }
  }

  /**
   * 获取房间列表
   */
  async function getRoomList(): Promise<any[]> {
    try {
      const result = await executeCommand('rooms list');
      return result.data || [];
    } catch (error) {
      console.error('Failed to get room list:', error);
      return [];
    }
  }

  /**
   * 启用插件
   */
  async function enablePlugin(pluginId: string): Promise<boolean> {
    try {
      const result = await executeCommand(`plugins enable ${pluginId}`);
      return result.success;
    } catch (error) {
      console.error('Failed to enable plugin:', error);
      return false;
    }
  }

  /**
   * 禁用插件
   */
  async function disablePlugin(pluginId: string): Promise<boolean> {
    try {
      const result = await executeCommand(`plugins disable ${pluginId}`);
      return result.success;
    } catch (error) {
      console.error('Failed to disable plugin:', error);
      return false;
    }
  }

  /**
   * 连接房间
   */
  async function connectRoom(roomId: string): Promise<boolean> {
    try {
      const result = await executeCommand(`rooms connect ${roomId}`);
      return result.success;
    } catch (error) {
      console.error('Failed to connect room:', error);
      return false;
    }
  }

  /**
   * 断开房间连接
   */
  async function disconnectRoom(roomId: string): Promise<boolean> {
    try {
      const result = await executeCommand(`rooms disconnect ${roomId}`);
      return result.success;
    } catch (error) {
      console.error('Failed to disconnect room:', error);
      return false;
    }
  }

  /**
   * 获取配置
   */
  async function getConfig(key?: string): Promise<any> {
    try {
      const command = key ? `config get ${key}` : 'config list';
      const result = await executeCommand(command);
      return result.data;
    } catch (error) {
      console.error('Failed to get config:', error);
      return null;
    }
  }

  /**
   * 设置配置
   */
  async function setConfig(key: string, value: any): Promise<boolean> {
    try {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      const result = await executeCommand(`config set ${key} ${valueStr}`);
      return result.success;
    } catch (error) {
      console.error('Failed to set config:', error);
      return false;
    }
  }

  /**
   * 获取日志
   */
  async function getLogs(pluginId?: string, limit?: number): Promise<any[]> {
    try {
      let command = 'logs';
      if (pluginId) command += ` ${pluginId}`;
      if (limit) command += ` ${limit}`;
      
      const result = await executeCommand(command);
      return result.data || [];
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  /**
   * 清理资源
   */
  async function cleanup(): Promise<void> {
    await endSession();
    commandExecutedListeners.value = [];
    availableCommands.value = [];
    commandHistory.value = [];
  }

  return {
    // 状态
    isConnected,
    currentSession,
    availableCommands,
    commandHistory,
    isExecuting,

    // 方法
    createSession,
    endSession,
    executeCommand,
    loadAvailableCommands,
    getAvailableCommands,
    getCommandHistory,
    clearCommandHistory,
    getSessionInfo,
    searchCommands,
    getCommandDetails,
    onCommandExecuted,

    // 便捷方法
    getSystemStatus,
    getPluginList,
    getRoomList,
    enablePlugin,
    disablePlugin,
    connectRoom,
    disconnectRoom,
    getConfig,
    setConfig,
    getLogs,

    // 清理
    cleanup
  };
});