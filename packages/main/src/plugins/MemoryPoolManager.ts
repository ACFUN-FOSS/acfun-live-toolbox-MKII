/**
 * 内存池管理器 - 为插件操作提供高效的内存分配
 */

import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { pluginLogger } from './PluginLogger';

export interface MemoryPoolConfig {
  /** 最大池大小 (字节) */
  maxPoolSize: number;
  /** 单个块的默认大小 (字节) */
  defaultBlockSize: number;
  /** 最小块大小 (字节) */
  minBlockSize: number;
  /** 最大块大小 (字节) */
  maxBlockSize: number;
  /** 内存清理间隔 (毫秒) */
  cleanupInterval: number;
  /** 内存使用阈值 (0-1) */
  memoryThreshold: number;
}

export interface MemoryBlock {
  id: string;
  buffer: Buffer;
  size: number;
  inUse: boolean;
  lastUsed: number;
  pluginId?: string;
}

export interface MemoryPoolStats {
  totalAllocated: number;
  totalFreed: number;
  activeBlocks: number;
  availableBlocks: number;
  fragmentationRatio: number;
  totalSize: number;
  usedSize: number;
  freeSize: number;
  peakUsage: number;
}

export interface MemoryPoolEvents {
  'memory-allocated': { blockId: string; size: number; pluginId?: string };
  'memory-freed': { blockId: string; size: number; pluginId?: string };
  'memory-threshold-exceeded': { usage: number; threshold: number };
  'memory-cleanup': { freedBlocks: number; freedSize: number };
}

export class MemoryPoolManager extends TypedEventEmitter<MemoryPoolEvents> {
  private config: MemoryPoolConfig;
  private memoryBlocks: Map<string, MemoryBlock> = new Map();
  private freeBlocks: Map<number, Set<string>> = new Map(); // size -> block IDs
  private bufferToBlockId: Map<Buffer, string> = new Map(); // buffer -> block ID
  private cleanupTimer?: NodeJS.Timeout;
  private nextBlockId = 1;
  private totalAllocatedBytes = 0;
  private totalFreedBytes = 0;
  private peakUsageBytes = 0;

  constructor(config: Partial<MemoryPoolConfig> = {}) {
    super();
    
    this.config = {
      maxPoolSize: config.maxPoolSize || 256 * 1024 * 1024, // 256MB
      defaultBlockSize: config.defaultBlockSize || 64 * 1024, // 64KB
      minBlockSize: config.minBlockSize || 4 * 1024, // 4KB
      maxBlockSize: config.maxBlockSize || 16 * 1024 * 1024, // 16MB
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
      memoryThreshold: config.memoryThreshold || 0.8, // 80%
    };

    this.startCleanupTimer();
    pluginLogger.info('MemoryPoolManager initialized', undefined, { config: this.config });
  }

