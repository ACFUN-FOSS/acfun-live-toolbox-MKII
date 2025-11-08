// UI page script (ESM)
const lifecycleEl = document.getElementById('lifecycle');
const configEl = document.getElementById('config');
const cfgEnableEl = document.getElementById('cfg-enable');
const cfgIntervalEl = document.getElementById('cfg-interval');
const cfgTokenEl = document.getElementById('cfg-token');
const btnSaveCfg = document.getElementById('btn-save-config');
const btnResetCfg = document.getElementById('btn-reset-config');
const cfgWriteStatusEl = document.getElementById('config-write-status');
const cfgCurrentEl = document.getElementById('config-current');
const btnCreate = document.getElementById('btn-create');
const btnUpdate = document.getElementById('btn-update');
const btnList = document.getElementById('btn-list');
const overlayStatusEl = document.getElementById('overlay-status');
const storeJsonEl = document.getElementById('store-json');
const btnSendMsg = document.getElementById('btn-send-msg');

function safe(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  try { return JSON.parse(JSON.stringify(obj)); } catch (_) { return obj; }
}

function summarizeReadonlyStore(store) {
  try {
    const roomsCount = store?.rooms?.list?.length ?? 0;
    const liveCount = store?.rooms?.liveRoomsCount ?? 0;
    const totalViewers = store?.rooms?.totalViewers ?? 0;
    return `rooms=${roomsCount}, live=${liveCount}, viewers=${totalViewers}`;
  } catch (_) {
    return 'unavailable';
  }
}

