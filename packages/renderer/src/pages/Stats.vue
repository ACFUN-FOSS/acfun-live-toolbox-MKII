<template>
  <div class="stats-page">
    <h2>主播统计</h2>

    <!-- 顶部总览（mock） -->
    <t-card class="overview-card" title="数据总览" hover-shadow>
      <div class="overview-grid">
        <div class="overview-item">
          <div class="overview-icon">
            <t-icon name="video" />
          </div>
          <div class="overview-content">
            <div class="label">直播次数</div>
            <div class="value">{{ totals.sessionCount }}</div>
          </div>
        </div>
        <div class="overview-item">
          <div class="overview-icon">
            <t-icon name="time" />
          </div>
          <div class="overview-content">
            <div class="label">总时长</div>
            <div class="value">{{ formatDuration(totals.totalDuration) }}</div>
          </div>
        </div>
        <div class="overview-item">
          <div class="overview-icon">
            <t-icon name="thumb-up" />
          </div>
          <div class="overview-content">
            <div class="label">点赞数</div>
            <div class="value">{{ formatNumber(totals.likes) }}</div>
          </div>
        </div>
        <div class="overview-item">
          <div class="overview-icon">
            <t-icon name="heart" />
          </div>
          <div class="overview-content">
            <div class="label">香蕉数</div>
            <div class="value">{{ formatNumber(totals.bananas) }}</div>
          </div>
        </div>
        <div class="overview-item">
          <div class="overview-icon">
            <t-icon name="gift" />
          </div>
          <div class="overview-content">
            <div class="label">礼物数</div>
            <div class="value">{{ formatNumber(totals.gifts) }}</div>
          </div>
        </div>
      </div>
    </t-card>

    <!-- 底部混合图（柱：时长；线：点赞/香蕉/礼物） -->
    <t-card class="chart-card" title="数据趋势分析" hover-shadow>
      <div class="chart-header">
        <div class="chart-title">
          <span>直播数据趋势</span>
          <t-tooltip>
            <template #content>
              柱状图展示每日直播时长，折线图展示点赞、香蕉、礼物数据
            </template>
            <t-icon name="help-circle" />
          </t-tooltip>
        </div>
        <div class="chart-controls">
          <t-radio-group v-model="granularity" size="small" @change="handleGranularityChange">
            <t-radio-button value="day">日</t-radio-button>
            <t-radio-button value="week">周</t-radio-button>
            <t-radio-button value="month">月</t-radio-button>
          </t-radio-group>
        </div>
      </div>
      <div ref="chartRef" class="chart"></div>
    </t-card>
  </div>
  
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';

type DayStat = {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  durationMin: number; // 直播时长（分钟）
  likes: number;
  bananas: number;
  gifts: number;
};

// 格式化时长显示
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

// 格式化数字显示
function formatNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 10000) return (num / 1000).toFixed(1) + 'k';
  return (num / 10000).toFixed(1) + 'w';
}

// 处理粒度切换
function handleGranularityChange(value: 'day' | 'week' | 'month') {
  granularity.value = value;
  // 重置数据缩放范围
  if (chart) {
    const option = chart.getOption();
    if (option && option.dataZoom) {
      option.dataZoom[0] = { ...option.dataZoom[0], start: 0, end: 100 };
      option.dataZoom[1] = { ...option.dataZoom[1], start: 0, end: 100 };
      chart.setOption(option);
    }
  }
  renderChart();
}

// 生成近30天mock数据
function generateMockDays(): DayStat[] {
  const days: DayStat[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const streamed = Math.random() > 0.2; // 约80%天有直播
    const durationMin = streamed ? Math.floor(60 + Math.random() * 180) : 0; // 60~240分钟
    const likes = streamed ? Math.floor(50 + Math.random() * 300) : 0;
    const bananas = streamed ? Math.floor(20 + Math.random() * 150) : 0;
    const gifts = streamed ? Math.floor(10 + Math.random() * 120) : 0;
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: d, dateStr, durationMin, likes, bananas, gifts });
  }
  return days;
}

