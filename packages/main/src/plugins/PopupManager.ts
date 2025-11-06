import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { BrowserWindow } from 'electron';
import { pluginLogger } from './PluginLogger';
import { pluginLifecycleManager } from './PluginLifecycle';

export interface PopupOptions {
  title?: string;
  content: string;
  contentType?: 'text' | 'html' | 'component';
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  modal?: boolean;
  resizable?: boolean;
  closable?: boolean;
  draggable?: boolean;
  position?: 'center' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | { x: number; y: number };
  style?: {
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
    border?: string;
    boxShadow?: string;
    opacity?: number;
  };
  animation?: {
    type?: 'fade' | 'slide' | 'scale' | 'bounce' | 'none';
    duration?: number;
    easing?: string;
  };
  buttons?: Array<{
    id: string;
    text: string;
    type?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
  }>;
  autoClose?: number; // 自动关闭时间（毫秒）
  persistent?: boolean; // 是否持久化（防止意外关闭）
  className?: string;
  zIndex?: number;
  onAction?: (actionId: string) => void;
  onClose?: () => void;
  onShow?: () => void;
  onHide?: () => void;
}

export interface PopupInstance {
  id: string;
  pluginId: string;
  options: PopupOptions;
  zIndex: number;
  createdAt: number;
  visible: boolean;
  hidden: boolean; // 新增：是否隐藏状态
}

export interface PopupManagerEvents {
  'popup.created': { popup: PopupInstance };
  'popup.closed': { popupId: string; pluginId: string };
  'popup.updated': { popup: PopupInstance };
  'popup.shown': { popupId: string; pluginId: string };
  'popup.hidden': { popupId: string; pluginId: string };
  'popup.action': { popupId: string; pluginId: string; actionId: string };
  'popup.zindex.changed': { popupId: string; zIndex: number };
}

/**
 * PopupManager 负责管理插件弹窗的生命周期、z-index管理和事件处理
 */
export class PopupManager extends TypedEventEmitter<PopupManagerEvents> {
  private popups: Map<string, PopupInstance> = new Map();
  private nextZIndex: number = 1000;
  private maxPopups: number = 10; // 最大同时显示的弹窗数量

  constructor() {
    super();
    pluginLogger.info('PopupManager initialized');
  }