  /**
   * 分配内存块
   */
  public allocate(size: number, pluginId?: string): string | null {
    // 验证参数
    if (size <= 0) {
      throw new Error(`Invalid allocation size: ${size}. Size must be greater than 0.`);
    }
    
    // 验证大小限制
    if (size < this.config.minBlockSize || size > this.config.maxBlockSize) {
      pluginLogger.warn('Memory allocation size out of bounds', pluginId, { 
        size, 
        minSize: this.config.minBlockSize, 
        maxSize: this.config.maxBlockSize 
      });
      return null;
    }

    // 检查内存使用阈值
    const stats = this.getStats();
    if (stats.usedSize + size > this.config.maxPoolSize * this.config.memoryThreshold) {
      this.emit('memory-threshold-exceeded', { 
        usage: (stats.usedSize + size) / this.config.maxPoolSize, 
        threshold: this.config.memoryThreshold 
      });
      
      // 尝试清理内存
      this.cleanup();
      
      // 重新检查
      const newStats = this.getStats();
      if (newStats.usedSize + size > this.config.maxPoolSize) {
        pluginLogger.warn('Memory pool exhausted', pluginId, { 
          requestedSize: size, 
          availableSize: this.config.maxPoolSize - newStats.usedSize 
        });
        return null;
      }
    }

    // 尝试重用现有块
    const reusedBlock = this.findReusableBlock(size);
    if (reusedBlock) {
      reusedBlock.inUse = true;
      reusedBlock.lastUsed = Date.now();
      reusedBlock.pluginId = pluginId;
      
      // 更新统计
      this.totalAllocatedBytes += reusedBlock.size;
      this.updatePeakUsage();
      
      this.emit('memory-allocated', { 
        blockId: reusedBlock.id, 
        size: reusedBlock.size, 
        pluginId 
      });
      
      pluginLogger.debug('Memory block reused', pluginId, { 
        blockId: reusedBlock.id, 
        size: reusedBlock.size 
      });
      
      const returnBuffer = reusedBlock.buffer.subarray(0, size);
      this.bufferToBlockId.set(returnBuffer, reusedBlock.id);
      return reusedBlock.id;
    }

    // 创建新块
    const blockId = `block_${this.nextBlockId++}`;
    const buffer = Buffer.allocUnsafe(size);
    
    const block: MemoryBlock = {
      id: blockId,
      buffer,
      size,
      inUse: true,
      lastUsed: Date.now(),
      pluginId
    };

    this.memoryBlocks.set(blockId, block);
    this.bufferToBlockId.set(buffer, blockId);
    
    // 更新统计
    this.totalAllocatedBytes += size;
    this.updatePeakUsage();
    
    this.emit('memory-allocated', { blockId, size, pluginId });
    
    pluginLogger.debug('New memory block allocated', pluginId, { blockId, size });
    
    return blockId;
  }

  /**
   * 释放内存块
   */
  public free(blockId: string, pluginId?: string): boolean {
    const block = this.memoryBlocks.get(blockId);
    if (!block) {
      pluginLogger.warn('Memory block not found', pluginId, { blockId });
      return false;
    }

    if (!block.inUse) {
      pluginLogger.warn('Attempting to free already freed memory block', pluginId, { blockId });
      return false;
    }

    block.inUse = false;
    block.lastUsed = Date.now();
    block.pluginId = undefined;

    // 更新统计
    this.totalFreedBytes += block.size;

    // 从映射中移除相关的buffer
    for (const [buffer, id] of this.bufferToBlockId.entries()) {
      if (id === blockId) {
        this.bufferToBlockId.delete(buffer);
        break;
      }
    }

    // 添加到空闲块列表
    if (!this.freeBlocks.has(block.size)) {
      this.freeBlocks.set(block.size, new Set());
    }
    this.freeBlocks.get(block.size)!.add(blockId);

    this.emit('memory-freed', { blockId, size: block.size, pluginId });
    
    pluginLogger.debug('Memory block freed', pluginId, { blockId, size: block.size });
    
    return true;
  }

  /**
   * 获取内存块的Buffer对象
   */
  public getBuffer(blockId: string): Buffer | null {
    const block = this.memoryBlocks.get(blockId);
    if (!block || !block.inUse) {
      return null;
    }
    return block.buffer;
  }

  /**
   * 更新峰值内存使用量
   */
  private updatePeakUsage(): void {
    let currentUsage = 0;
    for (const block of this.memoryBlocks.values()) {
      if (block.inUse) {
        currentUsage += block.size;
      }
    }
    this.peakUsageBytes = Math.max(this.peakUsageBytes, currentUsage);
  }

