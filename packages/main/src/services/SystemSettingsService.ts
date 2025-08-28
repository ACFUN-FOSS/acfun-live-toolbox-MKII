import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface GeneralSettings {
  autoStart: boolean;
  minimizeToTray: boolean;
  showNotifications: boolean;
  checkUpdates: boolean;
}

interface NetworkSettings {
  proxyEnabled: boolean;
  proxyServer: string;
  proxyPort: number;
  timeout: number;
  maxRetries: number;
}

interface ShortcutSettings {
  global: Record<string, string>;
  inApp: Record<string, string>;
}

interface ServerSettings {
  httpPort: number;
  wsPort: number;
  enableCors: boolean;
  allowedOrigins: string[];
}

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  fontSize: number;
  accentColor: string;
  compactMode: boolean;
}

interface NotificationSettings {
  newDanmu: boolean;
  giftReceived: boolean;
  followerJoined: boolean;
  systemMessages: boolean;
  soundEnabled: boolean;
}

interface SystemSettings {
  general: GeneralSettings;
  network: NetworkSettings;
  shortcuts: ShortcutSettings;
  server: ServerSettings;
  appearance: AppearanceSettings;
  notifications: NotificationSettings;
  lastUpdated: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  general: {
    autoStart: false,
    minimizeToTray: true,
    showNotifications: true,
    checkUpdates: true
  },
  network: {
    proxyEnabled: false,
    proxyServer: '',
    proxyPort: 8080,
    timeout: 30000,
    maxRetries: 3
  },
  shortcuts: {
    global: {
      'show-app': 'Ctrl+Shift+A',
      'toggle-mute': 'Ctrl+M',
      'take-screenshot': 'Ctrl+Shift+S'
    },
    inApp: {
      'save-note': 'Ctrl+S',
      'search': 'Ctrl+F',
      'new-note': 'Ctrl+N'
    }
  },
  server: {
    httpPort: 8088,
    wsPort: 8089,
    enableCors: true,
    allowedOrigins: ['http://localhost:3000']
  },
  appearance: {
    theme: 'system',
    language: 'zh-CN',
    fontSize: 14,
    accentColor: '#2d8cf0',
    compactMode: false
  },
  notifications: {
    newDanmu: true,
    giftReceived: true,
    followerJoined: true,
    systemMessages: true,
    soundEnabled: true
  },
  lastUpdated: new Date().toISOString()
};

export class SystemSettingsService {
  private settingsPath: string;
  private settings: SystemSettings;

  constructor() {
    // 初始化设置存储路径
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.settings = this.loadSettings();
  }

  /**
   * 从文件加载设置
   */
  private loadSettings(): SystemSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        const savedSettings = JSON.parse(data) as Partial<SystemSettings>;
        // 合并保存的设置与默认设置，确保所有字段都存在
        return this.mergeSettings(DEFAULT_SETTINGS, savedSettings);
      }
      return { ...DEFAULT_SETTINGS };
    } catch (error) {
      console.error('Failed to load settings:', error);
      // 加载失败时使用默认设置
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * 合并设置对象，确保所有默认字段都存在
   */
  private mergeSettings(defaults: any, custom: any): any {
    const merged = { ...defaults };
    for (const key in custom) {
      if (Object.prototype.hasOwnProperty.call(custom, key)) {
        if (typeof custom[key] === 'object' && custom[key] !== null && !Array.isArray(custom[key])) {
          merged[key] = this.mergeSettings(defaults[key], custom[key]);
        } else {
          merged[key] = custom[key];
        }
      }
    }
    return merged;
  }

  /**
   * 保存设置到文件
   */
  private saveSettings(): void {
    try {
      // 确保目录存在
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 更新最后修改时间
      this.settings.lastUpdated = new Date().toISOString();

      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('无法保存应用设置');
    }
  }

  /**
   * 获取所有设置
   */
  getAllSettings(): SystemSettings {
    return { ...this.settings };
  }

  /**
   * 获取特定类别的设置
   */
  getSettingsByCategory<T extends keyof SystemSettings>(category: T): SystemSettings[T] {
    return { ...this.settings[category] };
  }

  /**
   * 更新特定类别的设置
   */
  updateSettingsByCategory<T extends keyof SystemSettings>(
    category: T,
    newSettings: Partial<SystemSettings[T]>
  ): SystemSettings[T] {
    this.settings[category] = {
      ...this.settings[category],
      ...newSettings
    };

    this.saveSettings();
    return { ...this.settings[category] };
  }

  /**
   * 重置所有设置为默认值
   */
  resetToDefault(): SystemSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
    return { ...this.settings };
  }

  /**
   * 重置特定类别的设置为默认值
   */
  resetCategoryToDefault<T extends keyof SystemSettings>(category: T): SystemSettings[T] {
    this.settings[category] = { ...DEFAULT_SETTINGS[category] };
    this.saveSettings();
    return { ...this.settings[category] };
  }
}

export const systemSettingsService = new SystemSettingsService();