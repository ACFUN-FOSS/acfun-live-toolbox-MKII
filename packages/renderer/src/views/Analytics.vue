<template>
  <div class="analytics-container">
    <t-card class="page-header">
      <h2 class="page-title">数据分析中心</h2>
      <div class="date-range-picker">
        <t-date-range-picker
          v-model="dateRange"
          :presets="datePresets"
          @change="handleDateRangeChange"
        />
        <t-button @click="refreshData" class="refresh-btn">
          <RefreshIcon size="16" />
          刷新数据
        </t-button>
      </div>
    </t-card>

    <!-- 实时统计卡片 -->
    <div class="realtime-stats">
      <t-card class="stat-card">
        <div class="stat-icon online-users-icon">
          <UserIcon size="24" />
        </div>
        <div class="stat-content">
          <p class="stat-label">当前在线观众</p>
          <p class="stat-value">{{ realtimeStats.onlineUsers || 0 }}</p>
          <p class="stat-change" :class="realtimeStats.userChange >= 0 ? 'positive' : 'negative'">
            {{ realtimeStats.userChange >= 0 ? '+' : '' }}{{ realtimeStats.userChange }} 较昨日
          </p>
        </div>
      </t-card>

      <t-card class="stat-card">
        <div class="stat-icon views-icon">
          <EyeIcon size="24" />
        </div>
        <div class="stat-content">
          <p class="stat-label">累计观看人数</p>
          <p class="stat-value">{{ formatNumber(realtimeStats.totalViews || 0) }}</p>
          <p class="stat-change" :class="realtimeStats.viewChange >= 0 ? 'positive' : 'negative'">
            {{ realtimeStats.viewChange >= 0 ? '+' : '' }}{{ realtimeStats.viewChange }}% 较昨日
          </p>
        </div>
      </t-card>

      <t-card class="stat-card">
        <div class="stat-icon danmu-icon">
          <MessageIcon size="24" />
        </div>
        <div class="stat-content">
          <p class="stat-label">弹幕总数</p>
          <p class="stat-value">{{ formatNumber(realtimeStats.danmuCount || 0) }}</p>
          <p class="stat-rate">{{ realtimeStats.danmuRate || 0 }} 条/分钟</p>
        </div>
      </t-card>

      <t-card class="stat-card">
        <div class="stat-icon gift-icon">
          <GiftIcon size="24" />
        </div>
        <div class="stat-content">
          <p class="stat-label">礼物收入</p>
          <p class="stat-value">{{ realtimeStats.giftRevenue || 0 }} 元</p>
          <p class="stat-change" :class="realtimeStats.giftChange >= 0 ? 'positive' : 'negative'">
            {{ realtimeStats.giftChange >= 0 ? '+' : '' }}{{ realtimeStats.giftChange }}% 较昨日
          </p>
        </div>
      </t-card>
    </div>

    <!-- 分析标签页 -->
    <t-tabs v-model="activeTab" class="analytics-tabs">
      <t-tab-panel value="audience" label="观众分析">
        <div class="tab-content">
          <t-card class="chart-card">
            <h3 class="chart-title">观众地域分布</h3>
            <div class="chart-container">
              <t-chart :option="audienceGeoOption" />
            </div>
          </t-card>

          <div class="chart-row">
            <t-card class="chart-card half-width">
              <h3 class="chart-title">观众性别比例</h3>
              <div class="chart-container">
                <t-chart :option="audienceGenderOption" />
              </div>
            </t-card>

            <t-card class="chart-card half-width">
              <h3 class="chart-title">观众年龄分布</h3>
              <div class="chart-container">
                <t-chart :option="audienceAgeOption" />
              </div>
            </t-card>
          </div>
        </div>
      </t-tab-panel>

      <t-tab-panel value="gift" label="礼物分析">
        <div class="tab-content">
          <t-card class="chart-card">
            <div class="chart-header">
              <h3 class="chart-title">礼物收入趋势</h3>
              <t-select v-model="giftTimeRange" @change="fetchGiftStats">
                <t-option value="day" label="今日"></t-option>
                <t-option value="week" label="本周"></t-option>
                <t-option value="month" label="本月"></t-option>
              </t-select>
            </div>
            <div class="chart-container">
              <t-chart :option="giftTrendOption" />
            </div>
          </t-card>

          <t-card class="chart-card">
            <h3 class="chart-title">礼物排行榜</h3>
            <t-table
              :data="giftRankData"
              :columns="giftRankColumns"
              :pagination="false"
            ></t-table>
          </t-card>
        </div>
      </t-tab-panel>

      <t-tab-panel value="reports" label="数据报表">
        <div class="tab-content">
          <t-card class="report-card">
            <div class="report-controls">
              <t-select v-model="reportType">
                <t-option value="daily" label="日报"></t-option>
                <t-option value="weekly" label="周报"></t-option>
                <t-option value="monthly" label="月报"></t-option>
              </t-select>
              <t-button type="primary" @click="generateReport">
                <DownloadIcon size="16" class="mr-2" />
                生成报表
              </t-button>
            </div>

            <div class="report-preview" v-if="reportData">
              <h3 class="report-title">{{ reportType === 'daily' ? '每日数据报表' : reportType === 'weekly' ? '每周数据报表' : '每月数据报表' }}</h3>
              <p class="report-date">日期范围: {{ reportData.dateRange }}</p>
              <div class="report-summary">
                <div class="report-item">
                  <span class="report-label">总观看人数:</span>
                  <span class="report-value">{{ formatNumber(reportData.totalViews) }}</span>
                </div>
                <div class="report-item">
                  <span class="report-label">平均在线人数:</span>
                  <span class="report-value">{{ Math.round(reportData.avgOnline) }}</span>
                </div>
                <div class="report-item">
                  <span class="report-label">弹幕总数:</span>
                  <span class="report-value">{{ formatNumber(reportData.totalDanmu) }}</span>
                </div>
                <div class="report-item">
                  <span class="report-label">礼物总收入:</span>
                  <span class="report-value">{{ reportData.totalRevenue }} 元</span>
                </div>
              </div>
              <div class="report-actions">
                <t-button variant="outline" @click="downloadReport">
                  <DownloadIcon size="16" class="mr-2" />
                  下载报表
                </t-button>
                <t-button variant="outline" @click="exportReport">
                  <FileTextIcon size="16" class="mr-2" />
                  导出数据
                </t-button>
              </div>
            </div>
          </t-card>
        </div>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { Tabs, TabPanel, Card, DateRangePicker, Button, Select, Option, Table, Chart } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';
