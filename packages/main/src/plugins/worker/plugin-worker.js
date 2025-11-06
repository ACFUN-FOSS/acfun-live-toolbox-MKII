// Minimal Node worker runtime for plugins
// Responsibilities:
// - Load plugin module from workerData.pluginPath (CJS/ESM compatible)
// - Execute methods on request: { type: 'execute', method, args }
// - Report results: { type: 'result', result? , error? }
// - Report execution completion: { type: 'execution_complete' }
// - Periodically report memory usage: { type: 'memory_usage', usage }
// - Handle secure channel messages (id/type/payload/timestamp) with optional handleMessage()

const { parentPort, workerData } = require('worker_threads');
const { pathToFileURL } = require('url');
const path = require('path');

let plugin = null;
let memoryInterval = null;

async function loadPlugin(pluginPath) {
  try {
    let mod;
    const url = pathToFileURL(path.resolve(pluginPath)).href;
    try {
      // Try ESM dynamic import first
      mod = await import(url);
    } catch (esmErr) {
      // Fallback to CJS require
      mod = require(path.resolve(pluginPath));
    }
    plugin = mod && mod.default ? mod.default : mod;
  } catch (error) {
    parentPort.postMessage({ type: 'result', error: `Failed to load plugin: ${error && error.message ? error.message : String(error)}` });
  }
}

function startMemoryMonitor() {
  stopMemoryMonitor();
  memoryInterval = setInterval(() => {
    try {
      const usage = process.memoryUsage().heapUsed;
      parentPort.postMessage({ type: 'memory_usage', usage });
    } catch (_) {
      // noop
    }
  }, 10000);
}

function stopMemoryMonitor() {
  if (memoryInterval) {
    clearInterval(memoryInterval);
    memoryInterval = null;
  }
}

parentPort.on('message', async (message) => {
  try {
    // Handle secure channel message shape: must contain id/type/timestamp
    if (message && typeof message === 'object' && 'id' in message && 'type' in message && 'timestamp' in message) {
      let result;
      try {
        if (plugin && typeof plugin.handleMessage === 'function') {
          result = await plugin.handleMessage(message.type, message.payload);
        } else {
          result = { ok: true };
        }
      } catch (err) {
        result = { ok: false, error: err && err.message ? err.message : String(err) };
      }
      // Respond with same id; signature handling left to main if needed
      parentPort.postMessage({
        id: message.id,
        type: message.type,
        payload: result,
        timestamp: Date.now(),
        signature: message.signature,
        encrypted: false,
      });
      return;
    }

    // Execute request from WorkerPoolManager
    if (message && message.type === 'execute') {
      const method = message.method;
      const args = Array.isArray(message.args) ? message.args : [];

      if (!plugin) {
        await loadPlugin(workerData.pluginPath);
        startMemoryMonitor();
      }

      if (!plugin || typeof plugin[method] !== 'function') {
        parentPort.postMessage({ type: 'result', error: `Method ${method} not found on plugin` });
        parentPort.postMessage({ type: 'execution_complete' });
        return;
      }

      try {
        const res = await plugin[method](...args);
        parentPort.postMessage({ type: 'result', result: res });
      } catch (err) {
        parentPort.postMessage({ type: 'result', error: err && err.message ? err.message : String(err) });
      } finally {
        parentPort.postMessage({ type: 'execution_complete' });
      }
      return;
    }
  } catch (err) {
    parentPort.postMessage({ type: 'result', error: err && err.message ? err.message : String(err) });
    parentPort.postMessage({ type: 'execution_complete' });
  }
});

process.on('exit', async () => {
  try {
    stopMemoryMonitor();
    if (plugin && typeof plugin.cleanup === 'function') {
      await plugin.cleanup();
    }
  } catch (_) {
    // noop
  }
});

