import { EventEmitter } from 'events';
import { AppModule } from '../core/AppModule';
import { ModuleContext } from '../core/ModuleContext';
import { ConfigManager } from '../core/ConfigManager';
import { LogManager } from '../utils/LogManager';

// 黑名单用户接口
export interface BlacklistUser {
  userId: string;
  username: string;
  reason?: string;
  addedAt: number;
  expiresAt?: number; // 可选的过期时间，永久黑名单不设置此值
}

/**
 * 黑名单管理模块
 * 负责处理用户黑名单的添加、移除、查询和持久化
 */
export class BlacklistManager extends EventEmitter implements AppModule {
  private blacklist: Map<string, BlacklistUser>;
  private configManager!: ConfigManager;
  private logManager!: LogManager;
  private static readonly CONFIG_KEY = 'blacklist';
  private isEnabled = false;

  constructor() {
    super();
    this.blacklist = new Map();
  }

  /**
   * 启用黑名单模块
   */
  enable(context: ModuleContext): void {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.configManager = new ConfigManager();
    this.logManager = new LogManager(context.appDataPath);
    this.initialize();
  }

  /**
   * 禁用黑名单模块
   */
  disable(): void {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    this.removeAllListeners();
    this.blacklist.clear();
  }

  /**
   * 初始化黑名单模块
   * 从配置加载已保存的黑名单数据
   */
  private initialize(): void {
    this.logManager.addLog('BlacklistManager', 'Initializing blacklist manager', 'info');
    this.loadBlacklist();
    this.cleanupExpiredEntries();
  }

  /**
   * 从配置加载黑名单数据
   */
  private loadBlacklist(): void {
    try {
      const savedBlacklist = this.configManager.readConfig()[BlacklistManager.CONFIG_KEY] || [];
      savedBlacklist.forEach((user: BlacklistUser) => {
        this.blacklist.set(user.userId, user);
      });
      this.logManager.addLog('BlacklistManager', `Loaded ${this.blacklist.size} blacklist entries`, 'info');
    } catch (error) {
      this.logManager.addLog('BlacklistManager', `Failed to load blacklist: ${error.message}`, 'error');
      // 加载失败时初始化空黑名单
      this.blacklist = new Map();
    }
  }

  /**
   * 保存黑名单数据到配置
   */
  private saveBlacklist(): void {
    try {
      const blacklistArray = Array.from(this.blacklist.values());
      this.configManager.writeConfig({
        [BlacklistManager.CONFIG_KEY]: blacklistArray
      });
      this.logManager.addLog('BlacklistManager', `Saved ${blacklistArray.length} blacklist entries`, 'info');
    } catch (error) {
      this.logManager.addLog('BlacklistManager', `Failed to save blacklist: ${error.message}`, 'error');
    }
  }

  /**
   * 清理过期的黑名单条目
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;

    this.blacklist.forEach((user, userId) => {
      if (user.expiresAt && user.expiresAt < now) {
        this.blacklist.delete(userId);
        expiredCount++;
      }
    });

    if (expiredCount > 0) {
      this.logManager.addLog('BlacklistManager', `Removed ${expiredCount} expired blacklist entries`, 'info');
      this.saveBlacklist();
      this.emit('blacklistUpdated', this.getBlacklist());
    }
  }

  /**
   * 添加用户到黑名单
   * @param user - 要添加的黑名单用户信息
   * @returns 添加结果
   */
  public addToBlacklist(user: BlacklistUser): boolean {
    if (this.blacklist.has(user.userId)) {
      this.logManager.addLog('BlacklistManager', `User ${user.username} (${user.userId}) is already in blacklist`, 'warn');
      return false;
    }

    // 设置添加时间（如果未提供）
    const userToAdd = {
      ...user,
      addedAt: user.addedAt || Date.now()
    };

    this.blacklist.set(user.userId, userToAdd);
    this.logManager.addLog('BlacklistManager', `Added user ${user.username} (${user.userId}) to blacklist. Reason: ${user.reason || 'Not specified'}`, 'info');
    this.saveBlacklist();
    this.emit('blacklistUpdated', this.getBlacklist());
    this.emit('userAdded', userToAdd);
    return true;
  }

  /**
   * 从黑名单移除用户
   * @param userId - 要移除的用户ID
   * @returns 移除结果
   */
  public removeFromBlacklist(userId: string): boolean {
    const user = this.blacklist.get(userId);
    if (!user) {
      this.logManager.addLog('BlacklistManager', `User ${userId} is not in blacklist`, 'warn');
      return false;
    }

    this.blacklist.delete(userId);
    this.logManager.addLog('BlacklistManager', `Removed user ${user.username} (${userId}) from blacklist`, 'info');
    this.saveBlacklist();
    this.emit('blacklistUpdated', this.getBlacklist());
    this.emit('userRemoved', user);
    return true;
  }

  /**
   * 检查用户是否在黑名单中
   * @param userId - 要检查的用户ID
   * @returns 是否在黑名单中
   */
  public isBlacklisted(userId: string): boolean {
    this.cleanupExpiredEntries(); // 检查前先清理过期条目
    return this.blacklist.has(userId);
  }

  /**
   * 获取黑名单中的用户信息
   * @param userId - 用户ID
   * @returns 用户信息或undefined
   */
  public getBlacklistUser(userId: string): BlacklistUser | undefined {
    this.cleanupExpiredEntries();
    return this.blacklist.get(userId);
  }

  /**
   * 获取完整的黑名单列表
   * @returns 黑名单用户数组
   */
  public getBlacklist(): BlacklistUser[] {
    this.cleanupExpiredEntries();
    return Array.from(this.blacklist.values());
  }

  /**
   * 清空黑名单
   * @returns 操作结果
   */
  public clearBlacklist(): boolean {
    if (this.blacklist.size === 0) {
      this.logManager.addLog('BlacklistManager', 'Blacklist is already empty', 'warn');
      return false;
    }

    const count = this.blacklist.size;
    this.blacklist.clear();
    this.logManager.addLog('BlacklistManager', `Cleared ${count} entries from blacklist`, 'info');
    this.saveBlacklist();
    this.emit('blacklistUpdated', this.getBlacklist());
    this.emit('blacklistCleared');
    return true;
  }
}