import { RefreshIcon, UserIcon, EyeIcon, MessageIcon, GiftIcon, DownloadIcon, FileTextIcon } from '@tdesign/icons-vue-next';

// 状态管理
const activeTab = ref('audience');
const dateRange = ref<string[]>([]);
const giftTimeRange = ref('day');
const reportType = ref('daily');
const loading = ref(false);

// 数据存储
const realtimeStats = ref({});
const audienceGeoOption = ref({});
const audienceGenderOption = ref({});
const audienceAgeOption = ref({});
const giftTrendOption = ref({});
giftRankData = ref([]);
const reportData = ref(null);

// 预设日期范围
const datePresets = [
  { label: '今日', value: ['today', 'today'] },
  { label: '昨日', value: ['yesterday', 'yesterday'] },
  { label: '近7天', value: ['7daysago', 'today'] },
  { label: '近30天', value: ['30daysago', 'today'] },
];

// 礼物排行榜列定义
const giftRankColumns = [
  { title: '排名', type: 'index', width: 80 },
  { title: '礼物名称', key: 'name' },
  { title: '赠送次数', key: 'count' },
  { title: '总价值(元)', key: 'value' },
  { title: '占比', key: 'percentage', render: (h, { row }) => `${row.percentage}%` },
];

// 生命周期钩子
onMounted(() => {
  fetchRealtimeStats();
  fetchAudienceAnalysis();
  fetchGiftStats();

  // 设置定时刷新实时数据
  const statsInterval = setInterval(fetchRealtimeStats, 30000);

  // 清理函数
  onUnmounted(() => {
    clearInterval(statsInterval);
  });
});

// 日期范围变化处理
const handleDateRangeChange = () => {
  fetchAudienceAnalysis();
  fetchGiftStats();
};

// 刷新数据
const refreshData = () => {
  loading.value = true;
  Promise.all([fetchRealtimeStats(), fetchAudienceAnalysis(), fetchGiftStats()])
    .finally(() => {
      loading.value = false;
    });
};