  /**
   * 查找可重用的内存块
   */
  private findReusableBlock(size: number): MemoryBlock | null {
    // 查找完全匹配的块
    const exactSizeBlocks = this.freeBlocks.get(size);
    if (exactSizeBlocks && exactSizeBlocks.size > 0) {
      const blockId = exactSizeBlocks.values().next().value;
      if (blockId) {
        exactSizeBlocks.delete(blockId);
        if (exactSizeBlocks.size === 0) {
          this.freeBlocks.delete(size);
        }
        const block = this.memoryBlocks.get(blockId);
        if (block) {
          return block;
        }
      }
    }

    // 查找稍大的块
    for (const [blockSize, blockIds] of this.freeBlocks) {
      if (blockSize >= size && blockSize <= size * 2) { // 最多2倍大小
        const blockId = blockIds.values().next().value;
        if (blockId) {
          blockIds.delete(blockId);
          if (blockIds.size === 0) {
            this.freeBlocks.delete(blockSize);
          }
          const block = this.memoryBlocks.get(blockId);
          if (block) {
            return block;
          }
        }
      }
    }

    return null;
  }

  /**
   * 清理未使用的内存块
   */
  public cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟
    let freedBlocks = 0;
    let freedSize = 0;

    for (const [blockId, block] of this.memoryBlocks) {
      if (!block.inUse && (now - block.lastUsed) > maxAge) {
        // 从空闲块列表中移除
        const sizeBlocks = this.freeBlocks.get(block.size);
        if (sizeBlocks) {
          sizeBlocks.delete(blockId);
          if (sizeBlocks.size === 0) {
            this.freeBlocks.delete(block.size);
          }
        }

        // 删除内存块
        this.memoryBlocks.delete(blockId);
        freedBlocks++;
        freedSize += block.size;

        pluginLogger.debug('Memory block cleaned up', undefined, { blockId, size: block.size });
      }
    }

    if (freedBlocks > 0) {
      this.emit('memory-cleanup', { freedBlocks, freedSize });
      pluginLogger.info('Memory cleanup completed', undefined, { freedBlocks, freedSize });
    }
  }

  /**
   * 获取内存池统计信息
   */
  public getStats(): MemoryPoolStats {
    let totalSize = 0;
    let usedSize = 0;
    let blocksInUse = 0;

    for (const block of this.memoryBlocks.values()) {
      totalSize += block.size;
      if (block.inUse) {
        usedSize += block.size;
        blocksInUse++;
      }
    }

    const freeSize = totalSize - usedSize;
    const blocksTotal = this.memoryBlocks.size;
    const blocksFree = blocksTotal - blocksInUse;
    const fragmentationRatio = blocksFree > 0 ? freeSize / (blocksFree * this.config.defaultBlockSize) : 0;

    return {
      totalAllocated: this.totalAllocatedBytes,
      totalFreed: this.totalFreedBytes,
      activeBlocks: blocksInUse,
      availableBlocks: blocksFree,
      fragmentationRatio,
      totalSize,
      usedSize,
      freeSize,
      peakUsage: this.peakUsageBytes
    };
  }

  /**
   * 释放插件的所有内存块
   */
  public freePluginMemory(pluginId: string): void {
    let freedBlocks = 0;
    let freedSize = 0;

    for (const [blockId, block] of this.memoryBlocks) {
      if (block.pluginId === pluginId && block.inUse) {
        block.inUse = false;
        block.lastUsed = Date.now();
        block.pluginId = undefined;

        // 添加到空闲块列表
        if (!this.freeBlocks.has(block.size)) {
          this.freeBlocks.set(block.size, new Set());
        }
        this.freeBlocks.get(block.size)!.add(blockId);

        freedBlocks++;
        freedSize += block.size;

        this.emit('memory-freed', { blockId, size: block.size, pluginId });
      }
    }

    if (freedBlocks > 0) {
      pluginLogger.info('Plugin memory freed', pluginId, { freedBlocks, freedSize });
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
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
   * 销毁内存池
   */
  public destroy(): void {
    this.stopCleanupTimer();
    
    // 清理所有内存块
    this.memoryBlocks.clear();
    this.freeBlocks.clear();
    this.bufferToBlockId.clear();
    
    pluginLogger.info('MemoryPoolManager destroyed');
  }
}

// 全局内存池实例
export const memoryPoolManager = new MemoryPoolManager();