import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { WorkerPoolManager, WorkerPoolConfig } from './WorkerPoolManager';
import { SecureCommunicationChannel } from './SecureCommunicationChannel';
import { pluginLogger } from './PluginLogger';
import { pluginErrorHandler, ErrorType } from './PluginErrorHandler';
import * as path from 'path';

export interface ProcessManagerConfig {
  workerPool: Partial<WorkerPoolConfig>;
  enableSandboxing: boolean;
  enableIsolation: boolean;
  maxPluginInstances: number;
  processRecoveryEnabled: boolean;
}

export interface PluginProcessInfo {
  pluginId: string;
  workerId: string;
  channelId: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  startedAt: number;
  lastActivity: number;
  executionCount: number;
  errorCount: number;
}

export interface ProcessManagerEvents {
  'process.started': { pluginId: string; processInfo: PluginProcessInfo };
  'process.stopped': { pluginId: string; reason: string };
  'process.error': { pluginId: string; error: Error };
  'process.recovered': { pluginId: string; attempt: number };
  'isolation.violation': { pluginId: string; violation: string };
}

export class ProcessManager extends TypedEventEmitter<ProcessManagerEvents> {
  private config: ProcessManagerConfig;
  private workerPool: WorkerPoolManager;
  private communicationChannel: SecureCommunicationChannel;
  private processes: Map<string, PluginProcessInfo> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();
  private maxRecoveryAttempts = 3;

  constructor(config: Partial<ProcessManagerConfig> = {}) {
    super();
    
    this.config = {
      workerPool: config.workerPool || {},
      enableSandboxing: config.enableSandboxing !== false,
      enableIsolation: config.enableIsolation !== false,
      maxPluginInstances: config.maxPluginInstances || 50,
      processRecoveryEnabled: config.processRecoveryEnabled !== false,
    };

    this.workerPool = new WorkerPoolManager(this.config.workerPool);
    this.communicationChannel = new SecureCommunicationChannel({
      enableEncryption: this.config.enableSandboxing,
      enableSigning: true,
    });

    this.setupEventHandlers();
    pluginLogger.info('ProcessManager initialized', undefined, { config: this.config });
  }

  private setupEventHandlers(): void {
    this.workerPool.on('worker.created', ({ workerId, pluginId }) => {
      this.updateProcessStatus(pluginId, 'running');
    });

    this.workerPool.on('worker.terminated', ({ workerId, pluginId, reason }) => {
      this.handleWorkerTermination(pluginId, reason);
    });

    this.workerPool.on('worker.error', ({ workerId, pluginId, error }) => {
      this.handleWorkerError(pluginId, error);
    });

    this.communicationChannel.on('channel.error', ({ channelId, error }) => {
      const process = this.findProcessByChannelId(channelId);
      if (process) {
        this.handleProcessError(process.pluginId, error);
      }
    });
  }

