<template>
  <div class="system-event">
    <div class="system-icon">
      <t-icon :name="getSystemIcon()" />
    </div>
    <div class="system-content">
      <div class="system-message">
        {{ getSystemMessage() }}
      </div>
      <div
        v-if="event.details"
        class="system-details"
      >
        {{ event.details }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface SystemEvent {
  id?: string;
  type?: string;
  timestamp?: number;
  message?: string;
  details?: string;
  level?: 'info' | 'warning' | 'error' | 'success';
  userInfo?: {
    nickname?: string;
  };
}

interface Props {
  event: SystemEvent;
}

const props = defineProps<Props>();

const getSystemIcon = () => {
  switch (props.event.level) {
    case 'error':
      return 'close-circle';
    case 'warning':
      return 'error-circle';
    case 'success':
      return 'check-circle';
    default:
      return 'info-circle';
  }
};

const getSystemMessage = () => {
  if (props.event.message) {
    return props.event.message;
  }

  // 根据事件类型生成默认消息
  switch (props.event.type) {
    case 'enter_room':
      return `${props.event.userInfo?.nickname || '用户'} 进入了直播间`;
    case 'follow':
      return `${props.event.userInfo?.nickname || '用户'} 关注了主播`;
    case 'connection':
      return '连接状态变化';
    case 'room_status':
      return '房间状态更新';
    default:
      return '系统消息';
  }
};
</script>

<style scoped>
.system-event {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--td-bg-color-container);
  padding: 8px;
  border-radius: 6px;
  border-left: 3px solid var(--td-brand-color);
}

.system-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--td-brand-color);
  margin-top: 2px;
}

.system-content {
  flex: 1;
  min-width: 0;
}

.system-message {
  color: var(--td-text-color-primary);
  font-size: 14px;
  line-height: 1.4;
}

.system-details {
  color: var(--td-text-color-secondary);
  font-size: 12px;
  margin-top: 2px;
  line-height: 1.3;
}

/* 不同级别的样式 */
.system-event[data-level="error"] {
  border-left-color: var(--td-error-color);
}

.system-event[data-level="error"] .system-icon {
  color: var(--td-error-color);
}

.system-event[data-level="warning"] {
  border-left-color: var(--td-warning-color);
}

.system-event[data-level="warning"] .system-icon {
  color: var(--td-warning-color);
}

.system-event[data-level="success"] {
  border-left-color: var(--td-success-color);
}

.system-event[data-level="success"] .system-icon {
  color: var(--td-success-color);
}
</style>