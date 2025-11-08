// Overlay page script (ESM)
const status = document.getElementById('status');
const lifecycleEl = document.getElementById('lifecycle');
const btnActionUp = document.getElementById('btn-action-up');
const btnUpdateSelf = document.getElementById('btn-update-self');
const btnCloseSelf = document.getElementById('btn-close-self');

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
  const qsOverlayId = (function(){
    try { return new URLSearchParams(window.location.search).get('overlayId'); } catch (_) { return null; }
  })();
  const refOverlayId = (function(){
    try { return new URLSearchParams(new URL(document.referrer).search).get('overlayId'); } catch (_) { return null; }
  })();
  const nameOverlayId = (function(){
    try {
      const nm = String(window.name || '');
      if (nm.startsWith('overlay:')) return nm.slice('overlay:'.length);
      const m = nm.match(/overlayId=([a-f0-9\-]+)/i);
      return m ? m[1] : null;
    } catch (_) { return null; }
  })();
  let overlayId = props.overlayId || qsOverlayId || refOverlayId || nameOverlayId || 'unknown';
  status.textContent = 'overlayId=' + overlayId;

  // Read initial readonly store from props.shared
  const store = props.shared && props.shared.readonlyStore;
  if (store) {
    status.textContent += ' | readonly(init) ' + summarizeReadonlyStore(store);
  }

  // Listen for parent → child postMessage events
  window.addEventListener('message', (evt) => {
    const data = evt?.data || {};
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'overlay-event') return;
    // 对齐 overlayId：若未知或与事件不一致，则以事件中的 overlayId 为准
    if (data.overlayId && data.overlayId !== overlayId) {
      overlayId = String(data.overlayId);
      status.textContent = 'overlayId=' + overlayId;
    }

    // 优先处理生命周期与只读快照事件，不受早期 overlayId 不一致影响
    if (data.eventType === 'overlay-message') {
      if (data.event === 'readonly-store-init') {
        status.textContent = 'overlayId=' + overlayId + ' | readonly(init) ' + summarizeReadonlyStore(safe(data.payload));
        return;
      }
      if (data.event === 'overlay-lifecycle') {
        const phase = data?.payload?.phase || 'unknown';
        const info = `${String(phase)} @ ${new Date().toLocaleTimeString()} (overlayId=${overlayId})`;
        if (lifecycleEl) lifecycleEl.textContent = info;
        return;
      }
      // 其他消息严格要求 overlayId 匹配
      if (data.overlayId !== overlayId) return;
      // General overlay message from UI/Window
      console.log('[Overlay] message:', data.event, safe(data.payload));
      if (data.event === 'ui-ping') {
        // 简单回显到状态文本
        status.textContent = 'overlayId=' + overlayId + ' | 收到 UI 消息: ui-ping';
      }
    }
  });

  // 上行动作演示（Overlay → 宿主）
  if (btnActionUp) {
    btnActionUp.addEventListener('click', () => {
      const payload = { from: 'overlay', t: Date.now() };
      if (props.api && typeof props.api.action === 'function') {
        try { props.api.action('say-hello', payload); } catch (e) { console.warn('[Overlay] api.action failed:', e); }
      } else {
        // 独立预览或无桥接时，采用 postMessage 回退（由宿主接收）
        window.parent?.postMessage({ type: 'overlay-action', overlayId, action: 'say-hello', data: payload }, '*');
      }
    });
  }

  // 自更新样式（通过桥接或 postMessage）
  if (btnUpdateSelf) {
    btnUpdateSelf.addEventListener('click', () => {
      const updates = { style: { border: '2px solid #60a5fa', opacity: 0.95 } };
      if (props.api && typeof props.api.update === 'function') {
        try { props.api.update(updates); } catch (e) { console.warn('[Overlay] api.update failed:', e); }
      } else {
        window.parent?.postMessage({ type: 'overlay-update', overlayId, updates }, '*');
      }
    });
  }

  // 自关闭（通过桥接或 postMessage）
  if (btnCloseSelf) {
    btnCloseSelf.addEventListener('click', () => {
      if (props.api && typeof props.api.close === 'function') {
        try { props.api.close(); } catch (e) { console.warn('[Overlay] api.close failed:', e); }
      } else {
        window.parent?.postMessage({ type: 'overlay-close', overlayId }, '*');
      }
    });
  }
} catch (err) {
  status.textContent = 'Runtime error: ' + (err && err.message ? err.message : String(err));
}