const mockDays = ref<DayStat[]>(generateMockDays());

// 顶部总览
const totals = computed(() => {
  const sessionCount = mockDays.value.filter(d => d.durationMin > 0).length;
  const totalDuration = mockDays.value.reduce((sum, d) => sum + d.durationMin, 0);
  const likes = mockDays.value.reduce((sum, d) => sum + d.likes, 0);
  const bananas = mockDays.value.reduce((sum, d) => sum + d.bananas, 0);
  const gifts = mockDays.value.reduce((sum, d) => sum + d.gifts, 0);
  return { sessionCount, totalDuration, likes, bananas, gifts };
});

// 粒度切换（日/周/月）
const granularity = ref<'day' | 'week' | 'month'>('day');

type AggregatedPoint = {
  label: string;
  durationMin: number;
  likes: number;
  bananas: number;
  gifts: number;
};

function aggregateData(g: 'day' | 'week' | 'month'): AggregatedPoint[] {
  const src = [...mockDays.value];
  if (g === 'day') {
    return src.map(d => ({
      label: d.dateStr.slice(5), // MM-DD
      durationMin: d.durationMin,
      likes: d.likes,
      bananas: d.bananas,
      gifts: d.gifts,
    }));
  }
  if (g === 'week') {
    // 按时间顺序每7天一组
    const res: AggregatedPoint[] = [];
    for (let i = 0; i < src.length; i += 7) {
      const chunk = src.slice(i, i + 7);
      const startDate = chunk[0].dateStr.slice(5); // MM-DD
      const endDate = chunk[chunk.length - 1].dateStr.slice(5); // MM-DD
      const label = startDate === endDate ? startDate : `${startDate}~${endDate}`;
      const agg = chunk.reduce((acc, d) => {
        acc.durationMin += d.durationMin;
        acc.likes += d.likes;
        acc.bananas += d.bananas;
        acc.gifts += d.gifts;
        return acc;
      }, { durationMin: 0, likes: 0, bananas: 0, gifts: 0 });
      res.push({ label, ...agg });
    }
    return res;
  }
  // month
  const byMonth = new Map<string, AggregatedPoint>();
  for (const d of src) {
    const key = d.dateStr.slice(0, 7); // YYYY-MM
    const prev = byMonth.get(key) ?? { label: key, durationMin: 0, likes: 0, bananas: 0, gifts: 0 };
    prev.durationMin += d.durationMin;
    prev.likes += d.likes;
    prev.bananas += d.bananas;
    prev.gifts += d.gifts;
    byMonth.set(key, prev);
  }
  // 格式化月份显示为 MM-DD 格式
  return Array.from(byMonth.values()).map(item => ({
    ...item,
    label: item.label.slice(5) // 转换为 MM-DD 格式
  }));
}

// 初始化图表
const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function getBrandColors() {
  const css = getComputedStyle(document.documentElement);
  return {
    brand: css.getPropertyValue('--td-brand-color').trim() || '#0052d9',
    success: css.getPropertyValue('--td-success-color').trim() || '#00a870',
    warning: css.getPropertyValue('--td-warning-color').trim() || '#ed7b2f',
    danger: css.getPropertyValue('--td-error-color').trim() || '#e34d59',
    text: css.getPropertyValue('--td-text-color-primary').trim() || '#1f2329',
  };
}

