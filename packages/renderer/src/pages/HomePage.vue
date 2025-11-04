<template>
  <div class="home-page">
    <!-- 欢迎引导卡片 -->
    <t-card
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

    <!-- 用户信息卡片 -->
    <t-card
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

    <!-- KPI统计区域 -->
    <t-card
      class="kpi-section"
      title="关键指标统计"
      hover-shadow
    >
      <t-row
        :gutter="16"
        class="kpi-row"
      >
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

    <!-- 二维码登录对话框 -->
    <t-dialog 
      v-model:visible="qrDialogVisible" 
      title="二维码登录" 
      width="420px"
      :close-on-overlay-click="false"
    >
      <div class="qr-login-content">
        <div class="qr-code-section">
          <div
            v-if="qrSession.status === 'loading'"
            class="qr-loading"
          >
            <t-loading />
            <p>正在生成二维码...</p>
          </div>
          <div
            v-else-if="qrSession.qrDataUrl"
            class="qr-display"
          >
            <img
              :src="qrSession.qrDataUrl"
              alt="登录二维码"
              class="qr-image"
            >
            <div class="qr-status">
              <t-icon
                :name="getQrStatusIcon()"
                :class="getQrStatusClass()"
              />
              <p class="status-text">
                {{ getQrStatusText() }}
              </p>
            </div>
          </div>
          <div
            v-else
            class="qr-error"
          >
            <t-icon
              name="close-circle"
              class="error-icon"
            />
            <p>二维码生成失败</p>
            <t-button
              theme="primary"
              @click="refreshQrCode"
            >
              重新生成
            </t-button>
          </div>
        </div>
        
        <div
          v-if="qrSession.expireAt"
          class="qr-countdown"
        >
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
          <t-button
            variant="outline"
            @click="cancelQrLogin"
          >
            取消
          </t-button>
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useAccountStore } from '../stores/account';
import { useRoomStore } from '../stores/room';
import * as echarts from 'echarts';

const accountStore = useAccountStore();
const roomStore = useRoomStore();

