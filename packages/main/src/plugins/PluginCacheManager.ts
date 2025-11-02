/**
 * 插件缓存管理器 - 为插件提供高效的数据缓存机制
 */

import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { pluginLogger } from './PluginLogger';
import * as crypto from 'crypto';
import * as zlib from 'zlib';

export interface CacheConfig {
  /** 最大缓存大小 (字节) */
  maxCacheSize: number;
  /** 默认过期时间 (毫秒) */
  defaultTtl: number;
  /** 缓存清理间隔 (毫秒) */
  cleanupInterval: number;
  /** 最大缓存项数量 */
  maxItems: number;
  /** 启用LRU淘汰策略 */
  enableLru: boolean;
  /** 启用压缩 */
  enableCompression: boolean;
}

export interface CacheItem<T = any> {
  key: string;
  value: T;
  size: number;
  createdAt: number;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
  pluginId?: string;
  compressed: boolean;
  checksum: string;
}

export interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  expiredCount: number;
  itemsByPlugin: Record<string, number>;
  sizeByPlugin: Record<string, number>;
}

export interface CacheEvents {
  'cache-hit': { key: string; pluginId?: string };
  'cache-miss': { key: string; pluginId?: string };
  'cache-set': { key: string; size: number; pluginId?: string };
  'cache-evicted': { key: string; reason: 'lru' | 'size' | 'expired'; pluginId?: string };
  'cache-cleared': { pluginId?: string; itemCount: number };
}

export class PluginCacheManager extends TypedEventEmitter<CacheEvents> {
  private config: CacheConfig;
  private cache: Map<string, CacheItem> = new Map();
  private accessOrder: string[] = []; // LRU tracking
  private cleanupTimer?: NodeJS.Timeout;
  private stats: CacheStats;

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    
    this.config = {
      maxCacheSize: config.maxCacheSize || 128 * 1024 * 1024, // 128MB
      defaultTtl: config.defaultTtl || 3600000, // 1 hour
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
      maxItems: config.maxItems || 10000,
      enableLru: config.enableLru !== false,
      enableCompression: config.enableCompression || false,
    };

    this.stats = {
      totalItems: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictionCount: 0,
      expiredCount: 0,
      itemsByPlugin: {},
      sizeByPlugin: {}
    };

