import { beforeEach, afterEach } from 'vitest';
import { PluginManager } from '../../../packages/main/plugins/PluginManager';
import path from 'path';
import fs from 'fs/promises';

export interface PerformanceTestContext {
  pluginManager: PluginManager;
  testPluginDir: string;
  testPluginId: string;
}

export function setupPerformanceTest() {
  let context: PerformanceTestContext;

  beforeEach(async () => {
    // 创建测试插件目录
    const testPluginDir = path.join(process.cwd(), 'test-plugins', 'performance-test-plugin');
    const testPluginId = 'performance-test-plugin';
    
    await fs.mkdir(testPluginDir, { recursive: true });
    
    // 创建测试插件的manifest.json
    const manifest = {
      id: testPluginId,
      name: 'Performance Test Plugin',
      version: '1.0.0',
      description: 'A test plugin for performance optimization',
      main: 'index.js',
      permissions: ['network', 'storage'],
      dependencies: []
    };
    
    await fs.writeFile(
      path.join(testPluginDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // 创建测试插件的主文件
    const pluginCode = `
      class PerformanceTestPlugin {
        constructor() {
          this.memoryUsage = 0;
          this.requestCount = 0;
        }
        
        async initialize() {
          console.log('Performance test plugin initialized');
          return true;
        }
        
        async simulateMemoryUsage(size) {
          this.memoryUsage += size;
          // 模拟内存使用
          const buffer = new Array(size / 8).fill(0);
          return buffer;
        }
        
        async simulateNetworkRequest() {
          this.requestCount++;
          // 模拟网络请求延迟
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return { success: true, data: 'test-data' };
        }
        
        async cleanup() {
          this.memoryUsage = 0;
          this.requestCount = 0;
          console.log('Performance test plugin cleaned up');
        }
        
        getStats() {
          return {
            memoryUsage: this.memoryUsage,
            requestCount: this.requestCount
          };
        }
      }
      
      module.exports = PerformanceTestPlugin;
    `;
    
    await fs.writeFile(path.join(testPluginDir, 'index.js'), pluginCode);
    
    // 初始化插件管理器
    const pluginManager = new PluginManager({
      pluginsDir: path.join(process.cwd(), 'test-plugins'),
      enableHotReload: false,
      maxPlugins: 10
    });

    context = {
      pluginManager,
      testPluginDir,
      testPluginId
    };
  });

  afterEach(async () => {
    if (context) {
      // 清理插件管理器
      await context.pluginManager.cleanup();
      
      // 清理测试文件
      try {
        await fs.rm(path.dirname(context.testPluginDir), { recursive: true, force: true });
      } catch (error) {
        // 忽略清理错误
      }
    }
  });

  return () => context;
}