function renderChart() {
  if (!chartRef.value) return;
  if (!chart) {
    chart = echarts.init(chartRef.value);
  }
  const data = aggregateData(granularity.value);
  const colors = getBrandColors();
  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    color: [colors.brand, colors.success, colors.warning, colors.danger],
    tooltip: { 
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: colors.brand
        }
      },
      formatter: function(params: any) {
        let result = `<div style="font-weight: bold; margin-bottom: 8px;">${params[0].axisValue}</div>`;
        params.forEach((param: any) => {
          const unit = param.seriesName === '直播时长' ? '分钟' : '次';
          result += `<div style="display: flex; align-items: center;">
            <span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; border-radius: 50%; margin-right: 8px;"></span>
            <span>${param.seriesName}: ${param.value}${unit}</span>
          </div>`;
        });
        return result;
      }
    },
    legend: { 
      data: ['直播时长', '点赞', '香蕉', '礼物'],
      top: 0,
      textStyle: {
        color: colors.text
      }
    },
    grid: { 
      left: 48, 
      right: 48, 
      bottom: 64, 
      top: 48,
      containLabel: true
    },
    xAxis: { 
      type: 'category', 
      data: data.map(d => d.label), 
      axisLabel: { 
        rotate: 30,
        color: colors.text
      },
      axisLine: {
        lineStyle: {
          color: colors.text
        }
      }
    },
    yAxis: [
      { 
        type: 'value', 
        name: '时长（分钟）', 
        position: 'left',
        nameTextStyle: {
          color: colors.text
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: colors.brand
          }
        },
        axisLabel: {
          color: colors.text
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        }
      },
      { 
        type: 'value', 
        name: '互动数', 
        position: 'right',
        nameTextStyle: {
          color: colors.text
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: colors.text
          }
        },
        axisLabel: {
          color: colors.text
        },
        splitLine: {
          show: false
        }
      },
    ],
    dataZoom: [
      { 
        type: 'inside',
        start: 0,
        end: 100
      },
      { 
        type: 'slider', 
        height: 18,
        bottom: 10,
        start: 0,
        end: 100
      },
    ],
    series: [
      { 
        name: '直播时长', 
        type: 'bar', 
        yAxisIndex: 0, 
        data: data.map(d => d.durationMin), 
        barMaxWidth: 32,
        itemStyle: {
          borderRadius: [4, 4, 0, 0]
        }
      },
      { 
        name: '点赞', 
        type: 'line', 
        yAxisIndex: 1, 
        data: data.map(d => d.likes), 
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3
        }
      },
      { 
        name: '香蕉', 
        type: 'line', 
        yAxisIndex: 1, 
        data: data.map(d => d.bananas), 
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3
        }
      },
      { 
        name: '礼物', 
        type: 'line', 
        yAxisIndex: 1, 
        data: data.map(d => d.gifts), 
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3
        }
      },
    ],
  };
  chart.setOption(option);
  chart.resize();
}

onMounted(() => {
  renderChart();
  window.addEventListener('resize', renderChart);
});

onUnmounted(() => {
  window.removeEventListener('resize', renderChart);
  if (chart) { chart.dispose(); chart = null; }
});

watch(granularity, () => { renderChart(); });
</script>

<style scoped>
.stats-page { 
  margin-top: 8px; 
  display: flex; 
  flex-direction: column; 
  gap: 16px; 
  height: calc(100vh - 100px);
  overflow: hidden;
}

.overview-card { margin-bottom: 16px; }
.overview-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.overview-item { 
  display: flex;
  align-items: center;
  padding: 8px;
  background: var(--td-bg-color-container-hover);
  border-radius: var(--td-radius-medium);
  transition: all 0.2s ease;
}
.overview-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.overview-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-right: 8px;
  background: var(--td-brand-color);
  color: white;
  border-radius: var(--td-radius-medium);
  font-size: 18px;
}
.overview-content {
  flex: 1;
}
.overview-item .label { 
  font-size: 11px; 
  color: var(--td-text-color-secondary); 
  margin-bottom: 2px;
}
.overview-item .value { 
  font-size: 16px; 
  font-weight: 600; 
  color: var(--td-text-color-primary); 
}

.chart-card { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.chart-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}
.chart-title .t-icon {
  margin-left: 8px;
  color: var(--td-text-color-placeholder);
  cursor: help;
}
.chart-controls { }
.chart { 
  width: 100%; 
  height: 350px; 
  flex: 1;
  background: var(--td-bg-color-container); 
  border: 1px solid var(--td-border-level-1-color); 
  border-radius: var(--td-radius-medium); 
}
</style>