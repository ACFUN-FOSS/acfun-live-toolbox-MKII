import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { pluginLogger } from './PluginLogger';
import { pluginLifecycleManager } from './PluginLifecycle';

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

export interface OverlayMessagePayload {
  overlayId: string;
  event: string;
  payload?: any;
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
      console.log('[OverlayManager#createOverlay] called with options:', {
        pluginId: options.pluginId,
        type: options.type,
        id: options.id,
        style: options.style,
        position: options.position,
        size: options.size,
      });
      // 单实例策略：同一插件 + 同类型（默认 default）只允许一个实例，幂等返回现有 ID
      if (options.pluginId) {
        const targetType = options.type || 'default';
        const existing = Array.from(this.overlays.values()).find(
          (o) => o.pluginId === options.pluginId && o.type === targetType
        );
        if (existing) {
          console.log('[OverlayManager#createOverlay] singleton hit, return existing overlayId:', existing.id);
          // 返回已存在的 overlayId，避免重复创建
          return { success: true, overlayId: existing.id };
        }
      }

      // 生成唯一ID
      const overlayId = options.id || uuidv4();
      
      // 检查ID是否已存在
      if (this.overlays.has(overlayId)) {
        return {
          success: false,
          error: `Overlay with ID '${overlayId}' already exists`
        };
      }

