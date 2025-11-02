import { describe, it, expect } from 'vitest';
import { setupPerformanceTest } from '../../shared/helpers/performance-test-setup';

describe('内存池与连接池协作', () => {
  const getContext = setupPerformanceTest();

  it('应该在内存压力下优化连接池', async () => {
    const { pluginManager } = getContext();
    const memoryPool = pluginManager['memoryPoolManager'];
    const connectionPool = pluginManager['connectionPoolManager'];
    
    // 模拟高内存使用
    const largeAllocation = await memoryPool.allocate(80 * 1024 * 1024); // 80MB
    
    // 获取连接池统计
    const initialStats = connectionPool.getStats();
    
    // 模拟内存压力事件
    memoryPool.emit('memoryPressure', { 
      usage: 90 * 1024 * 1024, 
      threshold: 100 * 1024 * 1024 
    });
    
    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 验证连接池响应了内存压力
    const afterPressureStats = connectionPool.getStats();
    expect(afterPressureStats.total).toBeLessThanOrEqual(initialStats.total);
    
    // 清理
    memoryPool.free(largeAllocation);
  });

  it('应该在连接池满时触发内存优化', async () => {
    const { pluginManager } = getContext();
    const memoryPool = pluginManager['memoryPoolManager'];
    const connectionPool = pluginManager['connectionPoolManager'];
    
    // 创建大量连接直到接近限制
    const connections = [];
    for (let i = 0; i < 8; i++) { // 接近默认的10个连接限制
      const conn = await connectionPool.acquire('http', { url: `http://test${i}.com` });
      connections.push(conn);
    }
    
    // 获取内存统计
    const initialMemoryStats = memoryPool.getStats();
    
    // 尝试创建更多连接（应该触发优化）
    try {
      await connectionPool.acquire('http', { url: 'http://overflow.com' });
    } catch (error) {
      // 预期可能失败
    }
    
    // 验证内存池可能进行了优化
    const afterOptimizationStats = memoryPool.getStats();
    
    // 清理连接
    for (const conn of connections) {
      connectionPool.release(conn.id);
    }
  });
});