import { EventEmitter } from 'events';
import { Notification } from 'electron';
import { ConfigManager } from '../core/ConfigManager';

/**
 * 通知类型枚举
 */
enum NotificationType {
  LIVE_STATUS = 'liveStatus',
  DANMU_HIGHLIGHT = 'danmuHighlight',
  GIFT_ALERT = 'giftAlert',
  SYSTEM_UPDATE = 'systemUpdate',
  REMINDER = 'reminder'
}

/**
 * 通知配置接口
 */
interface NotificationConfig {
  enabled: boolean;
  sound: boolean;
  displayDuration: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * 通知服务模块
 * 负责管理应用内所有通知的配置、触发和展示
 */
export class NotificationModule extends EventEmitter {
  private configManager: ConfigManager;
  private notificationConfigs: Map<NotificationType, NotificationConfig>;
  private globalEnabled: boolean;

  constructor() {
    super();
    this.configManager = new ConfigManager();
    this.notificationConfigs = new Map();
    this.globalEnabled = true;
    this.initialize();
  }

  /**
   * 初始化通知模块
   */
  private async initialize(): Promise<void> {
    await this.loadConfigurations();
    this.setupDefaultConfigs();
  }

  /**
   * 加载通知配置
   */
  private async loadConfigurations(): Promise<void> {
    try {
      const savedConfigs = await this.configManager.get('notificationSettings');
      if (savedConfigs) {
        const defaultConfig: NotificationConfig = {
          enabled: true,
          sound: true,
          displayDuration: 5000,
          position: 'top-right'
        };
        Object.entries(savedConfigs).forEach(([type, config]) => {
          this.notificationConfigs.set(type as NotificationType, { ...defaultConfig, ...config });
        });
      }

      const globalSetting = await this.configManager.get('globalNotificationEnabled');
      this.globalEnabled = globalSetting !== false;
    } catch (error) {
      console.error('Failed to load notification configurations:', error);
    }
  }

  /**
   * 设置默认配置
   */
  private setupDefaultConfigs(): void {
    // 为未配置的通知类型设置默认值
    Object.values(NotificationType).forEach(type => {
      if (!this.notificationConfigs.has(type)) {
        this.notificationConfigs.set(type, {
          enabled: true,
          sound: true,
          displayDuration: 5000,
          position: 'top-right'
        });
      }
    });
  }

  /**
   * 获取特定类型的通知配置
   */
  public getNotificationConfig(type: NotificationType): NotificationConfig {
    return this.notificationConfigs.get(type) || {
      enabled: true,
      sound: true,
      displayDuration: 5000,
      position: 'top-right'
    };
  }

  /**
   * 更新通知配置
   */
  public async updateNotificationConfig(
    type: NotificationType,
    config: Partial<NotificationConfig>
  ): Promise<NotificationConfig> {
    const currentConfig = this.getNotificationConfig(type);
    const updatedConfig = { ...currentConfig, ...config };

    this.notificationConfigs.set(type, updatedConfig);
    await this.saveConfigurations();

    this.emit('configUpdated', type, updatedConfig);
    return updatedConfig;
  }

  /**
   * 保存所有通知配置
   */
  private async saveConfigurations(): Promise<void> {
    const configObject: Record<string, NotificationConfig> = {};
    this.notificationConfigs.forEach((config, type) => {
      configObject[type] = config;
    });

    await this.configManager.set('notificationSettings', configObject);
    await this.configManager.set('globalNotificationEnabled', this.globalEnabled);
  }

  /**
   * 触发通知
   */
  public showNotification(
    type: NotificationType,
    title: string,
    body: string,
    onClick?: () => void
  ): boolean {
    // 检查全局通知开关和类型开关
    if (!this.globalEnabled) return false;

    const config = this.getNotificationConfig(type);
    if (!config.enabled) return false;

    // 创建通知
    const notification = new Notification({
      title,
      body,
      silent: !config.sound,
      timeoutType: 'never'
    });

    // 设置点击事件
    if (onClick) {
      notification.on('click', onClick);
    }

    // 显示通知
    notification.show();

    // 设置自动关闭
    setTimeout(() => notification.close(), config.displayDuration);

    this.emit('notificationShown', type, { title, body });
    return true;
  }

  /**
   * 启用/禁用所有通知
   */
  public async setGlobalNotificationEnabled(enabled: boolean): Promise<void> {
    this.globalEnabled = enabled;
    await this.configManager.set('globalNotificationEnabled', enabled);
    this.emit('globalStatusChanged', enabled);
  }

  /**
   * 获取全局通知状态
   */
  public isGlobalNotificationEnabled(): boolean {
    return this.globalEnabled;
  }
}

export default new NotificationModule();