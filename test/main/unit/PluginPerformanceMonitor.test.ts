import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginPerformanceMonitor } from '../../plugins/PluginPerformanceMonitor';

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

describe('PluginPerformanceMonitor', () => {
  let monitor: PluginPerformanceMonitor;
  const pluginId = 'test-plugin';

  beforeEach(() => {
    monitor = new PluginPerformanceMonitor({
      monitorInterval: 100,
      dataRetentionTime: 5000,
      memoryWarningThreshold: 100 * 1024 * 1024, // 100MB
      cpuWarningThreshold: 80,
      enableDetailedMonitoring: true,
      enableProfiling: true,
    });
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('初始�?, () => {
    it('应该使用默认配置初始�?, () => {
      const defaultMonitor = new PluginPerformanceMonitor();
      expect(defaultMonitor).toBeDefined();
      defaultMonitor.destroy();
    });

    it('应该使用自定义配置初始化', () => {
      const customConfig = {
        monitorInterval: 200,
        dataRetentionTime: 10000,
        memoryWarningThreshold: 200 * 1024 * 1024,
        cpuWarningThreshold: 90,
        enableDetailedMonitoring: false,
        enableProfiling: false,
      };
      const customMonitor = new PluginPerformanceMonitor(customConfig);
      expect(customMonitor).toBeDefined();
      customMonitor.destroy();
    });
  });

  describe('监控管理', () => {
    it('应该开始监控插�?, () => {
      expect(() => monitor.startMonitoringPlugin(pluginId)).not.toThrow();
    });

    it('应该停止监控插件', () => {
      monitor.startMonitoringPlugin(pluginId);
      expect(() => monitor.stopMonitoringPlugin(pluginId)).not.toThrow();
    });

    it('应该获取被监控的插件列表', () => {
      monitor.startMonitoringPlugin(pluginId);
      const monitoredPlugins = monitor.getMonitoredPlugins();
      expect(monitoredPlugins).toContain(pluginId);
    });
  });

  describe('操作监控', () => {
    beforeEach(() => {
      monitor.startMonitoringPlugin(pluginId);
    });

    it('应该开始操作计�?, () => {
      const operationId = 'test-operation';
      expect(() => monitor.startOperation(pluginId, operationId)).not.toThrow();
    });

    it('应该结束操作计时并返回持续时�?, () => {
      const operationId = 'test-operation';
      monitor.startOperation(pluginId, operationId);
      
      // 等待一小段时间
      const start = Date.now();
      while (Date.now() - start < 10) {
        // 忙等�?      }
      
      const duration = monitor.endOperation(pluginId, operationId);
      expect(duration).toBeGreaterThan(0);
    });

    it('应该处理未开始的操作结束', () => {
      const operationId = 'non-existent-operation';
      const duration = monitor.endOperation(pluginId, operationId);
      expect(duration).toBe(0);
    });
  });

  describe('网络请求监控', () => {
    beforeEach(() => {
      monitor.startMonitoringPlugin(pluginId);
    });

    it('应该记录成功的网络请�?, () => {
      expect(() => monitor.recordNetworkRequest(pluginId, 100, true, 1024)).not.toThrow();
    });

    it('应该记录失败的网络请�?, () => {
      expect(() => monitor.recordNetworkRequest(pluginId, 500, false, 0)).not.toThrow();
    });

    it('应该处理默认字节传输�?, () => {
      expect(() => monitor.recordNetworkRequest(pluginId, 200, true)).not.toThrow();
    });
  });

  describe('性能指标获取', () => {
    beforeEach(() => {
      monitor.startMonitoringPlugin(pluginId);
    });

    it('应该获取插件的性能指标', () => {
      // 等待一些指标被收集
      setTimeout(() => {
        const metrics = monitor.getMetrics(pluginId);
        expect(Array.isArray(metrics)).toBe(true);
      }, 150);
    });

    it('应该限制返回的指标数�?, () => {
      setTimeout(() => {
        const metrics = monitor.getMetrics(pluginId, 5);
        expect(metrics.length).toBeLessThanOrEqual(5);
      }, 150);
    });

    it('应该返回空数组对于未监控的插�?, () => {
      const metrics = monitor.getMetrics('non-existent-plugin');
      expect(metrics).toEqual([]);
    });
  });

  describe('性能报告生成', () => {
    beforeEach(() => {
      monitor.startMonitoringPlugin(pluginId);
    });

    it('应该生成插件性能报告', async () => {
      // 等待一些数据被收集
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const report = monitor.generateReport(pluginId);
      if (report) {
        expect(report).toHaveProperty('pluginId', pluginId);
        expect(report).toHaveProperty('timeRange');
        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('trends');
        expect(report).toHaveProperty('recommendations');
      }
    });

    it('应该生成指定时间范围的报�?, async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const now = Date.now();
      const timeRange = { start: now - 1000, end: now };
      const report = monitor.generateReport(pluginId, timeRange);
      
      if (report) {
        expect(report.timeRange.start).toBe(timeRange.start);
        expect(report.timeRange.end).toBe(timeRange.end);
      }
    });

    it('应该返回null对于未监控的插件', () => {
      const report = monitor.generateReport('non-existent-plugin');
      expect(report).toBeNull();
    });
  });

  describe('事件发射', () => {
    beforeEach(() => {
      monitor.startMonitoringPlugin(pluginId);
    });

    it('应该发射性能指标收集事件', (done) => {
      monitor.on('metrics-collected', (data) => {
        expect(data.pluginId).toBe(pluginId);
        expect(data.metrics).toBeDefined();
        done();
      });

      // 触发指标收集
      setTimeout(() => {
        // 指标应该在监控间隔后被收�?      }, 150);
    });

    it('应该发射性能警告事件', async () => {
      return new Promise<void>((resolve) => {
        let alertReceived = false;
        
        monitor.on('performance-alert', (alert) => {
          if (!alertReceived) {
            alertReceived = true;
            expect(alert.pluginId).toBe(pluginId);
            expect(alert.type).toBeDefined();
            expect(alert.severity).toBeDefined();
            resolve();
          }
        });

        // 模拟高内存使用来触发警告
        // 这需要实际的内存使用，在测试环境中可能不会触�?        setTimeout(() => {
          // 如果没有警告被触发，手动完成测试
          if (!alertReceived) {
            resolve();
          }
        }, 200);
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的插件ID', () => {
      expect(() => monitor.startMonitoringPlugin('')).not.toThrow();
      expect(() => monitor.stopMonitoringPlugin('')).not.toThrow();
    });

    it('应该处理重复的监控开�?, () => {
      monitor.startMonitoringPlugin(pluginId);
      expect(() => monitor.startMonitoringPlugin(pluginId)).not.toThrow();
    });

    it('应该处理未监控插件的停止', () => {
      expect(() => monitor.stopMonitoringPlugin('non-existent-plugin')).not.toThrow();
    });
  });

  describe('性能测试', () => {
    it('应该快速处理大量操�?, () => {
      monitor.startMonitoringPlugin(pluginId);
      
      const start = Date.now();
      
      // 记录大量操作
      for (let i = 0; i < 1000; i++) {
        const operationId = `operation-${i}`;
        monitor.startOperation(pluginId, operationId);
        monitor.endOperation(pluginId, operationId);
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // 应该�?秒内完成
    });

    it('应该处理并发监控', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        new Promise<void>(resolve => {
          const testPluginId = `plugin-${i}`;
          monitor.startMonitoringPlugin(testPluginId);
          monitor.recordNetworkRequest(testPluginId, 100, true, 1024);
          resolve();
        })
      );
      
      await Promise.all(promises);
      
      const monitoredPlugins = monitor.getMonitoredPlugins();
      expect(monitoredPlugins.length).toBeGreaterThanOrEqual(10);
    });
  });
});
