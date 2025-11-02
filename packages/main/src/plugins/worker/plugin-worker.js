const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

class PluginWorkerRuntime {
  constructor(config) {
    this.pluginId = config.pluginId;
    this.pluginPath = config.pluginPath;
    this.workerId = config.workerId;
    this.config = config.config;
    this.pluginInstance = null;
    this.context = null;
    this.memoryMonitor = null;
    
    this.setupMemoryMonitoring();
    this.loadPlugin();
  }

  setupMemoryMonitoring() {
    this.memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      parentPort.postMessage({
        type: 'memory_usage',
        usage: memUsage.heapUsed
      });

      if (memUsage.heapUsed > this.config.maxMemoryUsage) {
        this.reportError(new Error(`Memory usage exceeded limit: ${memUsage.heapUsed} > ${this.config.maxMemoryUsage}`));
      }
    }, 5000); // Check every 5 seconds
  }

  async loadPlugin() {
    try {
      const manifestPath = path.join(this.pluginPath, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      const pluginMainPath = path.join(this.pluginPath, manifest.main);
      const pluginCode = fs.readFileSync(pluginMainPath, 'utf8');

      // Create secure sandbox context
      this.context = this.createSandboxContext();
      
      // Execute plugin code in sandbox
      const script = new vm.Script(pluginCode, {
        filename: pluginMainPath,
        timeout: this.config.maxExecutionTime
      });

      script.runInContext(this.context);
      
      // Get plugin instance
      if (this.context.module && this.context.module.exports) {
        if (typeof this.context.module.exports === 'function') {
          this.pluginInstance = new this.context.module.exports();
        } else {
          this.pluginInstance = this.context.module.exports;
        }
      } else {
        throw new Error('Plugin does not export a valid module');
      }

      this.reportStatus('idle');
      this.log('info', 'Plugin loaded successfully');
      
    } catch (error) {
      this.reportError(error);
    }
  }

  createSandboxContext() {
    const sandbox = {
      // Node.js globals (limited)
      console: {
        log: (...args) => this.log('info', ...args),
        error: (...args) => this.log('error', ...args),
        warn: (...args) => this.log('warn', ...args),
        info: (...args) => this.log('info', ...args),
        debug: (...args) => this.log('debug', ...args),
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Buffer,
      process: {
        env: process.env,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      
      // Module system
      module: { exports: {} },
      exports: {},
      require: this.createSecureRequire(),
      
      // Plugin API bridge
      pluginAPI: this.createPluginAPI(),
      
      // Global objects
      global: {},
      __filename: path.join(this.pluginPath, 'index.js'),
      __dirname: this.pluginPath,
    };

    // Make global reference itself
    sandbox.global = sandbox;
    sandbox.exports = sandbox.module.exports;

    return vm.createContext(sandbox);
  }

  createSecureRequire() {
    const allowedModules = new Set([
      'path', 'crypto', 'util', 'events', 'stream',
      'url', 'querystring', 'zlib', 'buffer'
    ]);

    return (moduleName) => {
      if (allowedModules.has(moduleName)) {
        return require(moduleName);
      }
      
      // Allow relative requires within plugin directory
      if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
        const resolvedPath = path.resolve(this.pluginPath, moduleName);
        if (resolvedPath.startsWith(this.pluginPath)) {
          return require(resolvedPath);
        }
      }
      
      throw new Error(`Module '${moduleName}' is not allowed in plugin sandbox`);
    };
  }

  createPluginAPI() {
    return {
      // Plugin metadata
      getPluginId: () => this.pluginId,
      getWorkerId: () => this.workerId,
      
      // Communication with main process
      sendMessage: (type, data) => {
        parentPort.postMessage({
          type: 'plugin_message',
          pluginId: this.pluginId,
          messageType: type,
          data
        });
      },
      
      // Storage API (simplified)
      storage: {
        get: (key) => this.sendAPIRequest('storage.get', { key }),
        set: (key, value) => this.sendAPIRequest('storage.set', { key, value }),
        delete: (key) => this.sendAPIRequest('storage.delete', { key }),
      },
      
      // HTTP API
      http: {
        get: (url, options) => this.sendAPIRequest('http.get', { url, options }),
        post: (url, data, options) => this.sendAPIRequest('http.post', { url, data, options }),
      },
      
      // Event system
      events: {
        on: (event, handler) => this.sendAPIRequest('events.on', { event, handler: handler.toString() }),
        emit: (event, data) => this.sendAPIRequest('events.emit', { event, data }),
        off: (event, handler) => this.sendAPIRequest('events.off', { event, handler: handler.toString() }),
      }
    };
  }

  async sendAPIRequest(method, args) {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substr(2, 9);
      
      const timeout = setTimeout(() => {
        reject(new Error(`API request timeout: ${method}`));
      }, 10000);

      const messageHandler = (message) => {
        if (message.type === 'api_response' && message.requestId === requestId) {
          clearTimeout(timeout);
          parentPort.off('message', messageHandler);
          
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.result);
          }
        }
      };

      parentPort.on('message', messageHandler);
      parentPort.postMessage({
        type: 'api_request',
        requestId,
        method,
        args
      });
    });
  }

  async executeMethod(method, args = []) {
    try {
      this.reportStatus('busy');
      
      if (!this.pluginInstance) {
        throw new Error('Plugin not loaded');
      }

      let result;
      if (typeof this.pluginInstance[method] === 'function') {
        result = await this.pluginInstance[method](...args);
      } else if (method === 'init' && typeof this.pluginInstance.initialize === 'function') {
        result = await this.pluginInstance.initialize(...args);
      } else if (method === 'execute' && typeof this.pluginInstance.run === 'function') {
        result = await this.pluginInstance.run(...args);
      } else {
        throw new Error(`Method '${method}' not found in plugin`);
      }

      parentPort.postMessage({
        type: 'result',
        result
      });

      this.reportStatus('idle');
      parentPort.postMessage({ type: 'execution_complete' });
      
    } catch (error) {
      parentPort.postMessage({
        type: 'result',
        error: error.message
      });
      
      this.reportError(error);
    }
  }

  reportStatus(status) {
    parentPort.postMessage({
      type: 'status',
      status
    });
  }

  reportError(error) {
    this.log('error', 'Plugin worker error:', error.message);
    this.reportStatus('error');
    
    parentPort.postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack
    });
  }

  log(level, ...args) {
    parentPort.postMessage({
      type: 'log',
      level,
      message: args.join(' '),
      timestamp: Date.now(),
      pluginId: this.pluginId,
      workerId: this.workerId
    });
  }

  cleanup() {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    
    if (this.pluginInstance && typeof this.pluginInstance.cleanup === 'function') {
      try {
        this.pluginInstance.cleanup();
      } catch (error) {
        this.log('error', 'Error during plugin cleanup:', error.message);
      }
    }
  }
}

// Initialize worker
const runtime = new PluginWorkerRuntime(workerData);

// Handle messages from main thread
parentPort.on('message', async (message) => {
  switch (message.type) {
    case 'execute':
      await runtime.executeMethod(message.method, message.args);
      break;
    case 'cleanup':
      runtime.cleanup();
      break;
  }
});

// Handle worker termination
process.on('SIGTERM', () => {
  runtime.cleanup();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  runtime.reportError(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  runtime.reportError(new Error(`Unhandled rejection: ${reason}`));
  process.exit(1);
});