  /**
   * 创建弹窗
   */
  public createPopup(pluginId: string, options: PopupOptions): string {
    // 在创建前触发生命周期钩子（beforeWindowOpen）
    pluginLifecycleManager
      .executeHook('beforeWindowOpen', {
        pluginId,
        context: { pageType: 'window' }
      })
      .catch((e) => {
        pluginLogger.warn(
          '[PopupManager] beforeWindowOpen hook error',
          e instanceof Error ? e.message : String(e)
        );
      });
    // 检查弹窗数量限制
    const pluginPopups = Array.from(this.popups.values()).filter(p => p.pluginId === pluginId);
    if (pluginPopups.length >= 3) {
      throw new Error(`Plugin ${pluginId} has reached maximum popup limit (3)`);
    }

    if (this.popups.size >= this.maxPopups) {
      throw new Error('Maximum number of popups reached');
    }

    const popupId = `popup_${pluginId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const zIndex = this.nextZIndex++;

    const popup: PopupInstance = {
      id: popupId,
      pluginId,
      options: {
        ...options,
        width: options.width || 400,
        height: options.height || 300,
        modal: options.modal !== false, // 默认为模态
        resizable: options.resizable !== false, // 默认可调整大小
        closable: options.closable !== false, // 默认可关闭
        draggable: options.draggable !== false, // 默认可拖拽
        position: options.position || 'center',
        contentType: options.contentType || 'text'
      },
      zIndex,
      createdAt: Date.now(),
      visible: true,
      hidden: false
    };

    this.popups.set(popupId, popup);

    pluginLogger.info(`Created popup for plugin ${pluginId}`, pluginId, {
      popupId,
      title: options.title,
      zIndex
    });

    this.emit('popup.created', { popup });

    // 在创建后触发生命周期钩子（afterWindowOpen）
    pluginLifecycleManager
      .executeHook('afterWindowOpen', {
        pluginId,
        context: { pageType: 'window', popupId }
      })
      .catch((e) => {
        pluginLogger.warn(
          '[PopupManager] afterWindowOpen hook error',
          e instanceof Error ? e.message : String(e)
        );
      });
    return popupId;
  }

  /**
   * 更新弹窗配置
   */
  public updatePopup(popupId: string, options: Partial<PopupOptions>): boolean {
    const popup = this.popups.get(popupId);
    if (!popup) {
      return false;
    }

    // 更新配置
    popup.options = { ...popup.options, ...options };

    pluginLogger.info(`Updated popup ${popupId}`, popup.pluginId, {
      updatedOptions: Object.keys(options)
    });

    this.emit('popup.updated', { popup });
    return true;
  }

  /**
   * 显示弹窗
   */
  public showPopup(popupId: string): boolean {
    const popup = this.popups.get(popupId);
    if (!popup) {
      return false;
    }

    if (!popup.hidden) {
      return true; // 已经显示
    }

    popup.hidden = false;

    // 调用显示回调
    if (popup.options.onShow) {
      try {
        popup.options.onShow();
      } catch (error) {
        pluginLogger.error(`Error in popup show callback`, popup.pluginId, error as Error);
      }
    }

    pluginLogger.info(`Showed popup ${popupId}`, popup.pluginId);
    this.emit('popup.shown', { popupId, pluginId: popup.pluginId });

    return true;
  }

  /**
   * 隐藏弹窗
   */
  public hidePopup(popupId: string): boolean {
    const popup = this.popups.get(popupId);
    if (!popup) {
      return false;
    }

    if (popup.hidden) {
      return true; // 已经隐藏
    }

    popup.hidden = true;

    // 调用隐藏回调
    if (popup.options.onHide) {
      try {
        popup.options.onHide();
      } catch (error) {
        pluginLogger.error(`Error in popup hide callback`, popup.pluginId, error as Error);
      }
    }

    pluginLogger.info(`Hidden popup ${popupId}`, popup.pluginId);
    this.emit('popup.hidden', { popupId, pluginId: popup.pluginId });

    return true;
  }
  public closePopup(popupId: string): boolean {
    const popup = this.popups.get(popupId);
    if (!popup) {
      return false;
    }

    // 调用关闭回调
    if (popup.options.onClose) {
      try {
        popup.options.onClose();
      } catch (error) {
        pluginLogger.error(`Error in popup close callback`, popup.pluginId, error as Error);
      }
    }

    this.popups.delete(popupId);

    pluginLogger.info(`Closed popup ${popupId}`, popup.pluginId);
    this.emit('popup.closed', { popupId, pluginId: popup.pluginId });

    // 触发生命周期钩子（windowClosed）
    pluginLifecycleManager
      .executeHook('windowClosed', {
        pluginId: popup.pluginId,
        context: { pageType: 'window', popupId }
      })
      .catch((e) => {
        pluginLogger.warn(
          '[PopupManager] windowClosed hook error',
          e instanceof Error ? e.message : String(e)
        );
      });

    return true;
  }

  /**
   * 处理弹窗动作
   */
  public handlePopupAction(popupId: string, actionId: string): boolean {
    const popup = this.popups.get(popupId);
    if (!popup) {
      return false;
    }

    // 调用动作回调
    if (popup.options.onAction) {
      try {
        popup.options.onAction(actionId);
      } catch (error) {
        pluginLogger.error(`Error in popup action callback`, popup.pluginId, error as Error);
      }
    }

    pluginLogger.info(`Popup action triggered`, popup.pluginId, {
      popupId,
      actionId
    });

    this.emit('popup.action', { popupId, pluginId: popup.pluginId, actionId });

    return true;
  }

  /**
   * 将弹窗置于顶层
   */
  public bringToFront(popupId: string): boolean {
    const popup = this.popups.get(popupId);
    if (!popup) {
      return false;
    }

    const newZIndex = this.nextZIndex++;
    popup.zIndex = newZIndex;

    pluginLogger.debug(`Brought popup to front`, popup.pluginId, {
      popupId,
      newZIndex
    });

    this.emit('popup.zindex.changed', { popupId, zIndex: newZIndex });
    return true;
  }

  /**
   * 获取弹窗信息
   */
  public getPopup(popupId: string): PopupInstance | undefined {
    return this.popups.get(popupId);
  }

  /**
   * 获取插件的所有弹窗
   */
  public getPluginPopups(pluginId: string): PopupInstance[] {
    return Array.from(this.popups.values()).filter(p => p.pluginId === pluginId);
  }

  /**
   * 获取所有弹窗
   */
  public getAllPopups(): PopupInstance[] {
    return Array.from(this.popups.values()).sort((a, b) => b.zIndex - a.zIndex);
  }

  /**
   * 关闭插件的所有弹窗
   */
  public closePluginPopups(pluginId: string): number {
    const pluginPopups = this.getPluginPopups(pluginId);
    let closedCount = 0;

    for (const popup of pluginPopups) {
      if (this.closePopup(popup.id)) {
        closedCount++;
      }
    }

    if (closedCount > 0) {
      pluginLogger.info(`Closed ${closedCount} popups for plugin ${pluginId}`, pluginId);
    }

    return closedCount;
  }

  /**
   * 清理所有弹窗
   */
  public cleanup(): void {
    const popupIds = Array.from(this.popups.keys());
    for (const popupId of popupIds) {
      this.closePopup(popupId);
    }
    pluginLogger.info('PopupManager cleanup completed');
  }

  /**
   * 获取弹窗统计信息
   */
  public getStats(): {
    total: number;
    byPlugin: Record<string, number>;
    maxZIndex: number;
  } {
    const byPlugin: Record<string, number> = {};
    
    for (const popup of this.popups.values()) {
      byPlugin[popup.pluginId] = (byPlugin[popup.pluginId] || 0) + 1;
    }

    return {
      total: this.popups.size,
      byPlugin,
      maxZIndex: this.nextZIndex - 1
    };
  }
}
