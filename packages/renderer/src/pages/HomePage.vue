<template>
  <div class="home-page">
    <!-- 欢迎引导卡片 -->
    <t-card class="welcome-card" title="欢迎使用 ACLiveFrame" hoverShadow>
      <div class="welcome-content">
        <p class="welcome-text">快速开始使用本工具的三个步骤：</p>
        <div class="guide-steps">
          <div class="step-item">
            <div class="step-number">1</div>
            <div class="step-content">
              <div class="step-title">登录或连接房间</div>
              <div class="step-desc">使用二维码登录账号，或直接连接直播房间（只读模式）</div>
            </div>
          </div>
          <div class="step-item">
            <div class="step-number">2</div>
            <div class="step-content">
              <div class="step-title">安装/启用所需插件</div>
              <div class="step-desc">在插件管理中安装弹幕弹窗、礼物提醒等功能插件</div>
            </div>
          </div>
          <div class="step-item">
            <div class="step-number">3</div>
            <div class="step-content">
              <div class="step-title">观察指标与日志</div>
              <div class="step-desc">在系统/控制台中查看实时数据和运行状态</div>
            </div>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 用户信息卡片 -->
    <t-card class="user-info-card" title="用户信息" hoverShadow>
      <div v-if="!accountStore.isLoggedIn" class="login-section">
        <div class="login-prompt">
          <t-icon name="user" size="48px" class="login-icon" />
          <p class="login-text">您尚未登录，点击下方按钮使用二维码登录</p>
          <t-button theme="primary" size="large" @click="showQrLogin">
            <t-icon name="qrcode" />
            登录
          </t-button>
        </div>
      </div>
      <div v-else class="user-profile">
        <div class="profile-header">
          <div class="avatar-section">
            <img :src="accountStore.userInfo?.avatar || '/default-avatar.png'" 
                 :alt="accountStore.userInfo?.nickname" 
                 class="user-avatar" />
          </div>
          <div class="profile-info">
            <h3 class="user-nickname">{{ accountStore.displayName }}</h3>
            <p class="user-uid">UID: {{ accountStore.userInfo?.userID || 'N/A' }}</p>
            <p class="login-method">登录方式: 二维码</p>
            <p class="recent-room" v-if="roomStore.liveRooms.length > 0">
              活跃房间: {{ roomStore.liveRooms[0].name }}
            </p>
          </div>
        </div>
        <div class="profile-actions">
          <t-button variant="outline" size="small" @click="switchAccount">切换账号</t-button>
          <t-button variant="outline" size="small" @click="logout">登出</t-button>
        </div>
      </div>
    </t-card>

    <!-- KPI统计区域 -->
    <t-card class="kpi-section" title="关键指标统计" hoverShadow>
      <t-row :gutter="16" class="kpi-row">
        <t-col :span="6">
          <t-statistic 
            title="直播时长" 
            :value="kpiData.liveTime" 
            suffix="分钟"
            :loading="kpiLoading"
          />
        </t-col>
        <t-col :span="6">
          <t-statistic 
            title="礼物数" 
            :value="kpiData.giftCount" 
            :loading="kpiLoading"
          />
        </t-col>
        <t-col :span="6">
          <t-statistic 
            title="弹幕数" 
            :value="kpiData.danmuCount" 
            :loading="kpiLoading"
          />
        </t-col>
        <t-col :span="6">
          <t-statistic 
            title="点赞数" 
            :value="kpiData.likeCount" 
            :loading="kpiLoading"
          />
        </t-col>
      </t-row>
      
      <!-- 迷你趋势图 -->
      <div class="chart-section" v-if="!kpiLoading">
        <h4 class="chart-title">实时趋势（最近10分钟）</h4>
        <div ref="chartContainer" class="mini-chart"></div>
      </div>
    </t-card>

    <!-- 二维码登录对话框 -->
    <t-dialog 
      v-model:visible="qrDialogVisible" 
      title="二维码登录" 
      width="420px"
      :close-on-overlay-click="false"
    >
      <div class="qr-login-content">
        <div class="qr-code-section">
          <div v-if="qrSession.status === 'loading'" class="qr-loading">
            <t-loading />
            <p>正在生成二维码...</p>
          </div>
          <div v-else-if="qrSession.qrDataUrl" class="qr-display">
            <img :src="qrSession.qrDataUrl" alt="登录二维码" class="qr-image" />
            <div class="qr-status">
              <t-icon :name="getQrStatusIcon()" :class="getQrStatusClass()" />
              <p class="status-text">{{ getQrStatusText() }}</p>
            </div>
          </div>
          <div v-else class="qr-error">
            <t-icon name="close-circle" class="error-icon" />
            <p>二维码生成失败</p>
            <t-button theme="primary" @click="refreshQrCode">重新生成</t-button>
          </div>
        </div>
        
        <div class="qr-countdown" v-if="qrSession.expireAt">
          <p>有效期剩余: {{ formatCountdown(qrSession.expireAt) }}</p>
        </div>
        
        <div class="qr-security-tip">
          <t-icon name="info-circle" />
          <span>请确保在安全环境下扫码登录</span>
        </div>
      </div>
      
      <template #footer>
        <div class="qr-dialog-footer">
          <t-button 
            v-if="qrSession.status === 'expired' || qrSession.status === 'error'" 
            theme="primary" 
            @click="refreshQrCode"
          >
            刷新二维码
          </t-button>
          <t-button variant="outline" @click="cancelQrLogin">取消</t-button>
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAccountStore } from '../stores/account';
import { useRoomStore } from '../stores/room';
import { usePluginStore } from '../stores/plugin';
import * as echarts from 'echarts';

