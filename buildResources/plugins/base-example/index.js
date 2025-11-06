// Base Example Plugin (CommonJS)
// Exports minimal lifecycle hooks and a message handler.

let initialized = false;

async function init() {
  initialized = true;
  return { ok: true, message: 'base-example initialized' };
}

async function cleanup() {
  initialized = false;
  return { ok: true, message: 'base-example cleaned up' };
}

async function handleMessage(type, payload) {
  // Echo-style message handler for secure channel bridge
  if (type === 'ping') {
    return { pong: true, t: Date.now() };
  }
  return { ok: true, received: { type, payload }, initialized };
}

module.exports = { init, cleanup, handleMessage };

