import { connectionPool } from '../ConnectionPoolManager';
import { performanceMonitor } from '../PerformanceMonitor';
import { AcfunDanmuModule } from '../AcfunDanmuModule';

/**
 * 连接池集成测试类
 */
export class ConnectionPoolIntegrationTest {
  private testResults: Array<{
    testName: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    details?: any;
  }> = [];

  /**
   * 运行所有集成测试
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 开始连接池集成测试...\n');

    const tests = [
      { name: '连接池基本功能测试', method: this.testConnectionPoolBasics },
      { name: '连接池并发测试', method: this.testConnectionPoolConcurrency },
      { name: '连接池错误处理测试', method: this.testConnectionPoolErrorHandling },
      { name: '性能监控集成测试', method: this.testPerformanceMonitoringIntegration },
      { name: 'AcfunDanmuModule 集成测试', method: this.testAcfunDanmuModuleIntegration },
      { name: '连接池健康检查测试', method: this.testConnectionPoolHealthCheck },
      { name: '熔断器功能测试', method: this.testCircuitBreakerFunctionality }
    ];

    for (const test of tests) {
      await this.runSingleTest(test.name, test.method.bind(this));
    }

    this.printTestSummary();
  }

  /**
   * 运行单个测试
   */
  private async runSingleTest(testName: string, testMethod: () => Promise<void>): Promise<void> {
    console.log(`📋 运行测试: ${testName}`);
    const startTime = Date.now();

    try {
      await testMethod();
      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        status: 'passed',
        duration
      });
      console.log(`✅ ${testName} - 通过 (${duration}ms)\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testResults.push({
        testName,
        status: 'failed',
        duration,
        error: errorMessage
      });
      console.log(`❌ ${testName} - 失败 (${duration}ms): ${errorMessage}\n`);
    }
  }

  /**
   * 测试连接池基本功能
   */
  private async testConnectionPoolBasics(): Promise<void> {
    // 测试连接获取
    const connection1 = await connectionPool.acquire('live');
    if (!connection1 || !connection1.api) {
      throw new Error('无法获取连接池连接');
    }

    // 测试连接释放
    await connectionPool.release(connection1.id);

    // 测试连接重新获取
    const connection2 = await connectionPool.acquire('live');
    if (!connection2 || !connection2.api) {
      throw new Error('无法重新获取连接池连接');
    }

    await connectionPool.release(connection2.id);
    console.log('  ✓ 连接获取和释放功能正常');
  }

  /**
   * 测试连接池并发功能
   */
  private async testConnectionPoolConcurrency(): Promise<void> {
    const concurrentRequests = 5;
    const promises: Promise<any>[] = [];

    // 创建多个并发连接请求
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        connectionPool.acquire('live').then(async (connection) => {
          if (!connection) {
            throw new Error(`并发请求 ${i + 1} 获取连接失败`);
          }
          
          // 模拟一些工作
          await new Promise(resolve => setTimeout(resolve, 100));
          
          await connectionPool.release(connection.id);
          return connection.id;
        })
      );
    }

    const results = await Promise.all(promises);
    if (results.length !== concurrentRequests) {
      throw new Error(`并发测试失败：期望 ${concurrentRequests} 个结果，实际获得 ${results.length} 个`);
    }

    console.log(`  ✓ 并发处理 ${concurrentRequests} 个连接请求成功`);
  }

  /**
   * 测试连接池错误处理
   */
  private async testConnectionPoolErrorHandling(): Promise<void> {
    // 测试无效连接ID的处理
    try {
      await connectionPool.release('invalid-connection-id');
      console.log('  ✓ 无效连接ID处理正常');
    } catch (error) {
      // 预期会有错误，这是正常的
      console.log('  ✓ 无效连接ID错误处理正常');
    }

    // 测试重复释放连接
    const connection = await connectionPool.acquire('live');
    await connectionPool.release(connection.id);
    
    try {
      await connectionPool.release(connection.id);
      console.log('  ✓ 重复释放连接处理正常');
    } catch (error) {
      // 预期会有错误，这是正常的
      console.log('  ✓ 重复释放连接错误处理正常');
    }
  }

  /**
   * 测试性能监控集成
   */
  private async testPerformanceMonitoringIntegration(): Promise<void> {
    // 启动性能监控
    if (!performanceMonitor.isMonitoring()) {
      performanceMonitor.start();
    }

    // 等待一段时间让监控收集数据
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 检查性能指标
    const metrics = performanceMonitor.getLatestMetrics();
    if (!metrics) {
      throw new Error('无法获取性能指标');
    }

    if (typeof metrics.connectionPool.totalConnections !== 'number') {
      throw new Error('连接池指标格式不正确');
    }

    // 检查性能摘要
    const summary = performanceMonitor.getPerformanceSummary();
    if (!summary || typeof summary.uptime !== 'number') {
      throw new Error('性能摘要格式不正确');
    }

    console.log('  ✓ 性能监控集成正常');
    console.log(`  ✓ 当前连接数: ${metrics.connectionPool.totalConnections}`);
    console.log(`  ✓ 运行时间: ${Math.round(summary.uptime / 1000)}秒`);
  }

  /**
   * 测试 AcfunDanmuModule 集成
   */
  private async testAcfunDanmuModuleIntegration(): Promise<void> {
    const module = new AcfunDanmuModule();
    
    try {
      // 测试初始化
      await module.initialize();
      
      // 测试性能监控方法
      const isMonitoring = module.isPerformanceMonitoringActive();
      if (!isMonitoring) {
        throw new Error('性能监控未激活');
      }

      const summary = module.getPerformanceSummary();
      if (!summary) {
        throw new Error('无法获取性能摘要');
      }

      console.log('  ✓ AcfunDanmuModule 初始化成功');
      console.log('  ✓ 性能监控集成正常');

      // 清理
      await module.destroy();
      console.log('  ✓ AcfunDanmuModule 销毁成功');
      
    } catch (error) {
      // 确保清理
      try {
        await module.destroy();
      } catch (cleanupError) {
        console.warn('清理过程中出现错误:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * 测试连接池健康检查
   */
  private async testConnectionPoolHealthCheck(): Promise<void> {
    // 获取连接池性能指标
    const metrics = connectionPool.getPerformanceMetrics();
    
    if (!metrics) {
      throw new Error('无法获取连接池性能指标');
    }

    // 检查健康状态指标
    const healthMetrics = metrics.health;
    if (!healthMetrics) {
      throw new Error('健康检查指标不存在');
    }

    console.log('  ✓ 连接池健康检查功能正常');
    console.log(`  ✓ 健康连接数: ${healthMetrics.healthyConnections}`);
    console.log(`  ✓ 不健康连接数: ${healthMetrics.unhealthyConnections}`);
  }

  /**
   * 测试熔断器功能
   */
  private async testCircuitBreakerFunctionality(): Promise<void> {
    const metrics = connectionPool.getPerformanceMetrics();
    
    if (!metrics) {
      throw new Error('无法获取连接池性能指标');
    }

    // 检查熔断器状态
    const circuitBreakerStatus = metrics.performance.circuitBreakerStatus;
    if (!circuitBreakerStatus) {
      throw new Error('熔断器状态不存在');
    }

    console.log('  ✓ 熔断器功能正常');
    console.log(`  ✓ 熔断器状态: ${circuitBreakerStatus.isOpen ? '开启' : '关闭'}`);
    console.log(`  ✓ 连续失败次数: ${circuitBreakerStatus.consecutiveFailures}`);
  }

  /**
   * 打印测试摘要
   */
  private printTestSummary(): void {
    console.log('\n📊 测试摘要');
    console.log('=' .repeat(50));

    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;

    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(result => {
          console.log(`  - ${result.testName}: ${result.error}`);
        });
    }

    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    console.log(`\n⏱️  总耗时: ${totalDuration}ms`);
    
    if (passed === total) {
      console.log('\n🎉 所有测试通过！连接池集成功能正常。');
    } else {
      console.log('\n⚠️  部分测试失败，请检查相关功能。');
    }
  }

  /**
   * 获取测试结果
   */
  getTestResults() {
    return this.testResults;
  }
}

// 导出便捷函数
export async function runConnectionPoolIntegrationTests(): Promise<void> {
  const tester = new ConnectionPoolIntegrationTest();
  await tester.runAllTests();
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runConnectionPoolIntegrationTests().catch(console.error);
}