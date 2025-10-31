<template>
  <section class="login-page">
    <h2>登录状态</h2>
    <div class="login-actions">
      <button class="btn" @click="startQrLogin" :disabled="loginState==='qr_ready'">开始扫码登录</button>
      <button class="btn" @click="logout">退出登录</button>
    </div>
    <div v-if="loginState==='qr_ready'" class="qr-box">
      <img :src="qrDataUrl" alt="QR Code" />
      <div class="hint">请使用 AcFun App 扫码，二维码有效期约 {{ expiresIn }} 秒。</div>
      <div class="hint" v-if="pollStatus">{{ pollStatus }}</div>
    </div>
    <div v-else-if="loginState==='success'" class="success">登录成功：用户 {{ loginUserId }}</div>
    <div v-else-if="loginState==='error'" class="error">{{ pollStatus || '登录失败' }}</div>
  </section>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';

const loginState = ref<'idle'|'qr_ready'|'success'|'error'>('idle');
const qrDataUrl = ref<string>('');
const expiresIn = ref<number>(0);
const pollStatus = ref<string>('');
const loginUserId = ref<string>('');
let pollTimer: any = null;
const refreshAttempts = ref<number>(0);

async function startQrLogin() {
  try {
    const res = await window.electronApi.login.qrStart();
    if ((res as any)?.error) {
      loginState.value = 'error';
      pollStatus.value = (res as any).error;
      return;
    }
    const data = res as { qrCodeDataUrl: string; expiresIn: number };
    qrDataUrl.value = data.qrCodeDataUrl;
    expiresIn.value = data.expiresIn;
    loginState.value = 'qr_ready';
    pollStatus.value = '等待扫码…';
    pollTimer && clearTimeout(pollTimer);
    pollTimer = setInterval(async () => {
      const st = await window.electronApi.login.qrCheck();
      if (st.success) {
        loginUserId.value = st.userId || '';
        loginState.value = 'success';
        pollStatus.value = '';
        clearInterval(pollTimer);
        pollTimer = null;
      } else if (st.error) {
        if (/过期/i.test(st.error)) {
          clearInterval(pollTimer);
          pollTimer = null;
          if (refreshAttempts.value < 3) {
            refreshAttempts.value++;
            pollStatus.value = '二维码已过期，正在刷新…';
            await startQrLogin();
          } else {
            loginState.value = 'error';
            pollStatus.value = st.error;
          }
        } else if (/取消/i.test(st.error)) {
          clearInterval(pollTimer);
          pollTimer = null;
          loginState.value = 'error';
          pollStatus.value = st.error;
        } else {
          pollStatus.value = st.error;
        }
      }
    }, 2000);
  } catch (e: any) {
    loginState.value = 'error';
    pollStatus.value = e?.message || String(e);
  }
}

async function logout() {
  try {
    await window.electronApi.login.logout();
    loginState.value = 'idle';
    loginUserId.value = '';
    qrDataUrl.value = '';
    expiresIn.value = 0;
  pollStatus.value = '';
  pollTimer && clearInterval(pollTimer);
  pollTimer = null;
  refreshAttempts.value = 0;
  } catch {}
}

onUnmounted(() => {
  pollTimer && clearInterval(pollTimer);
});
</script>

<style scoped>
.login-page { margin-top: 16px; }
.login-actions { display:flex; gap:12px; margin:8px 0; }
.qr-box { margin-top: 8px; display:flex; align-items:center; gap:12px; }
.qr-box img { width: 180px; height: 180px; border:1px solid var(--td-border-color); }
.hint { color: var(--td-text-color-secondary); font-size: 12px; }
.success { color: var(--td-success-color); }
.error { color: var(--td-error-color); }
.btn { padding: 6px 12px; }
</style>