const router = useRouter();
const accountStore = useAccountStore();
const roomStore = useRoomStore();
const pluginStore = usePluginStore();

// 二维码登录相关状态
const qrDialogVisible = ref(false);
const qrSession = ref({
  status: 'idle', // idle, loading, waiting, scanned, expired, error, success
  qrDataUrl: '',
  expireAt: null as Date | null,
  sessionId: ''
});

// KPI数据状态
const kpiData = ref({
  liveTime: 0,
  giftCount: 0,
  danmuCount: 0,
  likeCount: 0
});
const kpiLoading = ref(true);

// 图表相关
const chartContainer = ref<HTMLElement>();
let chartInstance: echarts.ECharts | null = null;

// 倒计时相关
let qrCountdownTimer: NodeJS.Timeout | null = null;
let kpiUpdateTimer: NodeJS.Timeout | null = null;

// 二维码登录方法
const showQrLogin = async () => {
  qrDialogVisible.value = true;
  await generateQrCode();
};

const generateQrCode = async () => {
  qrSession.value.status = 'loading';
  
  try {
    // 调用后端API生成二维码
    const response = await fetch('/api/auth/qr/generate', {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('生成二维码失败');
    }
    
    const data = await response.json();
    qrSession.value = {
      status: 'waiting',
      qrDataUrl: data.qrDataUrl,
      expireAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟后过期
      sessionId: data.sessionId
    };
    
    // 开始轮询登录状态
    startQrPolling();
    startQrCountdown();
    
  } catch (error) {
    console.error('生成二维码失败:', error);
    qrSession.value.status = 'error';
  }
};

const startQrPolling = () => {
  const pollInterval = setInterval(async () => {
    if (qrSession.value.status !== 'waiting' && qrSession.value.status !== 'scanned') {
      clearInterval(pollInterval);
      return;
    }
    
    try {
      const response = await fetch(`/api/auth/qr/status/${qrSession.value.sessionId}`);
      const data = await response.json();
      
      switch (data.status) {
        case 'scanned':
          qrSession.value.status = 'scanned';
          break;
        case 'confirmed':
          qrSession.value.status = 'success';
          await accountStore.loginWithQr(data.token);
          qrDialogVisible.value = false;
          clearInterval(pollInterval);
          break;
        case 'expired':
          qrSession.value.status = 'expired';
          clearInterval(pollInterval);
          break;
      }
    } catch (error) {
      console.error('轮询登录状态失败:', error);
    }
  }, 2000);
};

const startQrCountdown = () => {
  qrCountdownTimer = setInterval(() => {
    if (!qrSession.value.expireAt) return;
    
    const now = new Date();
    if (now >= qrSession.value.expireAt) {
      qrSession.value.status = 'expired';
      if (qrCountdownTimer) {
        clearInterval(qrCountdownTimer);
        qrCountdownTimer = null;
      }
    }
  }, 1000);
};

const refreshQrCode = () => {
  generateQrCode();
};

const cancelQrLogin = () => {
  qrDialogVisible.value = false;
  qrSession.value.status = 'idle';
  if (qrCountdownTimer) {
    clearInterval(qrCountdownTimer);
    qrCountdownTimer = null;
  }
};

const switchAccount = () => {
  showQrLogin();
};

const logout = async () => {
  await accountStore.logout();
};

// 二维码状态相关方法
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
  const now = new Date();
  const diff = Math.max(0, expireAt.getTime() - now.getTime());
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// KPI数据更新
const updateKpiData = async () => {
  try {
    kpiLoading.value = true;
    
    // 模拟API调用获取KPI数据
    const response = await fetch('/api/stats/kpi');
    if (response.ok) {
      const data = await response.json();
      kpiData.value = {
        liveTime: data.liveTime || 0,
        giftCount: data.giftCount || 0,
        danmuCount: data.danmuCount || 0,
        likeCount: data.likeCount || 0
      };
    } else {
      // 使用模拟数据
      kpiData.value = {
        liveTime: Math.floor(Math.random() * 300),
        giftCount: Math.floor(Math.random() * 50),
        danmuCount: Math.floor(Math.random() * 200),
        likeCount: Math.floor(Math.random() * 100)
      };
    }
  } catch (error) {
    console.error('获取KPI数据失败:', error);
    // 使用模拟数据
    kpiData.value = {
      liveTime: Math.floor(Math.random() * 300),
      giftCount: Math.floor(Math.random() * 50),
      danmuCount: Math.floor(Math.random() * 200),
      likeCount: Math.floor(Math.random() * 100)
    };
  } finally {
    kpiLoading.value = false;
  }
};

// 初始化图表
const initChart = () => {
  if (!chartContainer.value) return;
  
  chartInstance = echarts.init(chartContainer.value);
  
  const option = {
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: Array.from({ length: 10 }, (_, i) => `${i + 1}分钟前`)
    },
    yAxis: {
      type: 'value',
      splitLine: {
        show: false
      }
    },
    series: [
      {
        name: '弹幕数',
        type: 'line',
        smooth: true,
        data: Array.from({ length: 10 }, () => Math.floor(Math.random() * 50)),
        lineStyle: {
          color: '#0052d9'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 82, 217, 0.3)' },
              { offset: 1, color: 'rgba(0, 82, 217, 0.1)' }
            ]
          }
        }
      }
    ],
    tooltip: {
      trigger: 'axis'
    }
  };
  
  chartInstance.setOption(option);
};

// 生命周期
onMounted(async () => {
  await updateKpiData();
  
  // 启动KPI数据定时更新
  kpiUpdateTimer = setInterval(updateKpiData, 30000); // 30秒更新一次
  
  // 初始化图表
  nextTick(() => {
    initChart();
  });
});

onUnmounted(() => {
  if (qrCountdownTimer) {
    clearInterval(qrCountdownTimer);
  }
  if (kpiUpdateTimer) {
    clearInterval(kpiUpdateTimer);
  }
  if (chartInstance) {
    chartInstance.dispose();
  }
});
</script>

<style scoped>
.home-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow-y: auto;
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

.profile-actions {
  display: flex;
  gap: 8px;
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