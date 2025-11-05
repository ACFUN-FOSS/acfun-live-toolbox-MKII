<template>
  <div class="grid-cell">
    <t-card hover-shadow title="欢迎">
      <div v-if="home.loading.A">
        <t-skeleton :row-col="[[{ width: '100%' }],[{ width: '100%' }]]" />
      </div>
      <t-alert v-else-if="home.error.A" theme="error" :message="home.error.A" closeBtn @close="home.retryCard('A')"></t-alert>
      <div v-else class="cell-body">
        <p class="welcome-tip">{{ welcomeText }}</p>
        <div class="guide-steps">
          <div class="step-item" role="link" tabindex="0" @click="goStep(1)" @keypress.enter="goStep(1)">
            <div class="step-number">1</div>
            <div class="step-content">
              <div class="step-title">登录或连接房间</div>
              <div class="step-desc">使用二维码登录账号，或直接连接直播房间（只读模式）</div>
            </div>
          </div>
          <div class="step-item" role="link" tabindex="0" @click="goStep(2)" @keypress.enter="goStep(2)">
            <div class="step-number">2</div>
            <div class="step-content">
              <div class="step-title">安装/启用所需插件</div>
              <div class="step-desc">在插件管理中安装弹幕弹窗、礼物提醒等功能插件</div>
            </div>
          </div>
          <div class="step-item" role="link" tabindex="0" @click="goStep(3)" @keypress.enter="goStep(3)">
            <div class="step-number">3</div>
            <div class="step-content">
              <div class="step-title">观察指标与日志</div>
              <div class="step-desc">在系统/控制台中查看实时数据和运行状态</div>
            </div>
          </div>
        </div>
      </div>
    </t-card>
  </div>
  
</template>

<script setup lang="ts">
import { useHomeStore } from '../../stores/home';
import { useRoleStore } from '../../stores/role';
import { useRouter } from 'vue-router';
import { computed } from 'vue';

const home = useHomeStore();
const role = useRoleStore();
const router = useRouter();

const welcomeText = computed(() => {
  switch (role.current) {
    case 'moderator':
      return '欢迎，管理员！按下按钮开始管理房间。';
    case 'developer':
      return '欢迎，开发者！按下按钮进入开发工具。';
    default:
      return '欢迎，主播！按下按钮开始直播相关功能。';
  }
});

const goStep = (n: number) => {
  if (n === 1) router.push('/live/room');
  else if (n === 2) router.push('/plugins/management');
  else router.push('/system/console');
};
</script>

<style scoped>
.cell-body { flex: 1; }
.welcome-tip { margin-bottom: 12px; color: var(--td-text-color-secondary); font-size: 14px; }
/* 步骤指南样式 */
.guide-steps { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.step-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px; background: var(--td-bg-color-container-hover); border-radius: 6px; cursor: pointer; transition: transform 0.12s ease, background-color 0.12s ease, box-shadow 0.12s ease; }
.step-item:hover { background: var(--td-bg-color-container-active); box-shadow: var(--td-shadow-2); transform: translateY(-1px); }
.step-item:focus { outline: none; box-shadow: 0 0 0 2px var(--td-brand-color-focus, var(--td-brand-color)); }
.step-number { width: 20px; height: 20px; border-radius: 50%; background: var(--td-brand-color); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; }
.step-content { flex: 1; }
.step-title { font-weight: 500; margin-bottom: 2px; color: var(--td-text-color-primary); }
.step-desc { font-size: 12px; color: var(--td-text-color-secondary); line-height: 1.4; }
</style>
