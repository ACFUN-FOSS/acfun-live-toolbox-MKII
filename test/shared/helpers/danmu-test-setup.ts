import { beforeEach, afterEach, vi } from 'vitest';
import { AcfunAdapter } from '../../../packages/main/src/adapter/AcfunAdapter';
import { AuthManager } from '../../../packages/main/src/services/AuthManager';
import { ConfigManager } from '../../../packages/main/src/config/ConfigManager';
import path from 'path';
import os from 'os';

// 使用真实的 fs 模块
const fs = await vi.importActual<typeof import('fs')>('fs');

export const TEST_ROOM_ID = '23682490';

export interface DanmuTestContext {
  tempDir: string;
  authManager: AuthManager;
  configManager: ConfigManager;
  adapter: AcfunAdapter;
  /**
   * 安全地断开连接，包含超时保护
   */
  safeDisconnect: () => Promise<void>;
  /**
   * 检查连接状态
   */
  isConnected: () => boolean;
}

let testContext: DanmuTestContext | null = null;

export function setupDanmuTest() {
  beforeEach(async () => {
    // 创建临时目录
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'acfun-test-'));
    
    // 初始化管理器
    const authManager = new AuthManager(tempDir);
    const configManager = new ConfigManager(tempDir);
    
    // 初始化适配器
    const adapter = new AcfunAdapter(TEST_ROOM_ID, authManager, configManager);

    // 创建安全断开连接的方法
    const safeDisconnect = async (): Promise<void> => {
      if (!adapter) return;

      try {
        console.log('🔌 开始断开弹幕连接...');
        
        // 设置超时保护
        const disconnectPromise = new Promise<void>((resolve) => {
          adapter.disconnect();
          resolve();
        });

        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('断开连接超时'));
          }, 10000); // 10秒超时
        });

        await Promise.race([disconnectPromise, timeoutPromise]);
        
        // 等待一小段时间确保连接完全关闭
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('✅ 弹幕连接已安全断开');
      } catch (error) {
        console.warn('⚠️ 断开连接时出现异常:', error);
        // 即使出现异常也继续清理
      }
    };

    // 检查连接状态的方法
    const isConnected = (): boolean => {
      try {
        return adapter.getStatus() === 'connected' || adapter.getStatus() === 'connecting';
      } catch {
        return false;
      }
    };

    testContext = {
      tempDir,
      authManager,
      configManager,
      adapter,
      safeDisconnect,
      isConnected
    };
  });

  afterEach(async () => {
    if (testContext) {
      try {
        // 如果连接仍然活跃，先安全断开
        if (testContext.isConnected()) {
          console.log('🔄 检测到活跃连接，正在安全断开...');
          await testContext.safeDisconnect();
        }

        // 清理临时目录
        if (await fs.promises.access(testContext.tempDir).then(() => true).catch(() => false)) {
          await fs.promises.rm(testContext.tempDir, { recursive: true, force: true });
        }
        
        console.log('🧹 测试环境清理完成');
      } catch (error) {
        console.warn('⚠️ 清理测试环境时出现异常:', error);
      } finally {
        testContext = null;
      }
    }
  });

  return {
    get context(): DanmuTestContext {
      if (!testContext) {
        throw new Error('测试上下文未初始化，请确保在测试用例中调用');
      }
      return testContext;
    }
  };
}

/**
 * 获取当前测试上下文
 * 这是一个便捷方法，用于在测试用例中快速获取上下文
 */
export function getDanmuTestContext(): DanmuTestContext {
  if (!testContext) {
    throw new Error('测试上下文未初始化，请确保已调用 setupDanmuTest()');
  }
  return testContext;
}

/**
 * 等待连接建立的辅助函数
 */
export async function waitForConnection(
  adapter: AcfunAdapter, 
  timeoutMs: number = 30000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const status = adapter.getStatus();
    
    if (status === 'connected') {
      console.log('✅ 连接已建立');
      return;
    }
    
    if (status === 'error' || status === 'closed') {
      throw new Error(`连接失败，当前状态: ${status}`);
    }
    
    // 等待100ms后重试
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`连接超时 (${timeoutMs}ms)`);
}

/**
 * 等待特定事件的辅助函数
 */
export async function waitForEvent<T>(
  adapter: AcfunAdapter,
  eventName: string,
  timeoutMs: number = 10000,
  filter?: (data: T) => boolean
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      adapter.off(eventName, eventHandler);
      reject(new Error(`等待事件 ${eventName} 超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    const eventHandler = (data: T) => {
      if (!filter || filter(data)) {
        clearTimeout(timeout);
        adapter.off(eventName, eventHandler);
        resolve(data);
      }
    };

    adapter.on(eventName, eventHandler);
  });
}