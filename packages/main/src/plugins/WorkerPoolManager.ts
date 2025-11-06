import { Worker } from 'worker_threads';
import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { pluginLogger } from './PluginLogger';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';

export interface WorkerPoolConfig {
  maxWorkers: number;
  idleTimeout: number; // ms
  maxMemoryUsage: number; // bytes
  maxExecutionTime: number; // ms
}

export interface PluginWorkerInfo {
  workerId: string;
  pluginId: string;
  worker: Worker;
  status: 'idle' | 'busy' | 'error' | 'terminated';
  createdAt: number;
  lastUsed: number;
  memoryUsage: number;
  executionCount: number;
}

export interface WorkerPoolEvents {
  'worker.created': { workerId: string; pluginId: string };
  'worker.terminated': { workerId: string; pluginId: string; reason: string };
  'worker.error': { workerId: string; pluginId: string; error: Error };
  'worker.idle': { workerId: string; pluginId: string };
  'worker.busy': { workerId: string; pluginId: string };
  'pool.full': { requestedPluginId: string };
}

export class WorkerPoolManager extends TypedEventEmitter<WorkerPoolEvents> {
  private config: WorkerPoolConfig;
  private workers: Map<string, PluginWorkerInfo> = new Map();
  private pluginWorkers: Map<string, Set<string>> = new Map(); // pluginId -> workerIds
  private idleWorkers: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | undefined;

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    super();
    
    this.config = {
      maxWorkers: config.maxWorkers || 10,
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      maxMemoryUsage: config.maxMemoryUsage || 100 * 1024 * 1024, // 100MB
      maxExecutionTime: config.maxExecutionTime || 30000, // 30 seconds
    };

