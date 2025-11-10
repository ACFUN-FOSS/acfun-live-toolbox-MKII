module.exports = {
  async init() {
    return { ok: true, message: 'sample-overlay-ui initialized' };
  },

  async cleanup() {
    return { ok: true };
  },

  async handleMessage(type, payload) {
    if (type === 'ping') {
      return { ok: true, pong: true };
    }
    return { ok: true };
  }
};
