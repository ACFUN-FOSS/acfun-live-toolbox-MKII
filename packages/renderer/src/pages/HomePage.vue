<template>
  <div class="home-page">
    <div class="home-grid">
      <HomeCardWelcome />
      <HomeCardAccount />
      <HomeCardRole />
      <HomeCardDocs />
    </div>
    <!-- 欢迎引导卡片（隐藏旧版） -->
    <t-card
      v-if="false"
      class="welcome-card"
      title="欢迎使用 ACLiveFrame"
      hover-shadow
    >
      <div class="welcome-content">
        <p class="welcome-text">
          快速开始使用本工具的三个步骤：
        </p>
        <div class="guide-steps">
          <div class="step-item">
            <div class="step-number">
              1
            </div>
            <div class="step-content">
              <div class="step-title">
                登录或连接房间
              </div>
              <div class="step-desc">
                使用二维码登录账号，或直接连接直播房间（只读模式）
              </div>
            </div>
          </div>
          <div class="step-item">
            <div class="step-number">
              2
            </div>
            <div class="step-content">
              <div class="step-title">
                安装/启用所需插件
              </div>
              <div class="step-desc">
                在插件管理中安装弹幕弹窗、礼物提醒等功能插件
              </div>
            </div>
          </div>
          <div class="step-item">
            <div class="step-number">
              3
            </div>
            <div class="step-content">
              <div class="step-title">
                观察指标与日志
              </div>
              <div class="step-desc">
                在系统/控制台中查看实时数据和运行状态
              </div>
            </div>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 用户信息卡片（隐藏旧版） -->
    <t-card
      v-if="false"
      class="user-info-card"
      title="用户信息"
      hover-shadow
    >
      <div
        v-if="!accountStore.isLoggedIn"
        class="login-section"
      >
        <div class="login-prompt">
          <t-icon
            name="user"
            size="48px"
            class="login-icon"
          />
          <p class="login-text">
            您尚未登录，点击下方按钮使用二维码登录
          </p>
          <t-button
            theme="primary"
            size="large"
            @click="showQrLogin"
          >
            <t-icon name="qrcode" />
            登录
          </t-button>
        </div>
      </div>
      <div
        v-else
        class="user-profile"
      >
        <div class="profile-header">
          <div class="avatar-section">
            <img
              :src="accountStore.userInfo?.avatar || '/default-avatar.png'" 
              :alt="accountStore.userInfo?.nickname" 
              class="user-avatar"
            >
          </div>
          <div class="profile-info">
            <h3 class="user-nickname">
              {{ accountStore.displayName }}
            </h3>
            <p class="user-uid">
              UID: {{ accountStore.userInfo?.userID || 'N/A' }}
            </p>
            <p class="login-method">
              登录方式: 二维码
            </p>
            <p
              v-if="roomStore.liveRooms.length > 0"
              class="recent-room"
            >
              活跃房间: {{ roomStore.liveRooms[0].name }}
            </p>
          </div>
        </div>
        <div class="profile-actions">
          <t-button
            variant="outline"
            size="small"
            @click="switchAccount"
          >
            切换账号
          </t-button>
          <t-button
            variant="outline"
            size="small"
            @click="logout"
          >
            登出
          </t-button>
        </div>
      </div>
    </t-card>

    <!-- KPI统计区域（隐藏旧版） -->
    <t-card
      v-if="false"
      class="kpi-section"
      title="关键指标统计"
      hover-shadow
    >
      <div class="kpi-row">
        <div class="kpi-item">
          <t-statistic 
            title="直播时长" 
            :value="kpiData.liveTime" 
            suffix="分钟"
            :loading="kpiLoading"
          />
        </div>
        <div class="kpi-item">
          <t-statistic 
            title="礼物数" 
            :value="kpiData.giftCount" 
            :loading="kpiLoading"
          />
        </div>
        <div class="kpi-item">
          <t-statistic 
            title="弹幕数" 
            :value="kpiData.danmuCount" 
            :loading="kpiLoading"
          />
        </div>
        <div class="kpi-item">
          <t-statistic 
            title="点赞数" 
            :value="kpiData.likeCount" 
            :loading="kpiLoading"
          />
        </div>
      </div>
      
      <!-- 迷你趋势图 -->
      <div
        v-if="!kpiLoading"
        class="chart-section"
      >
        <h4 class="chart-title">
          实时趋势（最近10分钟）
        </h4>
        <div
          ref="chartContainer"
          class="mini-chart"
        />
      </div>
    </t-card>

    <!-- 已迁移到账号卡片的二维码登录对话框（删除） -->

    <!-- 首次登录角色选择对话框 -->
    <t-dialog
      v-model:visible="role.firstLoginRoleDialogVisible"
      title="选择你的使用角色"
      :close-on-overlay-click="false"
    >
      <t-radio-group :value="role.current" @change="(v:any)=>role.setRole(v)">
        <t-radio value="anchor">主播</t-radio>
        <t-radio value="moderator">房管</t-radio>
        <t-radio value="developer">开发者</t-radio>
      </t-radio-group>
      <template #footer>
        <t-space>
          <t-button theme="primary" @click="confirmRoleAndInit">确定</t-button>
        </t-space>
      </template>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useHomeStore } from '../stores/home';