// 获取实时统计数据
const fetchRealtimeStats = async () => {
  try {
    const result = await ipcRenderer.invoke('getRealTimeStats');
    if (result.success) {
      realtimeStats.value = result.data;
    }
  } catch (error) {
    console.error('获取实时统计数据失败:', error);
  }
};

// 获取观众分析数据
const fetchAudienceAnalysis = async () => {
  try {
    const result = await ipcRenderer.invoke('getAudienceAnalysis', {
      dateRange: dateRange.value,
    });
    if (result.success) {
      const data = result.data;
      // 处理地域分布图表数据
      audienceGeoOption.value = {
        tooltip: { trigger: 'item' },
        series: [{
          type: 'pie',
          data: data.geoData,
          label: { show: true, formatter: '{b}: {c} ({d}%)' },
        }]
      };

      // 处理性别比例图表数据
      audienceGenderOption.value = {
        tooltip: { trigger: 'item' },
        series: [{
          type: 'pie',
          radius: '70%',
          data: data.genderData,
        }]
      };

      // 处理年龄分布图表数据
      audienceAgeOption.value = {
        xAxis: { type: 'category', data: data.ageGroups },
        yAxis: { type: 'value' },
        series: [{
          data: data.ageData,
          type: 'bar',
        }]
      };
    }
  } catch (error) {
    console.error('获取观众分析数据失败:', error);
  }
};

// 获取礼物统计数据
const fetchGiftStats = async () => {
  try {
    const result = await ipcRenderer.invoke('getGiftStats', giftTimeRange.value);
    if (result.success) {
      const data = result.data;
      // 处理礼物趋势图表数据
      giftTrendOption.value = {
        xAxis: { type: 'category', data: data.timeLabels },
        yAxis: { type: 'value' },
        series: [{
          data: data.trendData,
          type: 'line',
          smooth: true,
        }]
      };

      // 设置礼物排行榜数据
      giftRankData.value = data.rankData;
    }
  } catch (error) {
    console.error('获取礼物统计数据失败:', error);
  }
};

// 生成报表
const generateReport = async () => {
  try {
    loading.value = true;
    const result = await ipcRenderer.invoke('generateReport', reportType.value);
    if (result.success) {
      reportData.value = result.data;
    }
  } catch (error) {
    console.error('生成报表失败:', error);
  } finally {
    loading.value = false;
  }
};

// 下载报表
const downloadReport = () => {
  // 实现下载逻辑
  alert('报表下载功能待实现');
};

// 导出数据
const exportReport = () => {
  // 实现导出逻辑
  alert('数据导出功能待实现');
};

// 格式化数字
const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toString();
};

// 格式化时长
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};
</script>

<style scoped>
.analytics-container {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  margin: 0;
  font-size: 20px;
}

.date-range-picker {
  display: flex;
  align-items: center;
  gap: 16px;
}

.refresh-btn {
  display: flex;
  align-items: center;
}

.realtime-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  height: 100%;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.online-users-icon {
  background-color: rgba(45, 140, 240, 0.1);
  color: #2d8cf0;
}

.views-icon {
  background-color: rgba(0, 194, 146, 0.1);
  color: #00c292;
}

.danmu-icon {
  background-color: rgba(250, 150, 50, 0.1);
  color: #fa9632;
}

.gift-icon {
  background-color: rgba(245, 34, 45, 0.1);
  color: #f5222d;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin: 0;
}

.stat-change,
.stat-rate {
  font-size: 12px;
  margin-top: 4px;
}

.positive {
  color: #00c292;
}

.negative {
  color: #f5222d;
}

.analytics-tabs {
  margin-top: 24px;
}

.tab-content {
  padding-top: 16px;
}

.chart-card {
  margin-bottom: 24px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-title {
  margin: 0 0 16px 0;
  font-size: 16px;
}

.chart-container {
  width: 100%;
  height: 300px;
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.half-width {
  width: 100%;
}

.report-card {
  padding: 20px;
}

.report-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.report-preview {
  border-top: 1px solid #eee;
  padding-top: 24px;
}

.report-title {
  margin-top: 0;
  font-size: 18px;
}

.report-date {
  color: #666;
  margin-bottom: 24px;
}

.report-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.report-item {
  display: flex;
  flex-direction: column;
}

.report-label {
  color: #666;
  font-size: 14px;
}

.report-value {
  font-size: 20px;
  font-weight: bold;
}

.report-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
}
</style>