    this.setupCleanupInterval();
    pluginLogger.info('WorkerPoolManager initialized', undefined, { config: this.config });
  }

  private setupCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleWorkers();
    }, 60000); // Check every minute
  }

  private cleanupIdleWorkers(): void {
    const now = Date.now();
    const workersToTerminate: string[] = [];

    for (const [workerId, workerInfo] of Array.from(this.workers.entries())) {
      if (
        workerInfo.status === 'idle' &&
        now - workerInfo.lastUsed > this.config.idleTimeout
      ) {
        workersToTerminate.push(workerId);
      }
    }

    for (const workerId of workersToTerminate) {
      this.terminateWorker(workerId, 'idle_timeout');
    }

    if (workersToTerminate.length > 0) {
      pluginLogger.info('Cleaned up idle workers', undefined, { 
        count: workersToTerminate.length,
        workerIds: workersToTerminate 
      });
    }
  }

  public async createWorker(pluginId: string, pluginPath: string): Promise<string> {
    if (this.workers.size >= this.config.maxWorkers) {
      this.emit('pool.full', { requestedPluginId: pluginId });
      throw new Error(`Worker pool is full (max: ${this.config.maxWorkers})`);
    }

    const workerId = crypto.randomUUID();
    const candidatePaths = [
      // Bundled dist: index.cjs __dirname → dist
      path.join(__dirname, 'worker', 'plugin-worker.js'),
      // Fallback in case bundler preserves plugin folder
      path.join(__dirname, 'plugins', 'worker', 'plugin-worker.js'),
      // Source path for development runs
      path.resolve(process.cwd(), 'packages', 'main', 'src', 'plugins', 'worker', 'plugin-worker.js'),
    ];
    const workerScriptPath = candidatePaths.find(p => {
      try { return fs.existsSync(p); } catch { return false; }
    }) || candidatePaths[0];

    try {
      const worker = new Worker(workerScriptPath, {
        workerData: {
          pluginId,
          pluginPath,
          workerId,
          config: {
            maxMemoryUsage: this.config.maxMemoryUsage,
            maxExecutionTime: this.config.maxExecutionTime,
          }
        }
      });

      const workerInfo: PluginWorkerInfo = {
        workerId,
        pluginId,
        worker,
        status: 'idle',
        createdAt: Date.now(),
        lastUsed: Date.now(),
        memoryUsage: 0,
        executionCount: 0,
      };

      this.setupWorkerEventHandlers(workerInfo);
      
      this.workers.set(workerId, workerInfo);
      this.idleWorkers.add(workerId);
      
      if (!this.pluginWorkers.has(pluginId)) {
        this.pluginWorkers.set(pluginId, new Set());
      }
      this.pluginWorkers.get(pluginId)!.add(workerId);

      this.emit('worker.created', { workerId, pluginId });
      pluginLogger.info('Worker created', pluginId, { workerId, pluginId });

      return workerId;
    } catch (error) {
      pluginLogger.error('Failed to create worker', pluginId, error instanceof Error ? error : new Error(String(error)), { 
        workerId, 
        pluginId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  private setupWorkerEventHandlers(workerInfo: PluginWorkerInfo): void {
    const { worker, workerId, pluginId } = workerInfo;

    worker.on('message', (message) => {
      this.handleWorkerMessage(workerId, message);
    });

    worker.on('error', (error) => {
      pluginLogger.error('Worker error', pluginId, error, { workerId, pluginId, error: error.message });
      this.updateWorkerStatus(workerId, 'error');
      this.emit('worker.error', { workerId, pluginId, error });
    });

    worker.on('exit', (code) => {
      pluginLogger.info('Worker exited', pluginId, { workerId, pluginId, code });
      this.removeWorker(workerId);
    });
  }

  private handleWorkerMessage(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    switch (message.type) {
      case 'status':
        this.updateWorkerStatus(workerId, message.status);
        break;
      case 'memory_usage':
        workerInfo.memoryUsage = message.usage;
        if (message.usage > this.config.maxMemoryUsage) {
          pluginLogger.warn('Worker memory usage exceeded limit', workerInfo.pluginId, {
            workerId,
            pluginId: workerInfo.pluginId,
            usage: message.usage,
            limit: this.config.maxMemoryUsage
          });
        }
        break;
      case 'execution_complete':
        workerInfo.executionCount++;
        workerInfo.lastUsed = Date.now();
        this.updateWorkerStatus(workerId, 'idle');
        break;
    }
  }

  private updateWorkerStatus(workerId: string, status: PluginWorkerInfo['status']): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    const oldStatus = workerInfo.status;
    workerInfo.status = status;

    if (status === 'idle' && oldStatus !== 'idle') {
      this.idleWorkers.add(workerId);
      this.emit('worker.idle', { workerId, pluginId: workerInfo.pluginId });
    } else if (status === 'busy' && oldStatus === 'idle') {
      this.idleWorkers.delete(workerId);
      this.emit('worker.busy', { workerId, pluginId: workerInfo.pluginId });
    }
  }

  public getAvailableWorker(pluginId: string): string | null {
    const pluginWorkerIds = this.pluginWorkers.get(pluginId);
    if (!pluginWorkerIds) return null;

    const workerIds = Array.from(pluginWorkerIds);
    for (const workerId of workerIds) {
      const workerInfo = this.workers.get(workerId);
      if (workerInfo && workerInfo.status === 'idle') {
        return workerId;
      }
    }

    return null;
  }

  public async executeInWorker(
    workerId: string, 
    method: string, 
    args: any[] = [],
    timeout?: number
  ): Promise<any> {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) {
      throw new Error(`Worker ${workerId} not found`);
    }

    if (workerInfo.status !== 'idle') {
      throw new Error(`Worker ${workerId} is not available (status: ${workerInfo.status})`);
    }

    this.updateWorkerStatus(workerId, 'busy');

    return new Promise((resolve, reject) => {
      const executionTimeout = timeout || this.config.maxExecutionTime;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Worker execution timeout (${executionTimeout}ms)`));
        this.terminateWorker(workerId, 'execution_timeout');
      }, executionTimeout);

      const messageHandler = (message: any) => {
        if (message.type === 'result') {
          clearTimeout(timeoutId);
          workerInfo.worker.off('message', messageHandler);
          
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.result);
          }
        }
      };

      workerInfo.worker.on('message', messageHandler);
      workerInfo.worker.postMessage({
        type: 'execute',
        method,
        args,
      });
    });
  }

  public terminateWorker(workerId: string, reason: string): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    try {
      workerInfo.worker.terminate();
    } catch (error) {
      pluginLogger.error('Error terminating worker', workerId, error instanceof Error ? error : new Error(String(error)), {
        workerId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    this.removeWorker(workerId);
    this.emit('worker.terminated', { 
      workerId, 
      pluginId: workerInfo.pluginId, 
      reason 
    });
  }

  private removeWorker(workerId: string): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    this.workers.delete(workerId);
    this.idleWorkers.delete(workerId);

    const pluginWorkerIds = this.pluginWorkers.get(workerInfo.pluginId);
    if (pluginWorkerIds) {
      pluginWorkerIds.delete(workerId);
      if (pluginWorkerIds.size === 0) {
        this.pluginWorkers.delete(workerInfo.pluginId);
      }
    }
  }

  public terminateAllWorkersForPlugin(pluginId: string): void {
    const pluginWorkerIds = this.pluginWorkers.get(pluginId);
    if (!pluginWorkerIds) return;

    const workerIds = Array.from(pluginWorkerIds);
    for (const workerId of workerIds) {
      this.terminateWorker(workerId, 'plugin_disabled');
    }

    pluginLogger.info('Terminated all workers for plugin', pluginId, { 
      pluginId, 
      count: workerIds.length 
    });
  }

  public getWorkerStats(): {
    total: number;
    idle: number;
    busy: number;
    error: number;
    byPlugin: Record<string, number>;
  } {
    const stats = {
      total: this.workers.size,
      idle: 0,
      busy: 0,
      error: 0,
      byPlugin: {} as Record<string, number>,
    };

    const workers = Array.from(this.workers.values());
    for (const workerInfo of workers) {
      switch (workerInfo.status) {
        case 'idle':
          stats.idle++;
          break;
        case 'busy':
          stats.busy++;
          break;
        case 'error':
          stats.error++;
          break;
      }

      stats.byPlugin[workerInfo.pluginId] = 
        (stats.byPlugin[workerInfo.pluginId] || 0) + 1;
    }

    return stats;
  }

  public cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Terminate all workers
    const workerIds = Array.from(this.workers.keys());
    for (const workerId of workerIds) {
      this.terminateWorker(workerId, 'cleanup');
    }

    pluginLogger.info('WorkerPoolManager cleanup completed', undefined, {
      totalWorkers: this.workers.size,
      activeWorkers: Array.from(this.workers.values()).filter(w => w.status === 'busy').length
    });
  }
}
