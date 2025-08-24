// 登录页面逻辑

// 从URL获取查询参数
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    qrCodeUrl: params.get('qrCodeUrl') || '',
    token: params.get('token') || ''
  };
}

// 初始化登录页面
function initLoginPage() {
  const { qrCodeUrl, token } = getQueryParams();
  const qrCodeImg = document.getElementById('qr-code');
  const qrScannedIndicator = document.getElementById('qr-scanned-indicator');
  const loginStatus = document.getElementById('login-status');
  const refreshBtn = document.getElementById('refresh-qr');
  const cancelBtn = document.getElementById('cancel-login');

  // 显示二维码
  if (qrCodeUrl) {
    qrCodeImg.src = qrCodeUrl;
  } else {
    updateStatus('获取二维码失败，请点击刷新按钮重试');
  }

  // 监听扫码状态
  window.api.auth.onQrScanned(() => {
    qrScannedIndicator.classList.remove('hidden');
  });

  // 监听登录成功
  window.api.auth.onLoginSuccess((userInfo) => {
    updateStatus('登录成功，正在进入应用...');
    // 延迟关闭窗口，确保用户看到成功提示
    setTimeout(() => {
      window.close();
    }, 1500);
  });

  // 监听登录失败
  window.api.auth.onLoginFailed((error) => {
    updateStatus(error.message || '登录失败，请重试');
    qrScannedIndicator.classList.add('hidden');
  });

  // 刷新二维码
  refreshBtn.addEventListener('click', () => {
    updateStatus('正在刷新二维码...');
    window.api.auth.refreshQrCode(token).then((newData) => {
      qrCodeImg.src = newData.qrCodeUrl;
      qrScannedIndicator.classList.add('hidden');
      updateStatus('');
    }).catch((error) => {
      updateStatus('刷新二维码失败: ' + error.message);
    });
  });

  // 取消登录
  cancelBtn.addEventListener('click', () => {
    window.close();
  });
}

// 更新状态文本
function updateStatus(message) {
  const statusElement = document.getElementById('login-status');
  statusElement.textContent = message;
  statusElement.style.display = message ? 'block' : 'none';
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initLoginPage);