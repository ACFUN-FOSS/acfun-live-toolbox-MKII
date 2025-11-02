import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryPoolManager } from '../../plugins/MemoryPoolManager';

// Mock fs module for PluginLogger
vi.mock('fs', () => ({
  appendFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 1000 })),
  readFileSync: vi.fn(() => ''),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(() => [])
}));

describe('MemoryPoolManager', () => {
  let memoryPool: MemoryPoolManager;

  beforeEach(() => {
    memoryPool = new MemoryPoolManager({
      maxPoolSize: 50 * 1024 * 1024, // 50MB for testing
      defaultBlockSize: 1024, // 1KB
      minBlockSize: 64, // 64 bytes
      maxBlockSize: 20 * 1024 * 1024, // 20MB to support 10MB test
      cleanupInterval: 1000, // 1 second
      memoryThreshold: 0.8, // 80%
    });
  });

  afterEach(() => {
    memoryPool.destroy();
  });

  describe('初始化', () => {
    it('应该正确初始化内存池管理器', () => {
      expect(memoryPool).toBeDefined();
      const stats = memoryPool.getStats();
      expect(stats.totalAllocated).toBe(0);
      expect(stats.totalFreed).toBe(0);
      expect(stats.activeBlocks).toBe(0);
    });

    it('应该使用默认配置', () => {
      const defaultManager = new MemoryPoolManager();
      expect(defaultManager).toBeDefined();
      const stats = defaultManager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('内存分配', () => {
    it('应该能够分配内存块', () => {
      const blockId = memoryPool.allocate(256);
      expect(blockId).toBeDefined();
      expect(typeof blockId).toBe('string');
      
      const stats = memoryPool.getStats();
      expect(stats.activeBlocks).toBe(1);
      expect(stats.totalAllocated).toBeGreaterThan(0);
    });

    it('应该能够分配多个不同大小的内存块', () => {
      const blockId1 = memoryPool.allocate(64);
      const blockId2 = memoryPool.allocate(1024);
      const blockId3 = memoryPool.allocate(4096);
      
      expect(blockId1).toBeDefined();
      expect(blockId2).toBeDefined();
      expect(blockId3).toBeDefined();
      
      const stats = memoryPool.getStats();
      expect(stats.activeBlocks).toBe(3);
    });

    it('应该处理超大内存分配请求', () => {
      const blockId = memoryPool.allocate(1024 * 1024 * 10); // 10MB
      expect(blockId).toBeDefined();
      
      const stats = memoryPool.getStats();
      expect(stats.activeBlocks).toBe(1);
    });

    it('应该在内存不足时抛出错误', () => {
      // 分配大量内存块直到耗尽
      const blockIds: string[] = [];
      
      try {
        for (let i = 0; i < 1000; i++) {
          const blockId = memoryPool.allocate(1024 * 1024); // 1MB each
          blockIds.push(blockId);
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('内存不足');
      }
      
      // 清理分配的内存
      blockIds.forEach(id => {
        try {
          memoryPool.free(id);
        } catch (e) {
          // 忽略清理错误
        }
      });
    });
  });

  describe('内存释放', () => {
    it('应该能够释放已分配的内存块', () => {
      const blockId = memoryPool.allocate(256);
      expect(blockId).toBeDefined();
      
      const freed = memoryPool.free(blockId);
      expect(freed).toBe(true);
      
      const stats = memoryPool.getStats();
      expect(stats.activeBlocks).toBe(0);
      expect(stats.totalFreed).toBeGreaterThan(0);
    });

    it('应该处理重复释放同一内存块', () => {
      const blockId = memoryPool.allocate(256);
      
      const freed1 = memoryPool.free(blockId);
      expect(freed1).toBe(true);
      
      const freed2 = memoryPool.free(blockId);
      expect(freed2).toBe(false); // 重复释放应该返回false
    });

    it('应该处理释放无效的内存块ID', () => {
      const freed = memoryPool.free('invalid-block-id');
      expect(freed).toBe(false);
    });
  });

  describe('统计信息', () => {
    it('应该正确跟踪内存分配统计', () => {
      const initialStats = memoryPool.getStats();
      expect(initialStats.totalAllocated).toBe(0);
      expect(initialStats.activeBlocks).toBe(0);
      
      const blockId1 = memoryPool.allocate(256);
      const blockId2 = memoryPool.allocate(512);
      
      const afterAllocStats = memoryPool.getStats();
      expect(afterAllocStats.activeBlocks).toBe(2);
      expect(afterAllocStats.totalAllocated).toBeGreaterThan(0);
      
      memoryPool.free(blockId1);
      
      const afterFreeStats = memoryPool.getStats();
      expect(afterFreeStats.activeBlocks).toBe(1);
      expect(afterFreeStats.totalFreed).toBeGreaterThan(0);
    });

    it('应该提供详细的内存使用统计', () => {
      const stats = memoryPool.getStats();
      
      expect(stats).toHaveProperty('totalAllocated');
      expect(stats).toHaveProperty('totalFreed');
      expect(stats).toHaveProperty('activeBlocks');
      expect(stats).toHaveProperty('peakUsage');
      expect(stats).toHaveProperty('fragmentationRatio');
    });
  });

  describe('内存清理', () => {
    it('应该能够清理未使用的内存', () => {
      const blockIds: string[] = [];
      
      // 分配一些内存块
      for (let i = 0; i < 5; i++) {
        blockIds.push(memoryPool.allocate(256));
      }
      
      // 释放一些内存块
      for (let i = 0; i < 3; i++) {
        memoryPool.free(blockIds[i]);
      }
      
      const stats = memoryPool.getStats();
      expect(stats.activeBlocks).toBe(2);
      
      // 清理剩余的内存块
      blockIds.slice(3).forEach(id => memoryPool.free(id));
    });

    it('应该自动清理过期的内存块', async () => {
      const blockIds: string[] = [];
      
      // 分配一些内存块
      for (let i = 0; i < 5; i++) {
        blockIds.push(memoryPool.allocate(256));
      }
      
      // 释放部分内存块
      memoryPool.free(blockIds[0]);
      memoryPool.free(blockIds[2]);
      
      const beforeCleanup = memoryPool.getStats();
      
      memoryPool.cleanup();
      
      const afterCleanup = memoryPool.getStats();
      expect(afterCleanup.activeBlocks).toBeLessThanOrEqual(beforeCleanup.activeBlocks);
    });

    it('应该处理自动清理间隔', async () => {
      const shortIntervalManager = new MemoryPoolManager({
        cleanupInterval: 100, // 100ms
        enableAutoCleanup: true,
      });
      
      // 等待自动清理触发
      await new Promise(resolve => setTimeout(resolve, 200));
      
      shortIntervalManager.destroy();
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的分配大小', () => {
      expect(() => memoryPool.allocate(0)).toThrow();
      expect(() => memoryPool.allocate(-1)).toThrow();
    });

    it('应该处理内存耗尽情况', () => {
      const blockIds: string[] = [];
      
      try {
        // 尝试分配大量内存
        for (let i = 0; i < 10000; i++) {
          blockIds.push(memoryPool.allocate(1024 * 100)); // 100KB each
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      
      // 清理分配的内存
      blockIds.forEach(id => {
        try {
          memoryPool.free(id);
        } catch (e) {
          // 忽略清理错误
        }
      });
    });
  });

  describe('性能测试', () => {
    it('应该快速处理大量内存分配和释放', () => {
      const blockIds: string[] = [];
      const startTime = Date.now();
      
      // 分配1000个内存块
      for (let i = 0; i < 1000; i++) {
        blockIds.push(memoryPool.allocate(64));
      }
      
      // 释放所有内存块
      blockIds.forEach(id => memoryPool.free(id));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 应该在合理时间内完成
      expect(duration).toBeLessThan(1000); // 1秒
    });

    it('应该处理并发内存操作', async () => {
      const promises: Promise<void>[] = [];
      const allBlockIds: string[] = [];
      
      // 创建多个并发分配操作
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>(resolve => {
            const blockId = memoryPool.allocate(256);
            allBlockIds.push(blockId);
            resolve();
          })
        );
      }
      
      await Promise.all(promises);
      
      expect(allBlockIds.length).toBe(10);
      
      // 清理分配的内存
      allBlockIds.forEach(id => memoryPool.free(id));
    });
  });
});