import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { pluginLogger } from './PluginLogger';

export interface OverlayPosition {
  x?: number | string;
  y?: number | string;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
}

export interface OverlaySize {
  width?: number | string;
  height?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
}

export interface OverlayStyle {
  backgroundColor?: string;
  opacity?: number;
  borderRadius?: string;
  border?: string;
  boxShadow?: string;
  zIndex?: number;
}

export interface OverlayOptions {
  id?: string;
  type: 'html' | 'component' | 'text' | 'default';
  content?: string;
  component?: string;
  props?: Record<string, any>;
  title?: string;
  description?: string;
  position?: OverlayPosition;
  size?: OverlaySize;
  style?: OverlayStyle;
  closable?: boolean;
  modal?: boolean;
  clickThrough?: boolean;
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  duration?: number;
  autoClose?: number;
  className?: string;
  pluginId?: string;
  roomId?: string;
}

export interface OverlayState extends OverlayOptions {
  id: string;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
  zIndex: number;
}

export interface OverlayCreateResult {
  success: boolean;
  overlayId?: string;
  error?: string;
}

export interface OverlayActionResult {
  success: boolean;
  error?: string;
}

export interface OverlayListResult {
  overlays: Array<{
    id: string;
    type: string;
    visible: boolean;
    createdAt: number;
    pluginId?: string;
    roomId?: string;
  }>;
}

/**
 * Overlay管理器 - 管理应用程序中的overlay系统
 */
export class OverlayManager extends EventEmitter {
  private overlays: Map<string, OverlayState> = new Map();
  private baseZIndex = 2000;
  private zIndexCounter = 0;

  constructor() {
    super();
    this.setMaxListeners(100); // 增加最大监听器数量
  }

