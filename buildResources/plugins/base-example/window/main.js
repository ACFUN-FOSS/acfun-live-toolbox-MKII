// Window page script (ESM)
const el = document.getElementById('status');
const lifecycleEl = document.getElementById('lifecycle');

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
  const store = shared.readonlyStore;
  if (store) {
    el.textContent = `Readonly store (init): ${summarizeReadonlyStore(store)}`;
  } else {
    el.textContent = 'Readonly store not available in props.shared';
  }

  // 展示生命周期事件（来自父容器 postMessage）
  window.addEventListener('message', (evt) => {
    const data = evt?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'window-event' && data.eventType === 'lifecycle') {
      const info = `${String(data.event)} @ ${new Date().toLocaleTimeString()} (pluginId=${data.pluginId || 'unknown'}, popupId=${data.popupId || 'unknown'})`;
      lifecycleEl.textContent = info;
    }
    // 只读仓库刷新可按需处理
  });
} catch (err) {
  el.textContent = 'Runtime error: ' + (err && err.message ? err.message : String(err));
}
