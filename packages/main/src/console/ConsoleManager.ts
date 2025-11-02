import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { ApiServer } from '../server/ApiServer';
import { RoomManager } from '../rooms/RoomManager';
import { PluginManager } from '../plugins/PluginManager';
import { DatabaseManager } from '../persistence/DatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import { pluginLogger } from '../plugins/PluginLogger';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface ConsoleCommand {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[], context: ConsoleContext) => Promise<ConsoleResult>;
  category: 'system' | 'room' | 'plugin' | 'debug';
}

export interface ConsoleContext {
  userId?: string;
  sessionId: string;
  timestamp: number;
  source: 'local' | 'remote';
}

export interface ConsoleResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface ConsoleSession {
  id: string;
  name?: string; // 添加 name 属性
  userId?: string;
  startTime: number;
  createdAt: number; // 添加 createdAt 属性
  lastActivity: number;
  source: 'room' | 'user';
  commands: ConsoleCommandHistory[];
}

export interface ConsoleCommandHistory {
  command: string;
  args: string[];
  timestamp: number;
  result: ConsoleResult;
  executionTime: number;
}

export interface ConsoleManagerEvents {
  'command.executed': { session: string; command: string; result: ConsoleResult };
  'session.created': { session: ConsoleSession };
  'session.ended': { sessionId: string };
}

export class ConsoleManager extends TypedEventEmitter<ConsoleManagerEvents> {
  private commands: Map<string, ConsoleCommand> = new Map();
  private sessions: Map<string, ConsoleSession> = new Map();
  private apiServer: ApiServer;
  private roomManager: RoomManager;
  private pluginManager: PluginManager;
  private databaseManager: DatabaseManager;
  private configManager: ConfigManager;
  private historyFile: string;

  constructor(opts: {
    apiServer: ApiServer;
    roomManager: RoomManager;
    pluginManager: PluginManager;
    databaseManager: DatabaseManager;
    configManager: ConfigManager;
  }) {
    super();
    
    this.apiServer = opts.apiServer;
    this.roomManager = opts.roomManager;
    this.pluginManager = opts.pluginManager;
    this.databaseManager = opts.databaseManager;
    this.configManager = opts.configManager;
    
    this.historyFile = path.join(app.getPath('userData'), 'console-history.json');
    
    this.registerBuiltinCommands();
    this.loadHistory();
  }

  /**
   * 注册内置命令
   */
  private registerBuiltinCommands(): void {
    // 系统命令
    this.registerCommand({
      name: 'help',
      description: '显示可用命令列表',
      usage: 'help [command]',
      category: 'system',
      handler: this.handleHelpCommand.bind(this)
    });

    this.registerCommand({
      name: 'status',
      description: '显示系统状态',
      usage: 'status',
      category: 'system',
      handler: this.handleStatusCommand.bind(this)
    });

    this.registerCommand({
      name: 'config',
      description: '配置管理',
      usage: 'config <get|set|list> [key] [value]',
      category: 'system',
      handler: this.handleConfigCommand.bind(this)
    });

    // 房间管理命令
    this.registerCommand({
      name: 'rooms',
      description: '房间管理',
      usage: 'rooms <list|connect|disconnect> [roomId]',
      category: 'room',
      handler: this.handleRoomsCommand.bind(this)
    });

    // 插件管理命令
    this.registerCommand({
      name: 'plugins',
      description: '插件管理',
      usage: 'plugins <list|enable|disable|install|uninstall> [pluginId] [path]',
      category: 'plugin',
      handler: this.handlePluginsCommand.bind(this)
    });

    // 调试命令
    this.registerCommand({
      name: 'logs',
      description: '查看日志',
      usage: 'logs [pluginId] [limit]',
      category: 'debug',
      handler: this.handleLogsCommand.bind(this)
    });

    this.registerCommand({
      name: 'clear',
      description: '清空控制台',
      usage: 'clear',
      category: 'system',
      handler: this.handleClearCommand.bind(this)
    });
  }

