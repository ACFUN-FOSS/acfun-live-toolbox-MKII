import { Notification, ipcMain } from 'electron';
import { systemSettingsService } from './SystemSettingsService';
import * as path from 'path';

/**
 * 通知服务，负责管理和发送系统通知
 */
export class NotificationService {
  private static instance: NotificationService;
  private notificationSounds: Record<string, string> = {};
  private permissionStatus: 'granted' | 'denied' | 'default' = 'default';

  private constructor() {
    this.initialize();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * 初始化通知服务
   */
  private async initialize(): Promise<void> {
    // 初始化通知声音路径
    this.initializeSoundPaths();
    // 注册IPC事件处理程序
    this.registerIpcHandlers();
    // 加载通知设置
    await this.loadNotificationSettings();
  }

  /**
   * 初始化通知声音路径
   */
  private initializeSoundPaths(): void {
    // 在实际应用中，这里应该指向应用内的声音文件
    this.notificationSounds = {
      default: path.join(__dirname, '../../assets/sounds/default.wav'),
      soft: path.join(__dirname, '../../assets/sounds/soft.wav'),
      loud: path.join(__dirname, '../../assets/sounds/loud.wav')
    };
  }

  /**
   * 注册IPC事件处理程序
   */
  private registerIpcHandlers(): void {
    // 获取通知权限状态
    ipcMain.handle('notification:getPermissionStatus', async () => {
      return { success: true, data: this.permissionStatus };
    });

    // 请求通知权限
    ipcMain.handle('notification:requestPermission', async () => {
      try {
        const permission = await Notification.requestPermission();
        this.permissionStatus = permission;
        return { success: true, data: permission };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 发送测试通知
    ipcMain.handle('notification:sendTestNotification', async () => {
      try {
        await this.sendNotification({
          title: '测试通知',
          body: '这是一条测试通知，用于验证通知功能是否正常工作',
          type: 'systemUpdate'
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * 加载通知设置
   */
  private async loadNotificationSettings(): Promise<void> {
    try {
      const settings = await systemSettingsService.getSettingsByCategory('notifications');
      // 应用通知设置
      if (settings && settings.enableNotifications === false) {
        // 通知已被禁用
        console.log('Notifications are disabled in settings');
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  /**
   * 检查通知是否应该被发送
   */
  private async shouldSendNotification(type: string): Promise<boolean> {
    try {
      // 检查全局通知设置
      const settings = await systemSettingsService.getSettingsByCategory('notifications');

      // 如果全局禁用通知，直接返回false
      if (!settings || !settings.enableNotifications) {
        return false;
      }

      // 检查是否启用了特定类型的通知
      if (settings.notificationTypes && Array.isArray(settings.notificationTypes)) {
        return settings.notificationTypes.includes(type);
      }

      // 默认允许所有类型通知
      return true;
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      // 出错时默认不发送通知
      return false;
    }
  }

  /**
   * 获取通知声音文件路径
   */
  private async getNotificationSoundPath(): Promise<string | undefined> {
    try {
      const settings = await systemSettingsService.getSettingsByCategory('notifications');

      // 如果禁用了通知声音，返回undefined
      if (!settings || !settings.notificationSound) {
        return undefined;
      }

      // 获取配置的声音类型
      const soundType = settings.soundType || 'default';
      return this.notificationSounds[soundType];
    } catch (error) {
      console.error('Error getting notification sound:', error);
      return undefined;
    }
  }

  /**
   * 发送系统通知
   * @param options 通知选项
   */
  public async sendNotification(options: {
    title: string;
    body: string;
    type: string;
    icon?: string;
    data?: any;
    urgency?: 'low' | 'normal' | 'critical';
  }): Promise<boolean> {
    try {
      // 检查权限
      if (this.permissionStatus !== 'granted') {
        console.log('Notification permission not granted');
        return false;
      }

      // 检查通知设置是否允许该类型通知
      const shouldSend = await this.shouldSendNotification(options.type);
      if (!shouldSend) {
        console.log(`Notification type ${options.type} is disabled`);
        return false;
      }

      // 获取通知声音
      const soundPath = await this.getNotificationSoundPath();

      // 创建通知选项
      const notificationOptions: Electron.NotificationConstructorOptions = {
        title: options.title,
        body: options.body,
        silent: !soundPath,
        icon: options.icon || path.join(__dirname, '../../assets/icons/notification-icon.png'),
        urgency: options.urgency || 'normal',
        data: options.data
      };

      // 添加声音（仅Windows支持）
      if (soundPath && process.platform === 'win32') {
        notificationOptions.sound = soundPath;
      }

      // 发送通知
      const notification = new Notification(notificationOptions);
      notification.show();

      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }
}

/**
 * 通知服务单例实例
 */
export const notificationService = NotificationService.getInstance();