      // 在创建前触发生命周期钩子（beforeOverlayOpen）
      try {
        if (options.pluginId) {
          await pluginLifecycleManager.executeHook('beforeOverlayOpen', {
            pluginId: options.pluginId,
            context: { pageType: 'overlay', overlayId, route: options?.type === 'html' ? 'overlay.html' : undefined }
          });
        }
      } catch (e) {
        pluginLogger.warn(
          '[OverlayManager] beforeOverlayOpen hook error',
          e instanceof Error ? e.message : String(e)
        );
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
      console.log('[OverlayManager#createOverlay] overlay created:', {
        overlayId,
        pluginId: overlayState.pluginId,
        type: overlayState.type,
        visible: overlayState.visible,
        style: overlayState.style,
        zIndex: overlayState.zIndex,
      });
      this.emit('overlay-created', overlayState);

      // 在创建后触发生命周期钩子（afterOverlayOpen）
      try {
        if (overlayState.pluginId) {
          await pluginLifecycleManager.executeHook('afterOverlayOpen', {
            pluginId: overlayState.pluginId,
            context: { pageType: 'overlay', overlayId }
          });
        }
      } catch (e) {
        pluginLogger.warn(
          '[OverlayManager] afterOverlayOpen hook error',
          e instanceof Error ? e.message : String(e)
        );
      }

      return {
        success: true,
        overlayId
      };
    } catch (error: any) {
      console.error('[OverlayManager#createOverlay] failed:', error instanceof Error ? error.message : error);
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
      console.log('[OverlayManager#updateOverlay] called:', { overlayId, updates });
      const overlay = this.overlays.get(overlayId);
      if (!overlay) {
        console.warn('[OverlayManager#updateOverlay] not found:', overlayId);
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
      console.log('[OverlayManager#updateOverlay] emitting overlay-updated:', {
        overlayId,
        pluginId: updatedOverlay.pluginId,
        type: updatedOverlay.type,
        visible: updatedOverlay.visible,
        style: updatedOverlay.style,
        updatedAt: updatedOverlay.updatedAt,
      });
      this.emit('overlay-updated', updatedOverlay);

      return { success: true };
    } catch (error: any) {
      console.error('[OverlayManager#updateOverlay] failed:', error instanceof Error ? error.message : error);
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
      console.log('[OverlayManager#closeOverlay] called:', { overlayId });
      const overlay = this.overlays.get(overlayId);
      if (!overlay) {
        console.warn('[OverlayManager#closeOverlay] not found:', overlayId);
        return {
          success: false,
          error: `Overlay with ID '${overlayId}' not found`
        };
      }

      // 删除overlay
      this.overlays.delete(overlayId);

      // 发送事件到渲染进程
      console.log('[OverlayManager#closeOverlay] emitting overlay-closed:', { overlayId });
      this.emit('overlay-closed', overlayId);

      // 触发生命周期钩子（overlayClosed）
      try {
        if (overlay.pluginId) {
          await pluginLifecycleManager.executeHook('overlayClosed', {
            pluginId: overlay.pluginId,
            context: { pageType: 'overlay', overlayId }
          });
        }
      } catch (e) {
        pluginLogger.warn(
          '[OverlayManager] overlayClosed hook error',
          e instanceof Error ? e.message : String(e)
        );
      }

      return { success: true };
    } catch (error: any) {
      console.error('[OverlayManager#closeOverlay] failed:', error instanceof Error ? error.message : error);
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
    console.log('[OverlayManager#showOverlay] called:', { overlayId });
    return this.updateOverlay(overlayId, { visible: true });
  }

  /**
   * 隐藏overlay
   */
  async hideOverlay(overlayId: string): Promise<OverlayActionResult> {
    console.log('[OverlayManager#hideOverlay] called:', { overlayId });
    return this.updateOverlay(overlayId, { visible: false });
  }

  /**
   * 将overlay置于顶层
   */
  async bringToFront(overlayId: string): Promise<OverlayActionResult> {
    try {
      console.log('[OverlayManager#bringToFront] called:', { overlayId });
      const overlay = this.overlays.get(overlayId);
      if (!overlay) {
        console.warn('[OverlayManager#bringToFront] not found:', overlayId);
        return {
          success: false,
          error: `Overlay with ID '${overlayId}' not found`
        };
      }

      const newZIndex = this.baseZIndex + (++this.zIndexCounter);
      return this.updateOverlay(overlayId, {
        style: {
          ...(overlay.style || {}),
          zIndex: newZIndex
        }
      });
    } catch (error: any) {
      console.error('[OverlayManager#bringToFront] failed:', error instanceof Error ? error.message : error);
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
    console.log('[OverlayManager#listOverlays] overlays:', overlays);

    return { overlays };
  }

  /**
   * 发送消息到指定 overlay（UI/Window -> Overlay）
   */
  async sendMessage(overlayId: string, event: string, payload?: any): Promise<OverlayActionResult> {
    try {
      console.log('[OverlayManager#sendMessage] called:', { overlayId, event, hasPayload: payload !== undefined });
      const overlay = this.overlays.get(overlayId);
      if (!overlay) {
        console.warn('[OverlayManager#sendMessage] not found:', overlayId);
        return {
          success: false,
          error: `Overlay with ID '${overlayId}' not found`
        };
      }

      const message: OverlayMessagePayload = { overlayId, event, payload };
      console.log('[OverlayManager#sendMessage] emitting overlay-message:', message);
      this.emit('overlay-message', message);
      // 消息属于状态变化语义：刷新 updatedAt 并广播更新
      try {
        const updated: OverlayState = { ...overlay, updatedAt: Date.now() };
        this.overlays.set(overlayId, updated);
        console.log('[OverlayManager#sendMessage] emitting overlay-updated due to message:', { overlayId, updatedAt: updated.updatedAt });
        this.emit('overlay-updated', updated);
      } catch {}
      return { success: true };
    } catch (error: any) {
      console.error('[OverlayManager#sendMessage] failed:', error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 处理overlay动作
   */
  async handleOverlayAction(overlayId: string, action: string, data?: any): Promise<OverlayActionResult> {
    try {
      console.log('[OverlayManager#handleOverlayAction] called:', { overlayId, action, data });
      const overlay = this.overlays.get(overlayId);
      if (!overlay) {
        console.warn('[OverlayManager#handleOverlayAction] not found:', overlayId);
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
      console.log('[OverlayManager#handleOverlayAction] emitted overlay-action:', { overlayId, action });

      // 动作语义处理：对已知控制动作执行实际状态更新；其余动作保持原语义（仅更新时间戳）
      const normalize = String(action || '').toLowerCase();
      if (normalize === 'update') {
        console.log('[OverlayManager#handleOverlayAction] normalized to update, applying updates');
        // 合并更新（样式/位置/尺寸/可见性等），并广播 overlay-updated
        const updates: Partial<OverlayState> = (data && typeof data === 'object') ? data : {};
        return await this.updateOverlay(overlayId, updates);
      }
      if (normalize === 'close') {
        console.log('[OverlayManager#handleOverlayAction] normalized to close');
        return await this.closeOverlay(overlayId);
      }
      if (normalize === 'show') {
        console.log('[OverlayManager#handleOverlayAction] normalized to show');
        return await this.showOverlay(overlayId);
      }
      if (normalize === 'hide') {
        console.log('[OverlayManager#handleOverlayAction] normalized to hide');
        return await this.hideOverlay(overlayId);
      }
      if (normalize === 'bringtofront' || normalize === 'front' || normalize === 'top') {
        console.log('[OverlayManager#handleOverlayAction] normalized to bringToFront');
        return await this.bringToFront(overlayId);
      }

      // 兜底：未知动作仅刷新时间戳以维持更新节奏
      try {
        const updated: OverlayState = { ...overlay, updatedAt: Date.now() };
        this.overlays.set(overlayId, updated);
        console.log('[OverlayManager#handleOverlayAction] unknown action, emitting overlay-updated:', { overlayId, updatedAt: updated.updatedAt });
        this.emit('overlay-updated', updated);
      } catch {}

      return { success: true };
    } catch (error: any) {
      console.error('[OverlayManager#handleOverlayAction] failed:', error instanceof Error ? error.message : error);
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