  /**
   * 创建新的overlay
   */
  async createOverlay(options: OverlayOptions): Promise<OverlayCreateResult> {
    try {
      // 生成唯一ID
      const overlayId = options.id || uuidv4();
      
      // 检查ID是否已存在
      if (this.overlays.has(overlayId)) {
        return {
          success: false,
          error: `Overlay with ID '${overlayId}' already exists`
        };
      }

      // 创建overlay状态
      const now = Date.now();
      const overlayState: OverlayState = {
        ...options,
        id: overlayId,
        visible: true,
        createdAt: now,
        updatedAt: now,
        zIndex: this.baseZIndex + (++this.zIndexCounter)
      };

      // 存储overlay
      this.overlays.set(overlayId, overlayState);

      // 发送事件到渲染进程
      this.emit('overlay-created', overlayState);

      return {
        success: true,
        overlayId
      };
    } catch (error: any) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 更新overlay
   */
  async updateOverlay(overlayId: string, updates: Partial<OverlayState>): Promise<OverlayActionResult> {
    try {
      const overlay = this.overlays.get(overlayId);
      if (!overlay) {
        return {
          success: false,
          error: `Overlay with ID '${overlayId}' not found`
        };
      }

      // 更新overlay状态
      const updatedOverlay: OverlayState = {
        ...overlay,
        ...updates,
        id: overlayId, // 确保ID不被覆盖
        updatedAt: Date.now()
      };

      this.overlays.set(overlayId, updatedOverlay);

      // 发送事件到渲染进程
      this.emit('overlay-updated', updatedOverlay);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 关闭overlay
   */
  async closeOverlay(overlayId: string): Promise<OverlayActionResult> {
    try {
      const overlay = this.overlays.get(overlayId);
      if (!overlay) {
        return {
          success: false,
          error: `Overlay with ID '${overlayId}' not found`
        };
      }

      // 删除overlay
      this.overlays.delete(overlayId);

      // 发送事件到渲染进程
      this.emit('overlay-closed', overlayId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 显示overlay
   */
  async showOverlay(overlayId: string): Promise<OverlayActionResult> {
    return this.updateOverlay(overlayId, { visible: true });
  }

  /**
   * 隐藏overlay
   */
  async hideOverlay(overlayId: string): Promise<OverlayActionResult> {
    return this.updateOverlay(overlayId, { visible: false });
  }

  /**
   * 将overlay置于顶层
   */
  async bringToFront(overlayId: string): Promise<OverlayActionResult> {
    try {
      const overlay = this.overlays.get(overlayId);
      if (!overlay) {
        return {
          success: false,
          error: `Overlay with ID '${overlayId}' not found`
        };
      }

      const newZIndex = this.baseZIndex + (++this.zIndexCounter);
      return this.updateOverlay(overlayId, {
        style: {
          ...overlay.style,
          zIndex: newZIndex
        }
      });
    } catch (error: any) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 获取overlay列表
   */
  async listOverlays(): Promise<OverlayListResult> {
    const overlays = Array.from(this.overlays.values()).map(overlay => ({
      id: overlay.id,
      type: overlay.type,
      visible: overlay.visible,
      createdAt: overlay.createdAt,
      pluginId: overlay.pluginId,
      roomId: overlay.roomId
    }));

    return { overlays };
  }

  /**
   * 处理overlay动作
   */
  async handleOverlayAction(overlayId: string, action: string, data?: any): Promise<OverlayActionResult> {
    try {
      const overlay = this.overlays.get(overlayId);
      if (!overlay) {
        return {
          success: false,
          error: `Overlay with ID '${overlayId}' not found`
        };
      }

      // 发送动作事件
      this.emit('overlay-action', {
        overlayId,
        action,
        data,
        overlay
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 获取overlay详情
   */
  getOverlay(overlayId: string): OverlayState | undefined {
    return this.overlays.get(overlayId);
  }

  /**
   * 获取所有overlay
   */
  getAllOverlays(): OverlayState[] {
    return Array.from(this.overlays.values());
  }

  /**
   * 清除所有overlay
   */
  clearAllOverlays(): void {
    const overlayIds = Array.from(this.overlays.keys());
    this.overlays.clear();
    
    // 发送清除事件
    overlayIds.forEach(id => {
      this.emit('overlay-closed', id);
    });
  }

  /**
   * 根据插件ID清除overlay
   */
  clearOverlaysByPlugin(pluginId: string): void {
    const overlaysToRemove = Array.from(this.overlays.values())
      .filter(overlay => overlay.pluginId === pluginId);
    
    overlaysToRemove.forEach(overlay => {
      this.overlays.delete(overlay.id);
      this.emit('overlay-closed', overlay.id);
    });
  }

  /**
   * 根据房间ID清除overlay
   */
  clearOverlaysByRoom(roomId: string): void {
    const overlaysToRemove = Array.from(this.overlays.values())
      .filter(overlay => overlay.roomId === roomId);
    
    overlaysToRemove.forEach(overlay => {
      this.overlays.delete(overlay.id);
      this.emit('overlay-closed', overlay.id);
    });
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const overlays = Array.from(this.overlays.values());
    return {
      total: overlays.length,
      visible: overlays.filter(o => o.visible).length,
      hidden: overlays.filter(o => !o.visible).length,
      byType: overlays.reduce((acc, overlay) => {
        acc[overlay.type] = (acc[overlay.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPlugin: overlays.reduce((acc, overlay) => {
        if (overlay.pluginId) {
          acc[overlay.pluginId] = (acc[overlay.pluginId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * 验证overlay数据
   */
  private validateOverlay(overlay: any): overlay is OverlayState {
    return (
      overlay &&
      typeof overlay === 'object' &&
      typeof overlay.id === 'string' &&
      typeof overlay.type === 'string' &&
      typeof overlay.visible === 'boolean' &&
      typeof overlay.createdAt === 'number' &&
      typeof overlay.updatedAt === 'number' &&
      typeof overlay.zIndex === 'number'
    );
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.clearAllOverlays();
    this.removeAllListeners();
  }

  /**
   * 加载overlays
   */
  public async loadOverlays(): Promise<void> {
    try {
      const overlaysDir = path.join(app.getPath('userData'), 'overlays');
      if (!fs.existsSync(overlaysDir)) {
        fs.mkdirSync(overlaysDir, { recursive: true });
        pluginLogger.info('Created overlays directory:', overlaysDir);
      }

      const files = fs.readdirSync(overlaysDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(overlaysDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const overlay = JSON.parse(content);
            
            // 验证overlay数据
            if (this.validateOverlay(overlay)) {
              this.overlays.set(overlay.id, overlay);
              pluginLogger.info('Loaded overlay:', overlay.id);
            } else {
              pluginLogger.warn('Invalid overlay file:', file);
            }
          } catch (error: any) {
            pluginLogger.error('Failed to load overlay file:', file, error);
          }
        }
      }
      
      pluginLogger.info('Overlays loaded:', this.overlays.size.toString());
    } catch (error: any) {
      pluginLogger.error('Failed to load overlays:', error);
    }
  }
}