try {
  const props = window.__WUJIE_PROPS__ || {};
  // 建立基于 postMessage 的桥接 API，当未注入原生 props.api 时自动启用
  (function ensureBridgeApi() {
    // 推断 pluginId
    let pid = props.pluginId;
    try {
      const parts = location.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('plugins');
      if (idx !== -1 && parts.length > idx + 1) {
        pid = pid || parts[idx + 1];
      }
    } catch (_) {}
    props.pluginId = pid;

    // 若已有原生 API，则不覆盖
    const api = props.api || {};
    if (typeof api.getConfig === 'function') {
      return;
    }

    const pending = new Map();
    function request(command, payload) {
      return new Promise((resolve, reject) => {
        const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        pending.set(requestId, { resolve, reject });
        window.parent.postMessage({ type: 'bridge-request', requestId, command, pluginId: pid, payload }, '*');
        setTimeout(() => {
          const p = pending.get(requestId);
          if (p) {
            pending.delete(requestId);
            reject(new Error('bridge timeout'));
          }
        }, 10000);
      });
    }

    window.addEventListener('message', (evt) => {
      const msg = evt?.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'bridge-response' && msg.requestId && pending.has(msg.requestId)) {
        const p = pending.get(msg.requestId);
        pending.delete(msg.requestId);
        if (msg.success) {
          p.resolve(msg.data);
        } else {
          p.reject(new Error(String(msg.error || 'bridge error')));
        }
      }
    });

    const overlay = {
      create: (options) => request('overlay', { action: 'create', args: [options] }),
      close: (overlayId) => request('overlay', { action: 'close', args: [overlayId] }),
      show: (overlayId) => request('overlay', { action: 'show', args: [overlayId] }),
      hide: (overlayId) => request('overlay', { action: 'hide', args: [overlayId] }),
      bringToFront: (overlayId) => request('overlay', { action: 'bringToFront', args: [overlayId] }),
      update: (overlayId, updates) => request('overlay', { action: 'update', args: [overlayId, updates] }),
      list: () => request('overlay', { action: 'list', args: [] }),
      send: (overlayId, event, payload) => request('overlay', { action: 'send', args: [overlayId, event, payload] })
    };

    props.api = {
      getConfig: () => request('get-config', {}),
      overlay
    };
    // 通知宿主：UI 已就绪，触发初始化消息与事件派发
    try { window.parent.postMessage({ type: 'ui-ready', pluginId: props.pluginId }, '*'); } catch (_) {}
  })();
  // 读取只读仓库不再依赖 props.shared，等待宿主派发事件

  // 读取配置
  (async () => {
    try {
      const api = props.api || {};
      if (typeof api.getConfig === 'function') {
        const cfg = await api.getConfig();
        // 初始化显示与表单默认值
        configEl.textContent = `配置: ${JSON.stringify(safe(cfg))}`;
        // 展示当前配置（不包含敏感字段，如 token）
        const stripped = stripSensitive(cfg);
        configEl.textContent = `配置: ${JSON.stringify(stripped)}`;
      } else {
        configEl.textContent = 'api.getConfig 不可用';
      }
    } catch (e) {
      configEl.textContent = '配置读取失败: ' + (e?.message || String(e));
    }
  })();

  // Overlay 演示
  let createdOverlayId = null;
  // 判断是否可用的桥接 API（仅在应用内通过 Wujie/Preload 注入）
  const api = props.api || {};
  const overlayBridgeAvailable = !!(api.overlay && typeof api.overlay.create === 'function');
  if (!overlayBridgeAvailable) {
    // 独立静态预览场景：禁用所有 Overlay 操作按钮并给出说明
    btnCreate && btnCreate.setAttribute('disabled', 'true');
    btnUpdate && btnUpdate.setAttribute('disabled', 'true');
    btnList && btnList.setAttribute('disabled', 'true');
    btnSendMsg && btnSendMsg.setAttribute('disabled', 'true');
    if (overlayStatusEl) {
      overlayStatusEl.textContent = 'Overlay API 未注入（仅在应用内可用）';
    }
  }
  if (btnCreate) {
    btnCreate.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (!api.overlay || typeof api.overlay.create !== 'function') {
          overlayStatusEl.textContent = 'overlay.create 不可用';
          return;
        }
        // 使用插件ID作为 Overlay 唯一标识，统一跨源实例
        const overlayId = String(props.pluginId || 'base-example');
        const res = await api.overlay.create({
          id: overlayId,
          type: 'default',
          title: 'Base Example Overlay',
          description: '由 UI 页面创建',
          position: { x: 24, y: 24 },
          size: { width: 360 },
          style: { opacity: 0.97, borderRadius: '8px' },
          pluginId: props.pluginId
        });
        if (res && res.success) {
          createdOverlayId = overlayId;
          btnUpdate?.removeAttribute('disabled');
          btnSendMsg?.removeAttribute('disabled');
          overlayStatusEl.textContent = `已创建: ${overlayId}`;
        } else {
          // 若已存在，则启用操作按钮以便后续操作
          try {
            const listRes = await api.overlay.list();
            const exists = listRes && listRes.success && Array.isArray(listRes.data) && listRes.data.some((o) => {
              const id = o?.id || o?.overlayId;
              return String(id) === String(overlayId);
            });
            if (exists) {
              createdOverlayId = overlayId;
              btnUpdate?.removeAttribute('disabled');
              btnSendMsg?.removeAttribute('disabled');
              overlayStatusEl.textContent = `已存在: ${overlayId}，可操作`;
            } else {
              overlayStatusEl.textContent = '创建失败: ' + (res?.error || 'unknown');
            }
          } catch (_) {
            overlayStatusEl.textContent = '创建失败: ' + (res?.error || 'unknown');
          }
        }
      } catch (e) {
        overlayStatusEl.textContent = '创建异常: ' + (e?.message || String(e));
      }
    });
  }

  if (btnUpdate) {
    btnUpdate.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (!createdOverlayId) return (overlayStatusEl.textContent = '尚未创建 Overlay');
        if (!api.overlay || typeof api.overlay.update !== 'function') return (overlayStatusEl.textContent = 'overlay.update 不可用');
        const r = await api.overlay.update(createdOverlayId, {
          style: { opacity: 0.9, border: '2px solid #34d399' },
          size: { width: 400 }
        });
        overlayStatusEl.textContent = r && r.success ? `已更新样式: ${createdOverlayId}` : '更新失败: ' + (r?.error || 'unknown');
      } catch (e) {
        overlayStatusEl.textContent = '更新异常: ' + (e?.message || String(e));
      }
    });
  }

  if (btnList) {
    btnList.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (!api.overlay || typeof api.overlay.list !== 'function') return (overlayStatusEl.textContent = 'overlay.list 不可用');
        const r = await api.overlay.list();
        overlayStatusEl.textContent = r && r.success ? `当前 overlays: ${JSON.stringify(safe(r.data || []))}` : '列举失败: ' + (r?.error || 'unknown');
      } catch (e) {
        overlayStatusEl.textContent = '列举异常: ' + (e?.message || String(e));
      }
    });
  }

  // UI → Overlay 下行消息演示
  if (btnSendMsg) {
    btnSendMsg.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (!createdOverlayId) return (overlayStatusEl.textContent = '尚未创建 Overlay');
        if (!api.overlay || typeof api.overlay.send !== 'function') return (overlayStatusEl.textContent = 'overlay.send 不可用');
        const payload = { from: 'ui', t: Date.now() };
        const r = await api.overlay.send(createdOverlayId, 'ui-ping', payload);
        overlayStatusEl.textContent = r && r.success ? `已发送消息到 ${createdOverlayId}` : '发送失败: ' + (r?.error || 'unknown');
      } catch (e) {
        overlayStatusEl.textContent = '发送异常: ' + (e?.message || String(e));
      }
    });
  }

  // Listen for readonly-store init/update events from parent
  window.addEventListener('message', (evt) => {
    const data = evt?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'plugin-event' && data.eventType === 'readonly-store') {
      const payload = safe(data.payload);
      const text = JSON.stringify(payload, null, 2);
      if (data.event === 'readonly-store-init') {
        if (storeJsonEl) storeJsonEl.textContent = text;
      } else if (data.event === 'readonly-store-update') {
        if (storeJsonEl) storeJsonEl.textContent = text;
      }
    }

    // Lifecycle 事件展示
    if (data.type === 'plugin-event' && data.eventType === 'lifecycle') {
      const info = `${String(data.event)} @ ${new Date().toLocaleTimeString()} (pluginId=${props.pluginId || 'unknown'})`;
      lifecycleEl.textContent = info;
    }
  });

  // 已移除：配置写入与热更新演示（按用户要求删除）
} catch (err) {
}

// 工具：移除敏感字段（例如 token），不向插件展示
function stripSensitive(cfg) {
  try {
    const copy = safe(cfg || {});
    if (copy && typeof copy === 'object' && 'token' in copy) {
      delete copy.token;
    }
    return copy;
  } catch (_) {
    return cfg;
  }
}
