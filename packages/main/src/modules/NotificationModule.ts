import { EventEmitter } from 'events';
import { Notification } from 'electron';
import { ConfigManager } from '../core/ConfigManager';
import { AppModule } from '../core/AppModule';
import type { ModuleContext } from '../core/ModuleContext';

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
  toastDuration: number;
  showToast: boolean;
}

/**
 * 通知服务模块
 * 负责管理应用内所有通知的配置、触发和展示
 */
export class NotificationModule extends EventEmitter implements AppModule {
  private configManager: ConfigManager;
  private notificationConfigs: Map<NotificationType, NotificationConfig>;
  private globalEnabled: boolean;
  private globalSound: boolean;
  private globalShowToast: boolean;
  private globalToastDuration: number;

  constructor() {
    super();
    this.configManager = new ConfigManager();
    this.notificationConfigs = new Map();
    this.globalEnabled = true;
    this.globalSound = true;
    this.globalShowToast = true;
    this.globalToastDuration = 5000;
    this.initialize();
  }

  /**
   * 初始化通知模块
   */
  private async initialize(): Promise<void> {
      await this.initializeNotificationConfig();
      await this.loadConfigurations();
      this.setupDefaultConfigs();
  }

  /**
   * 初始化通知配置
   */
  private async initializeNotificationConfig() {
      const config = await this.configManager.readConfig();
      const notificationSettings = config.notificationSettings || {};
      
      // 加载全局通知设置
      this.globalEnabled = notificationSettings.enabled !== false;
      this.globalSound = notificationSettings.sound !== false;
      this.globalShowToast = notificationSettings.showToast !== false;
      this.globalToastDuration = notificationSettings.toastDuration || 5000;
      
      // 加载分类通知设置
      const categories = notificationSettings.categories || {};
      Object.values(NotificationType).forEach(type => {
          const enabled = categories[type] !== false;
          this.notificationConfigs.set(type as NotificationType, {
              enabled,
              sound: this.globalSound,
              showToast: this.globalShowToast,
              toastDuration: this.globalToastDuration
          });
      });
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
   * 加载通知配置
   */
  private async loadConfigurations(): Promise<void> {
     try {
       const notificationSettings = await this.configManager.get('notificationSettings') || {};
       const categories = notificationSettings.categories || {};
        
       // 加载全局设置
       this.globalEnabled = notificationSettings.enabled !== false;
       this.globalSound = notificationSettings.sound !== false;
       this.globalShowToast = notificationSettings.showToast !== false;
       this.globalToastDuration = notificationSettings.toastDuration || 5000;
        
       // 加载分类设置
       Object.values(NotificationType).forEach(type => {
         this.notificationConfigs.set(type as NotificationType, {
           enabled: categories[type] !== false,
           sound: this.globalSound,
           showToast: this.globalShowToast,
           toastDuration: this.globalToastDuration
         });
       });
     } catch (error) {
       console.error('Failed to load notification configurations:', error);
     }
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
    if (!config.enabled || !config.showToast) return false;

    // 创建通知
    const notification = new Notification({
      title,
      body,
      silent: !config.sound,
      timeoutType: 'default'
    });

    // 设置点击事件
    if (onClick) {
      notification.on('click', onClick);
    }

    // 显示通知
    notification.show();

    // 设置自动关闭（由系统默认处理）

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
  
  public enable(context: ModuleContext): void {
    this.initialize();
  }
}

export default new NotificationModule();