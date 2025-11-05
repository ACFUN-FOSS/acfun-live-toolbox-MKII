<template>
  <div class="grid-cell">
    <t-card hover-shadow :title="roleTitle">
      <div v-if="home.loading.C">
        <t-skeleton :row-col="[[{ width: '100%' }],[{ width: '100%' }]]" />
      </div>
      <div v-else-if="home.error.C">
        <t-alert theme="error" :message="home.error.C" closeBtn @close="home.retryCard('C')"></t-alert>
        <div class="empty-state">
          暂无内容
          <t-button size="small" variant="outline" @click="home.retryCard('C')">重试</t-button>
        </div>
      </div>
      <div v-else class="role-body">
        <div v-if="role.current === 'anchor'" class="stats-block">
          <div class="overview-grid">
            <div class="overview-item">
              <div class="overview-icon">
                <t-icon name="video" />
              </div>
              <div class="overview-content">
                <div class="label">直播次数</div>
                <div class="value">{{ home.anchorStats?.sessionCount ?? 0 }}</div>
              </div>
            </div>
            <div class="overview-item">
              <div class="overview-icon">
                <t-icon name="time" />
              </div>
              <div class="overview-content">
                <div class="label">总时长</div>
                <div class="value">{{ formatDuration(home.anchorStats?.totalDuration ?? 0) }}</div>
              </div>
            </div>
            <div class="overview-item">
              <div class="overview-icon">
                <t-icon name="thumb-up" />
              </div>
              <div class="overview-content">
                <div class="label">点赞数</div>
                <div class="value">{{ formatNumber(home.anchorStats?.likes ?? 0) }}</div>
              </div>
            </div>
            <div class="overview-item">
              <div class="overview-icon">
                <t-icon name="heart" />
              </div>
              <div class="overview-content">
                <div class="label">香蕉数</div>
                <div class="value">{{ formatNumber(home.anchorStats?.bananas ?? 0) }}</div>
              </div>
            </div>
            <div class="overview-item">
              <div class="overview-icon">
                <t-icon name="gift" />
              </div>
              <div class="overview-content">
                <div class="label">礼物数</div>
                <div class="value">{{ formatNumber(home.anchorStats?.gifts ?? 0) }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="role.current === 'moderator'" class="rooms-block">
          <div v-if="home.modRooms.length === 0" class="empty-state">暂无管理房间</div>
          <div v-else>
            <div v-for="r in home.modRooms" :key="r.roomId" class="room-card">
              <div class="room-title">{{ r.title }}</div>
              <div class="room-status">{{ r.status || '-' }}</div>
            </div>
          </div>
        </div>
        <div v-else class="dev-block">
          <div class="stats-row"><span>错误数:</span><span>{{ home.devMetrics?.errorCount ?? 0 }}</span></div>
          <div class="stats-row"><span>消息数:</span><span>{{ home.devMetrics?.messageCount ?? 0 }}</span></div>
          <div class="stats-row"><span>错误类型:</span><span>{{ home.devMetrics?.uniqueErrorTypes ?? 0 }}</span></div>
        </div>
      </div>
      <template #footer>
        <t-space align="center" direction="horizontal">
          <t-radio-group variant="default-filled" size="small" :value="role.statsScope" @change="onScopeChange">
            <t-radio-button value="7d">7天</t-radio-button>
            <t-radio-button value="30d">30天</t-radio-button>
          </t-radio-group>
          <t-link v-if="role.current === 'moderator'" theme="primary" @click="goMore">查看更多</t-link>
        </t-space>
      </template>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useHomeStore } from '../../stores/home';
import { useRoleStore } from '../../stores/role';
import { formatCompact } from '../../utils/format';

const home = useHomeStore();
const role = useRoleStore();
const router = useRouter();

const roleTitle = computed(() => role.current === 'anchor' ? '主播统计' : (role.current === 'moderator' ? '管理房间' : '开发者指标'));

const onScopeChange = (v: string | number) => {
  const val = typeof v === 'string' ? v : String(v);
  role.setStatsScope(val === '30d' ? '30d' : '7d');
  home.fetchRoleSpecific();
};

const formatDate = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const formatDuration = (seconds?: number) => {
  if (!seconds) return '0分钟';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
};

const formatNumber = (num?: number) => {
  if (!num) return '0';
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toString();
};

const goMore = () => router.push('/live/room');
</script>

<style scoped>
.role-body { padding: 8px 0 12px 0; }
.stats-row { display: flex; justify-content: space-between; padding: 4px 0; }
.rooms-block .room-card { padding: 8px 12px; border: 1px solid var(--td-border-level-1-color); border-radius: 6px; margin-bottom: 8px; }
.room-title { font-weight: 600; color: var(--td-text-color-primary); }
.room-status { font-size: 12px; color: var(--td-text-color-secondary); }
.empty-state { color: var(--td-text-color-secondary); }

/* 主播统计卡片样式 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.overview-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--td-bg-color-container);
  border-radius: 8px;
  border: 1px solid var(--td-border-level-1-color);
  transition: all 0.2s ease;
}

.overview-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
}

.overview-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  margin-right: 12px;
  font-size: 16px;
}

.overview-content {
  flex: 1;
}

.overview-content .label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 2px;
}

.overview-content .value {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
</style>