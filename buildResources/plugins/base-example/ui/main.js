// UI page script (ESM)
const el = document.getElementById('status');
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
const btnClose = document.getElementById('btn-close');
const btnShow = document.getElementById('btn-show');
const btnHide = document.getElementById('btn-hide');
const btnFront = document.getElementById('btn-front');
const btnUpdate = document.getElementById('btn-update');
const btnList = document.getElementById('btn-list');
const overlayStatusEl = document.getElementById('overlay-status');

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
  const shared = props.shared || {};
  const initial = shared.readonlyStore;
  if (initial) {
    el.textContent = `Readonly store (init): ${summarizeReadonlyStore(initial)}`;
  } else {
    el.textContent = 'Readonly store not available in props.shared';
  }

  // 读取配置
  (async () => {
    try {
      const api = props.api || {};
      if (typeof api.getConfig === 'function') {
        const cfg = await api.getConfig();
        // 初始化显示与表单默认值
        configEl.textContent = `配置: ${JSON.stringify(safe(cfg))}`;
        const enable = !!cfg?.enableFeature;
        const interval = Number.isFinite(cfg?.refreshInterval) ? Number(cfg.refreshInterval) : 30;
        const token = typeof cfg?.token === 'string' ? cfg.token : '';
        if (cfgEnableEl) cfgEnableEl.checked = enable;
        if (cfgIntervalEl) cfgIntervalEl.value = String(interval);
        if (cfgTokenEl) cfgTokenEl.value = token;
        // 去敏后展示当前配置
        const masked = maskConfig(cfg);
        if (cfgCurrentEl) cfgCurrentEl.textContent = `当前配置：${JSON.stringify(masked)}`;
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
    btnClose && btnClose.setAttribute('disabled', 'true');
    btnShow && btnShow.setAttribute('disabled', 'true');
    btnHide && btnHide.setAttribute('disabled', 'true');
    btnFront && btnFront.setAttribute('disabled', 'true');
    btnUpdate && btnUpdate.setAttribute('disabled', 'true');
    btnList && btnList.setAttribute('disabled', 'true');
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
        const overlayId = 'base-example-demo-overlay';
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
          btnClose.removeAttribute('disabled');
          btnShow?.removeAttribute('disabled');
          btnHide?.removeAttribute('disabled');
          btnFront?.removeAttribute('disabled');
          btnUpdate?.removeAttribute('disabled');
          const btnSendMsg = document.getElementById('btn-send-msg');
          btnSendMsg?.removeAttribute('disabled');
          overlayStatusEl.textContent = `已创建: ${overlayId}`;
        } else {
          overlayStatusEl.textContent = '创建失败: ' + (res?.error || 'unknown');
        }
      } catch (e) {
        overlayStatusEl.textContent = '创建异常: ' + (e?.message || String(e));
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (!createdOverlayId) {
          overlayStatusEl.textContent = '尚未创建 Overlay';
          return;
        }
        if (!api.overlay || typeof api.overlay.close !== 'function') {
          overlayStatusEl.textContent = 'overlay.close 不可用';
          return;
        }
        const res = await api.overlay.close(createdOverlayId);
        if (res && res.success) {
          overlayStatusEl.textContent = `已关闭: ${createdOverlayId}`;
          createdOverlayId = null;
          btnClose.setAttribute('disabled', 'true');
          btnShow?.setAttribute('disabled', 'true');
          btnHide?.setAttribute('disabled', 'true');
          btnFront?.setAttribute('disabled', 'true');
          btnUpdate?.setAttribute('disabled', 'true');
        } else {
          overlayStatusEl.textContent = '关闭失败: ' + (res?.error || 'unknown');
        }
      } catch (e) {
        overlayStatusEl.textContent = '关闭异常: ' + (e?.message || String(e));
      }
    });
  }

  if (btnShow) {
    btnShow.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (!createdOverlayId) return (overlayStatusEl.textContent = '尚未创建 Overlay');
        if (!api.overlay || typeof api.overlay.show !== 'function') return (overlayStatusEl.textContent = 'overlay.show 不可用');
        const r = await api.overlay.show(createdOverlayId);
        overlayStatusEl.textContent = r && r.success ? `已显示: ${createdOverlayId}` : '显示失败: ' + (r?.error || 'unknown');
      } catch (e) {
        overlayStatusEl.textContent = '显示异常: ' + (e?.message || String(e));
      }
    });
  }

  if (btnHide) {
    btnHide.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (!createdOverlayId) return (overlayStatusEl.textContent = '尚未创建 Overlay');
        if (!api.overlay || typeof api.overlay.hide !== 'function') return (overlayStatusEl.textContent = 'overlay.hide 不可用');
        const r = await api.overlay.hide(createdOverlayId);
        overlayStatusEl.textContent = r && r.success ? `已隐藏: ${createdOverlayId}` : '隐藏失败: ' + (r?.error || 'unknown');
      } catch (e) {
        overlayStatusEl.textContent = '隐藏异常: ' + (e?.message || String(e));
      }
    });
  }

  if (btnFront) {
    btnFront.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (!createdOverlayId) return (overlayStatusEl.textContent = '尚未创建 Overlay');
        if (!api.overlay || typeof api.overlay.bringToFront !== 'function') return (overlayStatusEl.textContent = 'overlay.bringToFront 不可用');
        const r = await api.overlay.bringToFront(createdOverlayId);
        overlayStatusEl.textContent = r && r.success ? `已置顶: ${createdOverlayId}` : '置顶失败: ' + (r?.error || 'unknown');
      } catch (e) {
        overlayStatusEl.textContent = '置顶异常: ' + (e?.message || String(e));
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
  const btnSendMsg = document.getElementById('btn-send-msg');
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
      if (data.event === 'readonly-store-init') {
        el.textContent = `Readonly store (init event): ${summarizeReadonlyStore(payload)}`;
      } else if (data.event === 'readonly-store-update') {
        el.textContent = `Readonly store (update): ${summarizeReadonlyStore(payload)}`;
      }
    }

    // Lifecycle 事件展示
    if (data.type === 'plugin-event' && data.eventType === 'lifecycle') {
      const info = `${String(data.event)} @ ${new Date().toLocaleTimeString()} (pluginId=${props.pluginId || 'unknown'})`;
      lifecycleEl.textContent = info;
    }
  });

  // 配置写入与热更新演示
  if (btnSaveCfg) {
    btnSaveCfg.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (typeof api.setConfig !== 'function') {
          cfgWriteStatusEl.textContent = 'api.setConfig 不可用';
          return;
        }
        const nextCfg = {
          enableFeature: !!cfgEnableEl?.checked,
          refreshInterval: Number(cfgIntervalEl?.value || 30),
          token: String(cfgTokenEl?.value || '')
        };
        const res = await api.setConfig(nextCfg);
        if (!res?.success) {
          cfgWriteStatusEl.textContent = '保存失败: ' + (res?.error || 'unknown');
        } else {
          cfgWriteStatusEl.textContent = '保存成功，已热更新配置';
          const fresh = await api.getConfig();
          const masked = maskConfig(fresh);
          cfgCurrentEl.textContent = `当前配置：${JSON.stringify(masked)}`;
        }
      } catch (e) {
        cfgWriteStatusEl.textContent = '保存异常: ' + (e?.message || String(e));
      }
    });
  }

  if (btnResetCfg) {
    btnResetCfg.addEventListener('click', async () => {
      try {
        const api = props.api || {};
        if (typeof api.getConfig !== 'function') return;
        const cfg = await api.getConfig();
        const enable = !!cfg?.enableFeature;
        const interval = Number.isFinite(cfg?.refreshInterval) ? Number(cfg.refreshInterval) : 30;
        const token = typeof cfg?.token === 'string' ? cfg.token : '';
        if (cfgEnableEl) cfgEnableEl.checked = enable;
        if (cfgIntervalEl) cfgIntervalEl.value = String(interval);
        if (cfgTokenEl) cfgTokenEl.value = token;
        cfgWriteStatusEl.textContent = '已重置为当前配置';
        const masked = maskConfig(cfg);
        cfgCurrentEl.textContent = `当前配置：${JSON.stringify(masked)}`;
      } catch (e) {
        cfgWriteStatusEl.textContent = '重置异常: ' + (e?.message || String(e));
      }
    });
  }
} catch (err) {
  el.textContent = 'Runtime error: ' + (err && err.message ? err.message : String(err));
}

// 工具：配置去敏
function maskConfig(cfg) {
  try {
    const copy = safe(cfg || {});
    if (typeof copy.token === 'string' && copy.token.length > 0) {
      const len = copy.token.length;
      const tail = copy.token.slice(Math.max(0, len - 4));
      copy.token = `***${tail}`;
    }
    return copy;
  } catch (_) {
    return cfg;
  }
}