    this.startCleanupTimer();
    pluginLogger.info('PluginCacheManager initialized', undefined, { config: this.config });
  }

  /**
   * 设置缓存项
   */
  public set<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      pluginId?: string;
      compress?: boolean;
    } = {}
  ): boolean {
    try {
      const ttl = options.ttl || this.config.defaultTtl;
      const now = Date.now();
      const expiresAt = now + ttl;
      
      // 序列化值
      const serialized = JSON.stringify(value);
      let finalValue = serialized;
      let compressed = false;
      
      // 压缩处理
      if (options.compress || this.config.enableCompression) {
        try {
          finalValue = zlib.gzipSync(serialized).toString('base64');
          compressed = true;
        } catch (error) {
          pluginLogger.warn('Compression failed, using uncompressed value', options.pluginId, { key });
        }
      }
      
      const size = Buffer.byteLength(finalValue, 'utf8');
      const checksum = crypto.createHash('md5').update(finalValue).digest('hex');
      
      // 检查缓存大小限制
      if (this.stats.totalSize + size > this.config.maxCacheSize) {
        this.evictItems(size);
      }
      
      // 检查项目数量限制
      if (this.cache.size >= this.config.maxItems) {
        this.evictLeastRecentlyUsed();
      }
      
      // 如果key已存在，先移除旧项
      if (this.cache.has(key)) {
        this.delete(key);
      }
      
      const item: CacheItem<T> = {
        key,
        value: finalValue as any,
        size,
        createdAt: now,
        expiresAt,
        lastAccessed: now,
        accessCount: 0,
        pluginId: options.pluginId,
        compressed,
        checksum
      };
      
      this.cache.set(key, item);
      
      // 更新LRU顺序
      if (this.config.enableLru) {
        this.updateAccessOrder(key);
      }
      
      // 更新统计信息
      this.updateStatsOnSet(item);
      
      this.emit('cache-set', { key, size, pluginId: options.pluginId });
      
      pluginLogger.debug('Cache item set', options.pluginId, { 
        key, 
        size, 
        ttl, 
        compressed 
      });
      
      return true;
    } catch (error) {
      pluginLogger.error('Failed to set cache item', options.pluginId, error as Error);
      return false;
    }
  }

  /**
   * 获取缓存项
   */
  public get<T>(key: string, pluginId?: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.missCount++;
      this.updateHitRate();
      this.emit('cache-miss', { key, pluginId });
      
      pluginLogger.debug('Cache miss', pluginId, { key });
      return null;
    }
    
    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      this.stats.missCount++;
      this.stats.expiredCount++;
      this.updateHitRate();
      this.emit('cache-miss', { key, pluginId });
      
      pluginLogger.debug('Cache item expired', pluginId, { key });
      return null;
    }
    
    // 更新访问信息
    item.lastAccessed = Date.now();
    item.accessCount++;
    
    // 更新LRU顺序
    if (this.config.enableLru) {
      this.updateAccessOrder(key);
    }
    
    // 反序列化值
    try {
      let value = item.value as string;
      
      // 解压缩
      if (item.compressed) {
        value = zlib.gunzipSync(Buffer.from(value, 'base64')).toString();
      }
      
      const result = JSON.parse(value);
      
      this.stats.hitCount++;
      this.updateHitRate();
      this.emit('cache-hit', { key, pluginId });
      
      pluginLogger.debug('Cache hit', pluginId, { key, accessCount: item.accessCount });
      
      return result;
    } catch (error) {
      pluginLogger.error('Failed to deserialize cache item', pluginId, error as Error);
      this.delete(key); // 删除损坏的缓存项
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * 删除缓存项
   */
  public delete(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }
    
    this.cache.delete(key);
    
    // 从LRU顺序中移除
    if (this.config.enableLru) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    
    // 更新统计信息
    this.updateStatsOnDelete(item);
    
    pluginLogger.debug('Cache item deleted', item.pluginId, { key, size: item.size });
    
    return true;
  }

  /**
   * 检查缓存项是否存在
   */
  public has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }
    
    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 清空缓存
   */
  public clear(pluginId?: string): number {
    let clearedCount = 0;
    
    if (pluginId) {
      // 只清空特定插件的缓存
      for (const [key, item] of this.cache) {
        if (item.pluginId === pluginId) {
          this.delete(key);
          clearedCount++;
        }
      }
    } else {
      // 清空所有缓存
      clearedCount = this.cache.size;
      this.cache.clear();
      this.accessOrder = [];
      this.resetStats();
    }
    
    this.emit('cache-cleared', { pluginId, itemCount: clearedCount });
    
    pluginLogger.info('Cache cleared', pluginId, { clearedCount });
    
    return clearedCount;
  }

  /**
   * 更新访问顺序 (LRU)
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * 淘汰最少使用的项
   */
  private evictLeastRecentlyUsed(): void {
    if (!this.config.enableLru || this.accessOrder.length === 0) {
      // 如果没有启用LRU，随机淘汰一个项
      const keys = Array.from(this.cache.keys());
      if (keys.length > 0) {
        const key = keys[0];
        const item = this.cache.get(key);
        this.delete(key);
        this.stats.evictionCount++;
        this.emit('cache-evicted', { 
          key, 
          reason: 'lru', 
          pluginId: item?.pluginId 
        });
      }
      return;
    }
    
    const key = this.accessOrder[0];
    const item = this.cache.get(key);
    this.delete(key);
    this.stats.evictionCount++;
    this.emit('cache-evicted', { 
      key, 
      reason: 'lru', 
      pluginId: item?.pluginId 
    });
    
    pluginLogger.debug('Cache item evicted (LRU)', item?.pluginId, { key });
  }

  /**
   * 淘汰项目以释放空间
   */
  private evictItems(requiredSize: number): void {
    let freedSize = 0;
    const keysToEvict: string[] = [];
    
    // 按访问时间排序，优先淘汰最久未访问的项
    const sortedItems = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    for (const [key, item] of sortedItems) {
      keysToEvict.push(key);
      freedSize += item.size;
      
      if (freedSize >= requiredSize) {
        break;
      }
    }
    
    // 淘汰选中的项
    for (const key of keysToEvict) {
      const item = this.cache.get(key);
      this.delete(key);
      this.stats.evictionCount++;
      this.emit('cache-evicted', { 
        key, 
        reason: 'size', 
        pluginId: item?.pluginId 
      });
    }
    
    pluginLogger.debug('Cache items evicted for size', undefined, { 
      evictedCount: keysToEvict.length, 
      freedSize 
    });
  }

  /**
   * 清理过期项
   */
  public cleanupExpired(): number {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, item] of this.cache) {
      if (now > item.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      const item = this.cache.get(key);
      this.delete(key);
      this.stats.expiredCount++;
      this.emit('cache-evicted', { 
        key, 
        reason: 'expired', 
        pluginId: item?.pluginId 
      });
    }
    
    if (expiredKeys.length > 0) {
      pluginLogger.debug('Expired cache items cleaned up', undefined, { 
        expiredCount: expiredKeys.length 
      });
    }
    
    return expiredKeys.length;
  }

  /**
   * 更新设置统计信息
   */
  private updateStatsOnSet(item: CacheItem): void {
    this.stats.totalItems++;
    this.stats.totalSize += item.size;
    
    if (item.pluginId) {
      this.stats.itemsByPlugin[item.pluginId] = (this.stats.itemsByPlugin[item.pluginId] || 0) + 1;
      this.stats.sizeByPlugin[item.pluginId] = (this.stats.sizeByPlugin[item.pluginId] || 0) + item.size;
    }
  }

  /**
   * 更新删除统计信息
   */
  private updateStatsOnDelete(item: CacheItem): void {
    this.stats.totalItems--;
    this.stats.totalSize -= item.size;
    
    if (item.pluginId) {
      this.stats.itemsByPlugin[item.pluginId] = Math.max(0, (this.stats.itemsByPlugin[item.pluginId] || 0) - 1);
      this.stats.sizeByPlugin[item.pluginId] = Math.max(0, (this.stats.sizeByPlugin[item.pluginId] || 0) - item.size);
      
      if (this.stats.itemsByPlugin[item.pluginId] === 0) {
        delete this.stats.itemsByPlugin[item.pluginId];
        delete this.stats.sizeByPlugin[item.pluginId];
      }
    }
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  /**
   * 重置统计信息
   */
  private resetStats(): void {
    this.stats = {
      totalItems: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictionCount: 0,
      expiredCount: 0,
      itemsByPlugin: {},
      sizeByPlugin: {}
    };
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存项信息
   */
  public getItemInfo(key: string): Partial<CacheItem> | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }
    
    return {
      key: item.key,
      size: item.size,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
      lastAccessed: item.lastAccessed,
      accessCount: item.accessCount,
      pluginId: item.pluginId,
      compressed: item.compressed
    };
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  /**
   * 停止清理定时器
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * 销毁缓存管理器
   */
  public destroy(): void {
    this.stopCleanupTimer();
    this.clear();
    pluginLogger.info('PluginCacheManager destroyed');
  }
}

// 全局缓存管理器实例
export const pluginCacheManager = new PluginCacheManager();