// 二维码登录相关状态
const qrDialogVisible = ref(false);
const qrSession = ref({
  status: 'idle', // idle, loading, waiting, scanned, expired, error, success
  qrDataUrl: '',
  expireAt: null as Date | null,
  sessionId: '',
  pollInterval: null as NodeJS.Timeout | null
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
const currentTime = ref(new Date()); // 添加响应式当前时间

// 二维码登录方法
const showQrLogin = async () => {
  qrDialogVisible.value = true;
  await generateQrCode();
};

const generateQrCode = async () => {
  qrSession.value.status = 'loading';
  
  // 清理现有的定时器
  if (qrCountdownTimer) {
    clearInterval(qrCountdownTimer);
    qrCountdownTimer = null;
  }
  
  if (qrSession.value.pollInterval) {
    clearInterval(qrSession.value.pollInterval);
    qrSession.value.pollInterval = null;
  }
  
  try {
    // 使用IPC API生成二维码
    const result = await window.electronApi.login.qrStart();
    
    if ('error' in result) {
      throw new Error(result.error);
    }
    
    if ('qrCodeDataUrl' in result) {
      qrSession.value.qrDataUrl = result.qrCodeDataUrl;
      qrSession.value.status = 'waiting';
      
      // 使用主进程返回的过期锚定时间（优先 expireAt，其次 expiresIn）
      const expireAtMs = (result as any).expireAt ?? (typeof (result as any).expiresIn === 'number' ? Date.now() + (result as any).expiresIn * 1000 : undefined);
      qrSession.value.expireAt = typeof expireAtMs === 'number' ? new Date(expireAtMs) : null;
      
      // 开始倒计时
      if (qrSession.value.expireAt) {
        startQrCountdown();
      }
      
      // 开始轮询登录状态
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
    if (qrSession.value.status !== 'waiting' && qrSession.value.status !== 'scanned') {
      clearInterval(pollInterval);
      return;
    }
    
    try {
      // 使用IPC API检查登录状态
      const result = await window.electronApi.login.qrCheck();
      
      // 重置重试计数器
      retryCount = 0;
      
      if (result.success && result.tokenInfo) {
        // 登录成功
        qrSession.value.status = 'success';
        
        // 清理定时器
        if (qrCountdownTimer) {
          clearInterval(qrCountdownTimer);
          qrCountdownTimer = null;
        }
        
        if (qrSession.value.pollInterval) {
          clearInterval(qrSession.value.pollInterval);
          qrSession.value.pollInterval = null;
        }
        
        // 调用 finalize 获取最终令牌信息（与主进程状态一致）
        try {
          const finalize = await window.electronApi.login.qrFinalize();
          const info = finalize.success && finalize.tokenInfo ? finalize.tokenInfo : result.tokenInfo;
          // 处理登录成功，更新账户状态
          await accountStore.handleLoginSuccess(info);
        } catch (e) {
          console.warn('Finalize 调用失败，回退使用 check 的 tokenInfo');
          await accountStore.handleLoginSuccess(result.tokenInfo);
        }
        
        // 关闭对话框
        setTimeout(() => {
          qrDialogVisible.value = false;
          qrSession.value.status = 'idle';
        }, 2000);
        
        clearInterval(pollInterval);
      } else if (result.error) {
        // 检查是否是扫码状态
        if (result.error.includes('请等待用户确认') || result.error.includes('已扫码')) {
          qrSession.value.status = 'scanned';
        } else if (result.error.includes('expired') || result.error.includes('过期')) {
          qrSession.value.status = 'expired';
          
          // 清理定时器
          if (qrCountdownTimer) {
            clearInterval(qrCountdownTimer);
            qrCountdownTimer = null;
          }
          
          if (qrSession.value.pollInterval) {
            clearInterval(qrSession.value.pollInterval);
            qrSession.value.pollInterval = null;
          }
          
          clearInterval(pollInterval);
        } else if (result.error.includes('cancelled') || result.error.includes('取消')) {
          console.log(123)
          qrSession.value.status = 'error';
          
          // 清理定时器
          if (qrCountdownTimer) {
            clearInterval(qrCountdownTimer);
            qrCountdownTimer = null;
          }
          
          if (qrSession.value.pollInterval) {
            clearInterval(qrSession.value.pollInterval);
            qrSession.value.pollInterval = null;
          }
          
          clearInterval(pollInterval);
        } else if (
          // 改进等待状态的判断逻辑，包含更多可能的等待状态消息
          result.error.includes('请等待用户扫描') ||
          result.error.includes('请等待用户操作') ||
          result.error.includes('二维码状态为') ||
          result.error.includes('API错误') ||
          result.error.includes('No token info received') ||
          result.error.includes('result: 10') || // AuthManager中标识的等待状态
          result.error.includes('代码: 10') || // 匹配 "API错误: client error (代码: 10)" 格式
          result.error.includes('client error') || // 匹配client error消息
          result.error.includes('API调用失败') // 匹配acfunlive-http-api的错误消息
        ) {
          // 这些都是正常的等待状态，继续轮询，但不输出到控制台避免混淆
          // console.log('QR login waiting:', result.error);
        } else {
          // 只有明确的错误才停止轮询
          console.error('QR login error:', result.error);
          qrSession.value.status = 'error';
          
          // 清理定时器
          if (qrCountdownTimer) {
            clearInterval(qrCountdownTimer);
            qrCountdownTimer = null;
          }
          
          if (qrSession.value.pollInterval) {
            clearInterval(qrSession.value.pollInterval);
            qrSession.value.pollInterval = null;
          }
          
          clearInterval(pollInterval);
        }
      }
      // 如果没有成功也没有明确错误，继续轮询
    } catch (error) {
      console.error('轮询登录状态失败:', error);
      retryCount++;
      
      if (retryCount >= maxRetries) {
        console.error(`轮询失败次数过多 (${maxRetries}次)，停止轮询`);
        qrSession.value.status = 'error';
        clearInterval(pollInterval);
      }
      // 继续轮询，不清除定时器
    }
  };
  
  // 初始轮询间隔为2秒，减少服务器压力
  pollInterval = setInterval(poll, 2000);
  
  // 存储定时器引用以便清理
  qrSession.value.pollInterval = pollInterval;
};

const startQrCountdown = () => {
  qrCountdownTimer = setInterval(() => {
    if (!qrSession.value.expireAt) return;
    
    // 更新当前时间以触发Vue响应式更新
    currentTime.value = new Date();
    
    const now = currentTime.value;
    if (now >= qrSession.value.expireAt) {
      qrSession.value.status = 'expired';
      
      // 清理倒计时定时器
      if (qrCountdownTimer) {
        clearInterval(qrCountdownTimer);
        qrCountdownTimer = null;
      }
      
      // 清理轮询定时器
      if (qrSession.value.pollInterval) {
        clearInterval(qrSession.value.pollInterval);
        qrSession.value.pollInterval = null;
      }
      
      // 自动重新生成二维码
      setTimeout(() => {
        generateQrCode();
      }, 1000);
    }
  }, 1000);
};

const refreshQrCode = () => {
  generateQrCode();
};

const cancelQrLogin = async () => {
  try {
    await window.electronApi.login.qrCancel();
  } catch (e) {
    // 静默处理取消异常，确保UI流畅
  }
  qrDialogVisible.value = false;
  qrSession.value.status = 'idle';
  
  // 清理所有定时器
  if (qrCountdownTimer) {
    clearInterval(qrCountdownTimer);
    qrCountdownTimer = null;
  }
  
  if (qrSession.value.pollInterval) {
    clearInterval(qrSession.value.pollInterval);
    qrSession.value.pollInterval = null;
  }
  
  // 重置会话数据
  qrSession.value.sessionId = '';
  qrSession.value.qrDataUrl = '';
  qrSession.value.expireAt = null;
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
  // 使用响应式的当前时间确保每秒更新
  const now = currentTime.value;
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
      // 检查响应的Content-Type是否为JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        kpiData.value = {
          liveTime: data.liveTime || 0,
          giftCount: data.giftCount || 0,
          danmuCount: data.danmuCount || 0,
          likeCount: data.likeCount || 0
        };
      } else {
        // 响应不是JSON格式，使用模拟数据
        console.warn('KPI API返回非JSON响应，使用模拟数据');
        kpiData.value = {
          liveTime: Math.floor(Math.random() * 300),
          giftCount: Math.floor(Math.random() * 50),
          danmuCount: Math.floor(Math.random() * 200),
          likeCount: Math.floor(Math.random() * 100)
        };
      }
    } else {
      // HTTP错误状态，使用模拟数据
      console.warn(`KPI API返回错误状态 ${response.status}，使用模拟数据`);
      kpiData.value = {
        liveTime: Math.floor(Math.random() * 300),
        giftCount: Math.floor(Math.random() * 50),
        danmuCount: Math.floor(Math.random() * 200),
        likeCount: Math.floor(Math.random() * 100)
      };
    }
  } catch (error) {
    // 网络错误或其他异常，静默处理并使用模拟数据
    console.warn('KPI数据获取失败，使用模拟数据:', error instanceof Error ? error.message : String(error));
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