<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { Card, Select, DatePicker, Tabs, Spin, Message } from 'tdesign-vue-next';
import { ipcRenderer } from 'electron';
import { LineChart, BarChart, PieChart, Line, Bar, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'vue3-chart-v3';

// 状态管理
const loading = ref(true);
const activeTab = ref('overview');
const dateRange = ref<string[]>([]);
const chartType = ref('daily');
const selectedRoom = ref('all');

// 图表数据
const viewerData = reactive({
  labels: [],
  datasets: [{
    label: '观众人数',
    data: [],
    borderColor: '#1890ff',
    backgroundColor: 'rgba(24, 144, 255, 0.1)',
    tension: 0.4
  }]
});

const incomeData = reactive({
  labels: [],
  datasets: [{
    label: '收入(AC币)',
    data: [],
    backgroundColor: '#f5222d',
  }]
});

const interactionData = reactive({
  labels: ['点赞', '评论', '礼物', '分享'],
  datasets: [{
    data: [0, 0, 0, 0],
    backgroundColor: ['#faad14', '#722ed1', '#13c2c2', '#1890ff'],
  }]
});

const roomList = ref([{
  label: '全部房间',
  value: 'all'
}]);

// 获取统计数据
const fetchStatisticsData = async () => {
  try {
    loading.value = true;
    const params = {
      roomId: selectedRoom.value === 'all' ? null : selectedRoom.value,
      startDate: dateRange.value[0] || null,
      endDate: dateRange.value[1] || null,
      type: chartType.value
    };

    // 获取房间列表
    const rooms = await ipcRenderer.invoke('statistics:getRoomList');
    roomList.value = [{ label: '全部房间', value: 'all' }, ...rooms.map(room => ({
      label: room.name,
      value: room.id
    }))];

    // 获取概览数据
    const overviewData = await ipcRenderer.invoke('statistics:getOverviewData', params);
    if (overviewData.viewerTrend) {
      viewerData.labels = overviewData.viewerTrend.labels;
      viewerData.datasets[0].data = overviewData.viewerTrend.values;
    }

    // 获取收入数据
    const incomeTrend = await ipcRenderer.invoke('statistics:getIncomeData', params);
    if (incomeTrend) {
      incomeData.labels = incomeTrend.labels;
      incomeData.datasets[0].data = incomeTrend.values;
    }

    // 获取互动数据
    const interactionStats = await ipcRenderer.invoke('statistics:getInteractionData', params);
    if (interactionStats) {
      interactionData.datasets[0].data = [
        interactionStats.likeCount,
        interactionStats.commentCount,
        interactionStats.giftCount,
        interactionStats.shareCount
      ];
    }

  } catch (error) {
    Message.error(`获取统计数据失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    loading.value = false;
  }
};

// 筛选条件变化处理
const handleFilterChange = () => {
  fetchStatisticsData();
};

// 页面加载时获取数据
onMounted(() => {
  fetchStatisticsData();
});
</script>

<template>
  <div class="statistics-container">
    <h1 class="page-title">统计分析</h1>

    <!-- 筛选区域 -->
    <Card class="filter-card row-frame">
      <div class="filter-group">
        <div class="filter-item">
          <Select
            v-model="selectedRoom"
            :options="roomList"
            placeholder="选择直播间"
            @change="handleFilterChange"
          />
        </div>
        <div class="filter-item">
          <DatePicker
            v-model="dateRange"
            type="range"
            placeholder="选择日期范围"
            @change="handleFilterChange"
          />
        </div>
        <div class="filter-item">
          <Select
            v-model="chartType"
            :options="[
              { label: '日统计', value: 'daily' },
              { label: '周统计', value: 'weekly' },
              { label: '月统计', value: 'monthly' }
            ]"
            @change="handleFilterChange"
          />
        </div>
      </div>
    </Card>

    <!-- 内容区域 -->
    <Spin v-if="loading" class="page-loading" />

    <div v-else class="content-area">
      <Tabs v-model="activeTab" class="stats-tabs">
        <!-- 概览标签页 -->
        <template #panel-overview>
          <div class="chart-grid">
            <!-- 观众趋势图表 -->
            <Card class="chart-card">
              <h3 class="chart-title">观众趋势分析</h3>
              <div class="chart-container">
                <ResponsiveContainer width="100%" height="300">
                  <LineChart data="viewerData">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="labels" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend />
                    <Line v-bind="viewerData.datasets[0]" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <!-- 收入趋势图表 -->
            <Card class="chart-card">
              <h3 class="chart-title">收入趋势分析</h3>
              <div class="chart-container">
                <ResponsiveContainer width="100%" height="300">
                  <BarChart data="incomeData">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="labels" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend />
                    <Bar v-bind="incomeData.datasets[0]" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <!-- 互动数据图表 -->
            <Card class="chart-card interaction-chart">
              <h3 class="chart-title">互动数据分布</h3>
              <div class="chart-container">
                <ResponsiveContainer width="100%" height="300">
                  <PieChart>
                    <Pie
                      v-bind="interactionData.datasets[0]"
                      dataKey="data"
                      nameKey="labels"
                      labels="interactionData.labels"
                      cx="50%"
                      cy="50%"
                      innerRadius="60"
                      outerRadius="80"
                      paddingAngle="5"
                      data-test="pie-chart"
                    />
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </template>

        <!-- 详细数据标签页 -->
        <template #panel-detail>
          <Card class="detail-card row-frame">
            <div class="empty-state">
              <p>详细数据统计功能即将上线，敬请期待...</p>
            </div>
          </Card>
        </template>

        <!-- 趋势分析标签页 -->
        <template #panel-trend>
          <Card class="trend-card row-frame">
            <div class="empty-state">
              <p>趋势预测分析功能即将上线，敬请期待...</p>
            </div>
          </Card>
        </template>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
.statistics-container {
  padding: 20px;
  background-color: #0f172a; /* 页面背景色 - UI规范 */
  min-height: 100vh;
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #f8fafc; /* 主要文本色 - UI规范 */
}

.filter-card {
  margin-bottom: 20px;
  background-color: #1e293b; /* 卡片背景色 - UI规范 */
}

.filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
}

.filter-item {
  flex: 1;
  min-width: 200px;
}

.content-area {
  margin-top: 20px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(600px, 1fr));
  gap: 20px;
}

.chart-card {
  background-color: #1e293b; /* 卡片背景色 - UI规范 */
  height: 100%;
  min-height: 400px;
  overflow: hidden;
}

.chart-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: #f8fafc; /* 主要文本色 - UI规范 */
}

.chart-container {
  width: 100%;
  height: 300px;
}

.interaction-chart {
  grid-column: span 2;
  justify-self: center;
  max-width: 600px;
}

.page-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  color: #94a3b8; /* 次要文本色 - UI规范 */
}

@media screen and (max-width: 1200px) {
  .interaction-chart {
    grid-column: span 1;
  }
}

@media screen and (max-width: 768px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }

  .filter-item {
    flex: 100%;
  }
}
</style>