import { useRoleStore } from '../stores/role';
import HomeCardWelcome from '../components/home/HomeCardWelcome.vue';
import HomeCardAccount from '../components/home/HomeCardAccount.vue';
import HomeCardRole from '../components/home/HomeCardRole.vue';
import HomeCardDocs from '../components/home/HomeCardDocs.vue';

const home = useHomeStore();
const role = useRoleStore();

const confirmRoleAndInit = async () => {
  role.confirmFirstLoginRole();
  await home.fetchRoleSpecific();
};

onMounted(async () => {
  await home.initialize();
});
</script>

<style scoped>
.home-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow-y: hidden;
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 12px;
  height: 100%;
}

/* 使网格中的每个卡片在子组件内也保持等高 */
.home-grid :deep(.grid-cell) {
  height: 100%;
}

.home-grid :deep(.grid-cell .t-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.home-grid :deep(.grid-cell .t-card .t-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.cell-body {
  flex: 1;
}

/* 欢迎卡片样式 */
.welcome-card {
  margin-bottom: 16px;
}

.welcome-content {
  padding: 8px 0;
}

.welcome-text {
  margin-bottom: 16px;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--td-bg-color-container-hover);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.step-item:hover {
  background: var(--td-bg-color-container-active);
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--td-brand-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-title {
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--td-text-color-primary);
}

.step-desc {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 1.4;
}

/* 用户信息卡片样式 */
.user-info-card {
  margin-bottom: 16px;
}

.login-section {
  padding: 24px;
  text-align: center;
}

.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.login-icon {
  color: var(--td-text-color-placeholder);
}

.login-text {
  color: var(--td-text-color-secondary);
  margin: 0;
}

.user-profile {
  padding: 16px;
}

.profile-header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.avatar-section {
  flex-shrink: 0;
}

.user-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--td-border-level-1-color);
}

.profile-info {
  flex: 1;
}

.user-nickname {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.user-uid,
.login-method,
.recent-room {
  margin: 4px 0;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.user-signature {
  margin: 4px 0;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.profile-actions {
  display: flex;
  gap: 8px;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.docs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.docs-item .docs-title {
  font-weight: 500;
}

.docs-item .docs-desc {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

/* KPI统计区域样式 */
.kpi-section {
  margin-bottom: 16px;
}

.kpi-row {
  margin-bottom: 16px;
}

.chart-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.chart-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.mini-chart {
  height: 200px;
  width: 100%;
}

/* 二维码登录对话框样式 */
.qr-login-content {
  padding: 16px;
  text-align: center;
}

.qr-code-section {
  margin-bottom: 16px;
}

.qr-loading,
.qr-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
}

.qr-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.qr-image {
  width: 200px;
  height: 200px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
}

.qr-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  margin: 0;
  font-size: 14px;
}

.status-waiting {
  color: var(--td-brand-color);
}

.status-scanned {
  color: var(--td-warning-color);
}

.status-success {
  color: var(--td-success-color);
}

.status-expired,
.status-error {
  color: var(--td-error-color);
}

.error-icon {
  color: var(--td-error-color);
  font-size: 24px;
}

.qr-countdown {
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--td-bg-color-container-hover);
  border-radius: 4px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.qr-security-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.qr-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 响应式设计 - 1024x768优化 */
@media (max-width: 1024px) {
  .home-page {
    padding: 12px;
    gap: 12px;
  }
  .home-grid {
    gap: 8px;
  }
  
  .guide-steps {
    gap: 8px;
  }
  
  .step-item {
    padding: 8px;
  }
  
  .step-title {
    font-size: 13px;
  }
  
  .step-desc {
    font-size: 11px;
  }
  
  .profile-header {
    gap: 12px;
  }
  
  .user-avatar {
    width: 48px;
    height: 48px;
  }
  
  .user-nickname {
    font-size: 16px;
  }
  
  .mini-chart {
    height: 160px;
  }
  
  .qr-image {
    width: 160px;
    height: 160px;
  }
}

@media (max-height: 768px) {
  .mini-chart {
    height: 140px;
  }
  
  .qr-image {
    width: 140px;
    height: 140px;
  }
}
</style>