  /**
   * 注册命令
   */
  public registerCommand(command: ConsoleCommand): void {
    this.commands.set(command.name, command);
    pluginLogger.debug('Console command registered', undefined, { name: command.name });
  }

  /**
   * 取消注册命令
   */
  public unregisterCommand(name: string): void {
    this.commands.delete(name);
    pluginLogger.debug('Console command unregistered', undefined, { name });
  }

  /**
   * 创建控制台会话
   */
  public createSession(source: 'local' | 'remote', userId?: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: ConsoleSession = {
      id: sessionId,
      userId,
      startTime: Date.now(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      source: source === 'local' ? 'user' : 'room',
      commands: []
    };

    this.sessions.set(sessionId, session);
    this.emit('session.created', { session });
    return sessionId;
  }

  /**
   * 结束控制台会话
   */
  public endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.emit('session.ended', { sessionId });
      pluginLogger.info('Console session ended', undefined, { sessionId });
    }
  }

  /**
   * 执行命令
   */
  public async executeCommand(
    sessionId: string,
    commandLine: string
  ): Promise<ConsoleResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        message: 'Invalid session',
        error: 'Session not found'
      };
    }

    // 更新会话活动时间
    session.lastActivity = Date.now();

    // 解析命令行
    const parts = commandLine.trim().split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    if (!commandName) {
      return {
        success: false,
        message: 'No command specified',
        error: 'Empty command'
      };
    }

    const command = this.commands.get(commandName);
    if (!command) {
      return {
        success: false,
        message: `Unknown command: ${commandName}`,
        error: 'Command not found'
      };
    }

    const context: ConsoleContext = {
      userId: session.userId,
      sessionId,
      timestamp: Date.now(),
      source: session.source === 'user' ? 'local' : 'remote'
    };

    const startTime = Date.now();
    let result: ConsoleResult;

    try {
      result = await command.handler(args, context);
    } catch (error: any) {
      result = {
        success: false,
        message: 'Command execution failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }

    const executionTime = Date.now() - startTime;

    // 记录命令历史
    const historyEntry: ConsoleCommandHistory = {
      command: commandName,
      args,
      timestamp: startTime,
      result,
      executionTime
    };

    session.commands.push(historyEntry);

    // 限制历史记录数量
    if (session.commands.length > 100) {
      session.commands.shift();
    }

    this.emit('command.executed', { session: sessionId, command: commandName, result });
    this.saveHistory();

    return result;
  }

  /**
   * 获取会话信息
   */
  public getSession(sessionId: string): ConsoleSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取所有活跃会话
   */
  public getActiveSessions(): ConsoleSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 获取可用命令列表
   */
  public getCommands(): ConsoleCommand[] {
    return Array.from(this.commands.values());
  }

  // 命令处理器实现
  private async handleHelpCommand(args: string[], context: ConsoleContext): Promise<ConsoleResult> {
    if (args.length > 0) {
      const commandName = args[0];
      const command = this.commands.get(commandName);
      
      if (!command) {
        return {
          success: false,
          message: `Command '${commandName}' not found`,
          error: 'Command not found'
        };
      }

      return {
        success: true,
        message: `${command.name}: ${command.description}\nUsage: ${command.usage}`,
        data: command
      };
    }

    const categories = ['system', 'room', 'plugin', 'debug'];
    const commandsByCategory: Record<string, ConsoleCommand[]> = {};

    for (const category of categories) {
      commandsByCategory[category] = Array.from(this.commands.values())
        .filter(cmd => cmd.category === category);
    }

    let helpText = 'Available commands:\n\n';
    
    for (const category of categories) {
      if (commandsByCategory[category].length > 0) {
        helpText += `${category.toUpperCase()}:\n`;
        for (const cmd of commandsByCategory[category]) {
          helpText += `  ${cmd.name.padEnd(12)} - ${cmd.description}\n`;
        }
        helpText += '\n';
      }
    }

    helpText += 'Use "help <command>" for detailed usage information.';

    return {
      success: true,
      message: helpText,
      data: commandsByCategory
    };
  }

  private async handleStatusCommand(args: string[], context: ConsoleContext): Promise<ConsoleResult> {
    const rooms = this.roomManager.getAllRooms();
    const plugins = this.pluginManager.getInstalledPlugins();
    const stats = this.pluginManager.getPluginStats();

    const status = {
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      },
      rooms: {
        total: rooms.length,
        connected: rooms.filter(r => r.status === 'open').length,
        list: rooms.map(r => ({
          id: r.roomId,
          name: r.label || `Room ${r.roomId}`,
          status: r.status,
          eventCount: r.eventCount
        }))
      },
      plugins: {
        total: stats.total,
        enabled: stats.enabled,
        disabled: stats.disabled,
        error: stats.error
      },
      sessions: {
        active: this.sessions.size,
        list: Array.from(this.sessions.values()).map(s => ({
          id: s.id,
          source: s.source,
          startTime: s.startTime,
          commandCount: s.commands.length
        }))
      }
    };

    return {
      success: true,
      message: 'System status retrieved',
      data: status
    };
  }

  private async handleConfigCommand(args: string[], context: ConsoleContext): Promise<ConsoleResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: config <get|set|list> [key] [value]',
        error: 'Missing arguments'
      };
    }

    const action = args[0];

    switch (action) {
      case 'list':
        const allConfig = this.configManager.getAll();
        return {
          success: true,
          message: 'Configuration listed',
          data: allConfig
        };

      case 'get':
        if (args.length < 2) {
          return {
            success: false,
            message: 'Usage: config get <key>',
            error: 'Missing key'
          };
        }
        const value = this.configManager.get(args[1]);
        return {
          success: true,
          message: `${args[1]} = ${JSON.stringify(value)}`,
          data: { key: args[1], value }
        };

      case 'set':
        if (args.length < 3) {
          return {
            success: false,
            message: 'Usage: config set <key> <value>',
            error: 'Missing key or value'
          };
        }
        try {
          const newValue = JSON.parse(args[2]);
          this.configManager.set(args[1], newValue);
          return {
            success: true,
            message: `Configuration updated: ${args[1]} = ${JSON.stringify(newValue)}`,
            data: { key: args[1], value: newValue }
          };
        } catch (error: any) {
          // 如果不是有效的JSON，作为字符串处理
          this.configManager.set(args[1], args[2]);
          return {
            success: true,
            message: `Configuration updated: ${args[1]} = \"${args[2]}\"`,
            data: { key: args[1], value: args[2] }
          };
        }

      default:
        return {
          success: false,
          message: `Unknown config action: ${action}`,
          error: 'Invalid action'
        };
    }
  }

  private async handleRoomsCommand(args: string[], context: ConsoleContext): Promise<ConsoleResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: rooms <list|connect|disconnect> [roomId]',
        error: 'Missing arguments'
      };
    }

    const action = args[0];

    switch (action) {
      case 'list':
        const rooms = this.roomManager.getAllRooms();
        return {
          success: true,
          message: `Found ${rooms.length} rooms`,
          data: rooms
        };

      case 'connect':
        if (args.length < 2) {
          return {
            success: false,
            message: 'Usage: rooms connect <roomId>',
            error: 'Missing roomId'
          };
        }
        try {
          await this.roomManager.addRoom(args[1]);
          return {
            success: true,
            message: `Connected to room ${args[1]}`,
            data: { roomId: args[1] }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to connect to room ${args[1]}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }

      case 'disconnect':
        if (args.length < 2) {
          return {
            success: false,
            message: 'Usage: rooms disconnect <roomId>',
            error: 'Missing roomId'
          };
        }
        try {
          await this.roomManager.removeRoom(args[1]);
          return {
            success: true,
            message: `Disconnected from room ${args[1]}`,
            data: { roomId: args[1] }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to disconnect from room ${args[1]}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }

      default:
        return {
          success: false,
          message: `Unknown rooms action: ${action}`,
          error: 'Invalid action'
        };
    }
  }

  private async handlePluginsCommand(args: string[], context: ConsoleContext): Promise<ConsoleResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: plugins <list|enable|disable|install|uninstall> [pluginId] [path]',
        error: 'Missing arguments'
      };
    }

    const action = args[0];

    switch (action) {
      case 'list':
        const plugins = this.pluginManager.getInstalledPlugins();
        return {
          success: true,
          message: `Found ${plugins.length} plugins`,
          data: plugins
        };

      case 'enable':
        if (args.length < 2) {
          return {
            success: false,
            message: 'Usage: plugins enable <pluginId>',
            error: 'Missing pluginId'
          };
        }
        try {
          await this.pluginManager.enablePlugin(args[1]);
          return {
            success: true,
            message: `Plugin ${args[1]} enabled`,
            data: { pluginId: args[1] }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to enable plugin ${args[1]}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }

      case 'disable':
        if (args.length < 2) {
          return {
            success: false,
            message: 'Usage: plugins disable <pluginId>',
            error: 'Missing pluginId'
          };
        }
        try {
          await this.pluginManager.disablePlugin(args[1]);
          return {
            success: true,
            message: `Plugin ${args[1]} disabled`,
            data: { pluginId: args[1] }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to disable plugin ${args[1]}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }

      case 'install':
        if (args.length < 2) {
          return {
            success: false,
            message: 'Usage: plugins install <path>',
            error: 'Missing path'
          };
        }
        try {
          const plugin = await this.pluginManager.installPlugin({ filePath: args[1] });
          return {
            success: true,
            message: `Plugin ${plugin.id} installed successfully`,
            data: plugin
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to install plugin from ${args[1]}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }

      case 'uninstall':
        if (args.length < 2) {
          return {
            success: false,
            message: 'Usage: plugins uninstall <pluginId>',
            error: 'Missing pluginId'
          };
        }
        try {
          await this.pluginManager.uninstallPlugin(args[1]);
          return {
            success: true,
            message: `Plugin ${args[1]} uninstalled`,
            data: { pluginId: args[1] }
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to uninstall plugin ${args[1]}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }

      default:
        return {
          success: false,
          message: `Unknown plugins action: ${action}`,
          error: 'Invalid action'
        };
    }
  }

  private async handleLogsCommand(args: string[], context: ConsoleContext): Promise<ConsoleResult> {
    const pluginId = args[0];
    const limit = args[1] ? parseInt(args[1]) : 50;

    const logs = this.pluginManager.getPluginLogs(pluginId, limit);

    return {
      success: true,
      message: `Retrieved ${logs.length} log entries`,
      data: logs
    };
  }

  private async handleClearCommand(args: string[], context: ConsoleContext): Promise<ConsoleResult> {
    return {
      success: true,
      message: 'Console cleared',
      data: { action: 'clear' }
    };
  }

  /**
   * 加载历史记录
   */
  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        const history = JSON.parse(data);
        // 这里可以根据需要恢复历史会话或命令
        pluginLogger.debug('Console history loaded');
      }
    } catch (error: any) {
      pluginLogger.warn('Failed to load console history', undefined, { error });
    }
  }

  /**
   * 保存历史记录
   */
  private saveHistory(): void {
    try {
      const history = {
        sessions: Array.from(this.sessions.values()).map(session => ({
          ...session,
          commands: session.commands.slice(-20) // 只保存最近20条命令
        })),
        timestamp: Date.now()
      };

      fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error: any) {
      pluginLogger.warn('Failed to save console history', undefined, { error });
    }
  }

  /**
   * 清理过期会话
   */
  public cleanupSessions(): void {
    const now = Date.now();
    const maxInactiveTime = 30 * 60 * 1000; // 30分钟

    const sessionsToEnd: string[] = [];
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      if (now - session.lastActivity > maxInactiveTime) {
        sessionsToEnd.push(sessionId);
      }
    }
    
    for (const sessionId of sessionsToEnd) {
      this.endSession(sessionId);
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.saveHistory();
    this.sessions.clear();
    this.commands.clear();
    pluginLogger.info('Console manager cleaned up');
  }
}