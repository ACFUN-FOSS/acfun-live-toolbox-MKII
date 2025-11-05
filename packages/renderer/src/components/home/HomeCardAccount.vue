<template>
  <div class="grid-cell">
    <t-card hover-shadow title="账号">
      <div v-if="home.loading.B">
        <t-skeleton :row-col="[[{ width: '100%' }],[{ width: '70%' }],[{ width: '100%' }]]" />
      </div>
      <div v-else-if="home.error.B">
        <t-alert theme="error" :message="home.error.B" closeBtn @close="home.retryCard('B')"></t-alert>
        <div v-if="isAuthError(home.error.B)" class="empty-state">
          <span>请登录以继续</span>
          <t-button theme="primary" size="small" @click="showQrLogin"><t-icon name="qrcode" />登录</t-button>
        </div>
        <div v-else class="empty-state">
          暂无内容
          <t-button size="small" variant="outline" @click="home.retryCard('B')">重试</t-button>
        </div>
      </div>
      <div v-else class="account-body">
        <div v-if="!accountStore.isLoggedIn" class="login-section">
          <p class="login-text">您尚未登录</p>
          <t-button theme="primary" size="small" @click="showQrLogin"><t-icon name="qrcode" />登录</t-button>
        </div>
        <div v-else class="user-profile">
          <div class="profile-header">
            <div class="avatar-section">
              <img
                :src="accountStore.userInfo?.avatar || '/default-avatar.png'"
                :alt="accountStore.userInfo?.nickname || ''"
                class="user-avatar"
              >
            </div>
            <div class="profile-info">
              <h3 class="user-nickname">{{ accountStore.displayName }}</h3>
              <p class="user-uid">
                UID: {{ accountStore.userInfo?.userID || '-' }}
              </p>
              <p class="user-signature" :title="signatureTitle">
                {{ signatureText }}
                <t-link theme="primary" hover="underline" size="small" @click="openUserSpace">个人空间</t-link>
                &nbsp;<t-link theme="primary" hover="underline" size="small" @click="logout">退出登录</t-link>
              </p>
            
            </div>
          </div>
          <div class="profile-stats">
            <div class="stat-item">
              <div class="stat-title">粉丝数</div>
              <div class="stat-value">{{ formatCompact(fansCount) }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-title">关注数</div>
              <div class="stat-value">{{ formatCompact(followCount) }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-title">投稿数</div>
              <div class="stat-value">{{ formatCompact(contributeCount) }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-title">收藏数</div>
              <div class="stat-value">{{ formatCompact(likeCount) }}</div>
            </div>
          </div>
        </div>
      </div>
      
      
    </t-card>

    <!-- 二维码登录对话框 -->
    <t-dialog 
      :visible="qrDialogVisible"
      @update:visible="(v) => (qrDialogVisible = v)"
      title="二维码登录" 
      width="420px"
      :close-on-overlay-click="false"
    >
      <div class="qr-login-content">
        <div class="qr-code-section">
          <div v-if="qrSession.status === 'loading'" class="qr-loading">
            <t-loading size="small" text="正在生成二维码..." />
            <p class="status-text">请稍候</p>
          </div>
          <div v-else-if="qrSession.qrDataUrl" class="qr-display">
            <img :src="qrSession.qrDataUrl" class="qr-image" alt="登录二维码" />
            <div class="qr-status">
              <t-icon :name="getQrStatusIcon()" size="16px" :class="getQrStatusClass()" />
              <p class="status-text">{{ getQrStatusText() }}</p>
            </div>
            <t-button v-if="qrSession.status === 'expired'" variant="outline" size="small" @click="refreshQrCode">刷新二维码</t-button>
          </div>
          <div v-else class="qr-error">
            <t-icon name="close-circle" class="error-icon" />
            <p class="status-text">二维码生成失败，请重试</p>
            <t-button theme="primary" size="small" @click="refreshQrCode">重新生成</t-button>
          </div>
        </div>

        <div v-if="qrSession.expireAt" class="qr-countdown">
          <p>有效期剩余: {{ formatCountdown(qrSession.expireAt) }}</p>
        </div>

        <div class="qr-security-tip">
          <t-icon name="lock-on" size="16px" />
          <span>请确保仅在受信任设备上登录</span>
        </div>
      </div>

      <template #footer>
        <div class="qr-dialog-footer">
          <t-button variant="outline" @click="refreshQrCode">刷新二维码</t-button>
          <t-button theme="default" @click="cancelQrLogin">取消</t-button>
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAccountStore } from '../../stores/account';
import { useHomeStore } from '../../stores/home';
import { formatCompact } from '../../utils/format';

const accountStore = useAccountStore();
const home = useHomeStore();

// 统一模板所需的完整用户信息字段，避免在模板中使用 TS 断言
const fullInfo = computed(() => (accountStore.fullUserInfo as any) || null);
const signatureText = computed(() => fullInfo.value?.signature || '这个人很懒，什么都没写。');
const signatureTitle = computed(() => fullInfo.value?.signature || '');
const fansCount = computed(() => fullInfo.value?.fansCount ?? fullInfo.value?.fancount ?? 0);
const followCount = computed(() => fullInfo.value?.followCount ?? fullInfo.value?.followcount ?? 0);
const contributeCount = computed(() => fullInfo.value?.contributeCount ?? fullInfo.value?.contributecount ?? 0);
const likeCount = computed(() => fullInfo.value?.likeCount ?? fullInfo.value?.likecount ?? 0);

const isAuthError = (msg: string | null) => {
  if (!msg) return false;
  const low = msg.toLowerCase();
  return low.includes('401') || low.includes('unauthorized') || low.includes('未登录') || low.includes('权限');
};

// 二维码登录相关状态
const qrDialogVisible = ref(false);
const qrSession = ref({
  status: 'idle' as 'idle' | 'loading' | 'waiting' | 'scanned' | 'expired' | 'error' | 'success',
  qrDataUrl: '',
  expireAt: null as Date | null,
  sessionId: '',
  pollInterval: null as NodeJS.Timeout | null
});

let qrCountdownTimer: NodeJS.Timeout | null = null;
const currentTime = ref(new Date());

const showQrLogin = async () => {
  qrDialogVisible.value = true;
  await generateQrCode();
};

const generateQrCode = async () => {
  qrSession.value.status = 'loading';
  if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
  if (qrSession.value.pollInterval) { clearInterval(qrSession.value.pollInterval); qrSession.value.pollInterval = null; }
  try {
    const result = await window.electronApi.login.qrStart();
    if ('error' in result) throw new Error(result.error);
    if ('qrCodeDataUrl' in result) {
      qrSession.value.qrDataUrl = result.qrCodeDataUrl;
      qrSession.value.status = 'waiting';
      const expireAtMs = (result as any).expireAt ?? (typeof (result as any).expiresIn === 'number' ? Date.now() + (result as any).expiresIn * 1000 : undefined);
      qrSession.value.expireAt = typeof expireAtMs === 'number' ? new Date(expireAtMs) : null;
      if (qrSession.value.expireAt) startQrCountdown();
      startQrPolling();
    } else {
      throw new Error('获取登录二维码失败');
    }
  } catch (error) {
    console.error('生成二维码失败:', error);
    qrSession.value.status = 'error';
  }
};

const startQrPolling = () => {
  let pollInterval: NodeJS.Timeout;
  let retryCount = 0;
  const maxRetries = 3;
  const poll = async () => {
    if (qrSession.value.status !== 'waiting' && qrSession.value.status !== 'scanned') { clearInterval(pollInterval); return; }
    try {
      const result = await window.electronApi.login.qrCheck();
      retryCount = 0;
      if (result.success && result.tokenInfo) {
        qrSession.value.status = 'success';
        if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
        if (qrSession.value.pollInterval) { clearInterval(qrSession.value.pollInterval); qrSession.value.pollInterval = null; }
        try {
          const finalize = await window.electronApi.login.qrFinalize();
          const info = finalize.success && finalize.tokenInfo ? finalize.tokenInfo : result.tokenInfo;
          await accountStore.handleLoginSuccess(info);
        } catch (e) {
          console.warn('Finalize 调用失败，回退使用 check 的 tokenInfo');
          await accountStore.handleLoginSuccess(result.tokenInfo);
        }
        setTimeout(() => { qrDialogVisible.value = false; qrSession.value.status = 'idle'; }, 2000);
        clearInterval(pollInterval);
      } else if (result.error) {
        if (result.error.includes('请等待用户确认') || result.error.includes('已扫码')) {
          qrSession.value.status = 'scanned';
        } else if (result.error.includes('expired') || result.error.includes('过期')) {
          qrSession.value.status = 'expired';
          if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
          if (qrSession.value.pollInterval) { clearInterval(qrSession.value.pollInterval); qrSession.value.pollInterval = null; }
          clearInterval(pollInterval);
        } else if (result.error.includes('cancelled') || result.error.includes('取消')) {
          qrSession.value.status = 'error';
          if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
          if (qrSession.value.pollInterval) { clearInterval(qrSession.value.pollInterval); qrSession.value.pollInterval = null; }
          clearInterval(pollInterval);
        } else if (
          result.error.includes('请等待用户扫描') ||
          result.error.includes('请等待用户操作') ||
          result.error.includes('二维码状态为') ||
          result.error.includes('API错误') ||
          result.error.includes('No token info received') ||
          result.error.includes('result: 10') ||
          result.error.includes('代码: 10') ||
          result.error.includes('client error') ||
          result.error.includes('API调用失败')
        ) {
          // 正常等待状态，继续轮询
        } else {
          console.error('QR login error:', result.error);
          qrSession.value.status = 'error';
          if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
          if (qrSession.value.pollInterval) { clearInterval(qrSession.value.pollInterval); qrSession.value.pollInterval = null; }
          clearInterval(pollInterval);
        }
      }
    } catch (error) {
      console.error('轮询登录状态失败:', error);
      retryCount++;
      if (retryCount >= maxRetries) {
        console.error(`轮询失败次数过多 (${maxRetries}次)，停止轮询`);
        qrSession.value.status = 'error';
        clearInterval(pollInterval);
      }
    }
  };
  pollInterval = setInterval(poll, 2000);
  qrSession.value.pollInterval = pollInterval;
};

const startQrCountdown = () => {
  qrCountdownTimer = setInterval(() => {
    if (!qrSession.value.expireAt) return;
    currentTime.value = new Date();
    const now = currentTime.value;
    if (now >= qrSession.value.expireAt) {
      qrSession.value.status = 'expired';
      if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
      if (qrSession.value.pollInterval) { clearInterval(qrSession.value.pollInterval); qrSession.value.pollInterval = null; }
      setTimeout(() => { generateQrCode(); }, 1000);
    }
  }, 1000);
};

const refreshQrCode = () => { generateQrCode(); };

const cancelQrLogin = async () => {
  try { await window.electronApi.login.qrCancel(); } catch {}
  qrDialogVisible.value = false;
  qrSession.value.status = 'idle';
  if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
  if (qrSession.value.pollInterval) { clearInterval(qrSession.value.pollInterval); qrSession.value.pollInterval = null; }
  qrSession.value.sessionId = '';
  qrSession.value.qrDataUrl = '';
  qrSession.value.expireAt = null;
};

const logout = async () => { await accountStore.logout(); };

const openUserSpace = async () => {
  const id = (accountStore.userInfo as any)?.userID;
  if (!id) return;
  const url = `https://www.acfun.cn/u/${id}`;
  try {
    if (window.electronApi?.system?.openExternal) {
      const res = await window.electronApi.system.openExternal(url);
      if (!res?.success) {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  } catch {
    window.open(url, '_blank');
  }
};


// 辅助：状态展示
const getQrStatusIcon = () => {
  switch (qrSession.value.status) {
    case 'waiting': return 'qrcode';
    case 'scanned': return 'check-circle';
    case 'success': return 'check-circle';
    case 'expired': return 'time';
    case 'error': return 'close-circle';
    default: return 'qrcode';
  }
};

const getQrStatusClass = () => {
  switch (qrSession.value.status) {
    case 'waiting': return 'status-waiting';
    case 'scanned': return 'status-scanned';
    case 'success': return 'status-success';
    case 'expired': return 'status-expired';
    case 'error': return 'status-error';
    default: return '';
  }
};

const getQrStatusText = () => {
  switch (qrSession.value.status) {
    case 'waiting': return '请使用AcFun手机客户端扫码登录';
    case 'scanned': return '扫码成功，请在手机上确认登录';
    case 'success': return '登录成功！';
    case 'expired': return '二维码已过期，请刷新';
    case 'error': return '登录失败，请重试';
    default: return '';
  }
};

const formatCountdown = (expireAt: Date) => {
  const now = currentTime.value;
  const diff = Math.max(0, expireAt.getTime() - now.getTime());
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
</script>

<style scoped>
.account-body { padding: 0 0 12px 0; }
.login-section { padding: 24px; text-align: center; }
.login-text { color: var(--td-text-color-secondary); margin: 0 0 8px 0; }
.user-profile { padding: 16px; }
 .profile-header { display: flex; gap: 16px; margin-bottom: 36px; align-items: center; }
 .avatar-section { flex-shrink: 0; display: flex; align-items: center; }
 .user-avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 2px solid var(--td-border-level-1-color); }
.profile-info { flex: 1; }
.user-nickname { margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: var(--td-text-color-primary); }
.user-uid { margin: 4px 0; font-size: 12px; color: var(--td-text-color-secondary); }
.user-signature { margin: 4px 0; font-size: 12px; color: var(--td-text-color-secondary); display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.action-buttons { display: flex; gap: 8px; margin-top: 8px; }
.profile-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
.stat-item { text-align: center; padding: 6px 0; background: var(--td-bg-color-container-hover); border-radius: 6px; cursor: pointer; transition: transform 0.12s ease, background-color 0.12s ease, box-shadow 0.12s ease; }
.stat-item:hover { background: var(--td-bg-color-container-active); box-shadow: var(--td-shadow-2); transform: translateY(-1px); }
.stat-item:active { transform: translateY(0); }
.stat-title { font-size: 12px; color: var(--td-text-color-secondary); margin-bottom: 2px; }
.stat-value { font-size: 14px; font-weight: 600; color: var(--td-text-color-primary); }

.empty-state { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; color: var(--td-text-color-secondary); }


.qr-login-content { padding: 16px; text-align: center; }
.qr-image { width: 200px; height: 200px; border: 1px solid var(--td-border-level-1-color); border-radius: 8px; }
.qr-status { display: flex; align-items: center; justify-content: center; gap: 8px; }
.status-text { margin: 0; font-size: 14px; }
.status-waiting { color: var(--td-brand-color); }
.status-scanned { color: var(--td-warning-color); }
.status-success { color: var(--td-success-color); }
.status-expired { color: var(--td-error-color); }
.status-error { color: var(--td-error-color); }
.error-icon { color: var(--td-error-color); font-size: 24px; }
.qr-countdown { margin-top: 12px; padding: 8px 12px; background: var(--td-bg-color-container-hover); border-radius: 4px; font-size: 12px; color: var(--td-text-color-secondary); }
.qr-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; }
</style>