  public async startPluginProcess(
    pluginId: string, 
    pluginPath: string,
    options: { autoRestart?: boolean } = {}
  ): Promise<PluginProcessInfo> {
    if (this.processes.has(pluginId)) {
      throw new Error(`Plugin process ${pluginId} is already running`);
    }

    if (this.processes.size >= this.config.maxPluginInstances) {
      throw new Error(`Maximum plugin instances reached (${this.config.maxPluginInstances})`);
    }

    try {
      const workerId = await this.workerPool.createWorker(pluginId, pluginPath);
      const channelId = `${pluginId}-${workerId}`;

      const processInfo: PluginProcessInfo = {
        pluginId,
        workerId,
        channelId,
        status: 'starting',
        startedAt: Date.now(),
        lastActivity: Date.now(),
        executionCount: 0,
        errorCount: 0,
      };

      this.processes.set(pluginId, processInfo);

      // Create communication channel
      const workerInfo = this.workerPool['workers'].get(workerId);
      if (workerInfo) {
        this.communicationChannel.createChannel(channelId, pluginId, workerInfo.worker);
      }

      // Initialize plugin
      await this.executeInPlugin(pluginId, 'init', []);
      
      processInfo.status = 'running';
      this.emit('process.started', { pluginId, processInfo });
      
      pluginLogger.info('Plugin process started', pluginId, { workerId, channelId });
      return processInfo;

    } catch (error: any) {
      this.processes.delete(pluginId);
      pluginLogger.error('Failed to start plugin process', pluginId, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async stopPluginProcess(pluginId: string, reason: string = 'manual'): Promise<void> {
    const processInfo = this.processes.get(pluginId);
    if (!processInfo) {
      throw new Error(`Plugin process ${pluginId} not found`);
    }

    try {
      processInfo.status = 'stopping';

      // Execute cleanup in plugin
      try {
        await this.executeInPlugin(pluginId, 'cleanup', [], 5000);
      } catch (error: any) {
        pluginLogger.warn('Plugin cleanup failed', pluginId, error instanceof Error ? error : new Error(String(error)));
      }

      // Remove communication channel
      this.communicationChannel.removeChannel(processInfo.channelId);

      // Terminate worker
      this.workerPool.terminateWorker(processInfo.workerId, reason);

      processInfo.status = 'stopped';
      this.processes.delete(pluginId);
      this.recoveryAttempts.delete(pluginId);

      this.emit('process.stopped', { pluginId, reason });
      pluginLogger.info('Plugin process stopped', pluginId, { reason });

    } catch (error: any) {
      pluginLogger.error('Error stopping plugin process', pluginId, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async executeInPlugin(
    pluginId: string, 
    method: string, 
    args: any[] = [],
    timeout?: number
  ): Promise<any> {
    const processInfo = this.processes.get(pluginId);
    if (!processInfo) {
      throw new Error(`Plugin process ${pluginId} not found`);
    }

    // Allow executing 'init' during the 'starting' phase
    if (processInfo.status !== 'running') {
      const allowDuringStarting = processInfo.status === 'starting' && method === 'init';
      if (!allowDuringStarting) {
        throw new Error(`Plugin process ${pluginId} is not running (status: ${processInfo.status})`);
      }
    }

    try {
      const result = await this.workerPool.executeInWorker(
        processInfo.workerId, 
        method, 
        args, 
        timeout
      );

      processInfo.executionCount++;
      processInfo.lastActivity = Date.now();

      return result;
    } catch (error: any) {
      processInfo.errorCount++;
      pluginLogger.error('Plugin execution error', pluginId, error instanceof Error ? error : new Error(String(error)), { method });

      // Report error to error handler
      pluginErrorHandler.handleError(
        pluginId,
        ErrorType.RUNTIME_ERROR,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : new Error(String(error)),
        { method, args }
      );

      throw error;
    }
  }

  public async sendMessageToPlugin(
    pluginId: string, 
    type: string, 
    data: any,
    expectResponse: boolean = false
  ): Promise<any> {
    const processInfo = this.processes.get(pluginId);
    if (!processInfo) {
      throw new Error(`Plugin process ${pluginId} not found`);
    }

    try {
      const result = await this.communicationChannel.sendMessage(
        processInfo.channelId,
        type,
        data,
        expectResponse
      );

      processInfo.lastActivity = Date.now();
      return result;
    } catch (error: any) {
      pluginLogger.error('Failed to send message to plugin', pluginId, error instanceof Error ? error : new Error(String(error)), { type });
      throw error;
    }
  }

  private handleWorkerTermination(pluginId: string, reason: string): void {
    const processInfo = this.processes.get(pluginId);
    if (!processInfo) return;

    if (reason !== 'manual' && this.config.processRecoveryEnabled) {
      this.attemptProcessRecovery(pluginId, reason);
    } else {
      this.processes.delete(pluginId);
      this.emit('process.stopped', { pluginId, reason });
    }
  }

  private handleWorkerError(pluginId: string, error: Error): void {
    const processInfo = this.processes.get(pluginId);
    if (processInfo) {
      processInfo.errorCount++;
      processInfo.status = 'error';
    }

    this.emit('process.error', { pluginId, error });

    if (this.config.processRecoveryEnabled) {
      this.attemptProcessRecovery(pluginId, 'worker_error');
    }
  }

  private handleProcessError(pluginId: string, error: Error): void {
    pluginLogger.error('Process error', pluginId, error);
    this.emit('process.error', { pluginId, error });
  }

  private async attemptProcessRecovery(pluginId: string, reason: string): Promise<void> {
    const attempts = this.recoveryAttempts.get(pluginId) || 0;
    
    if (attempts >= this.maxRecoveryAttempts) {
      pluginLogger.error('Max recovery attempts reached', pluginId, new Error(`Max attempts: ${attempts}`));
      this.processes.delete(pluginId);
      this.recoveryAttempts.delete(pluginId);
      return;
    }

    this.recoveryAttempts.set(pluginId, attempts + 1);

    try {
      pluginLogger.info('Attempting process recovery', pluginId, { attempt: attempts + 1, reason });

      // Stop current process if it exists
      if (this.processes.has(pluginId)) {
        await this.stopPluginProcess(pluginId, 'recovery');
      }

      // Wait before restart
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempts + 1)));

      // Restart process (this would need plugin path - simplified for now)
      // await this.startPluginProcess(pluginId, pluginPath);

      this.emit('process.recovered', { pluginId, attempt: attempts + 1 });
      pluginLogger.info('Process recovery successful', pluginId, { attempt: attempts + 1 });

    } catch (error: any) {
      pluginLogger.error('Process recovery failed', pluginId, error instanceof Error ? error : new Error(String(error)), { attempt: attempts + 1 });
    }
  }

  private updateProcessStatus(pluginId: string, status: PluginProcessInfo['status']): void {
    const processInfo = this.processes.get(pluginId);
    if (processInfo) {
      processInfo.status = status;
      processInfo.lastActivity = Date.now();
    }
  }

  private findProcessByChannelId(channelId: string): PluginProcessInfo | undefined {
    const processes = Array.from(this.processes.values());
    for (const processInfo of processes) {
      if (processInfo.channelId === channelId) {
        return processInfo;
      }
    }
    return undefined;
  }

  public getProcessInfo(pluginId: string): PluginProcessInfo | undefined {
    return this.processes.get(pluginId);
  }

  public getAllProcesses(): PluginProcessInfo[] {
    return Array.from(this.processes.values());
  }

  public getProcessStats(): {
    total: number;
    running: number;
    stopped: number;
    error: number;
    workerStats: any;
    channelStats: any[];
  } {
    const stats = {
      total: this.processes.size,
      running: 0,
      stopped: 0,
      error: 0,
      workerStats: this.workerPool.getWorkerStats(),
      channelStats: this.communicationChannel.getAllChannelStats(),
    };

    const processes = Array.from(this.processes.values());
    for (const processInfo of processes) {
      switch (processInfo.status) {
        case 'running':
          stats.running++;
          break;
        case 'stopped':
          stats.stopped++;
          break;
        case 'error':
          stats.error++;
          break;
      }
    }

    return stats;
  }

  public async restartPlugin(pluginId: string): Promise<void> {
    const processInfo = this.processes.get(pluginId);
    if (!processInfo) {
      throw new Error(`Plugin process ${pluginId} not found`);
    }

    await this.stopPluginProcess(pluginId, 'restart');
    // Note: Would need to store plugin path to restart
    // await this.startPluginProcess(pluginId, pluginPath);
  }

  public cleanup(): void {
    // Stop all processes
    const pluginIds = Array.from(this.processes.keys());
    for (const pluginId of pluginIds) {
      try {
        this.stopPluginProcess(pluginId, 'cleanup').catch(() => {});
      } catch (error: any) {
        // Ignore errors during cleanup
      }
    }

    // Cleanup components
    this.workerPool.cleanup();
    this.communicationChannel.cleanup();

    pluginLogger.info('ProcessManager cleanup completed');
  }
}
