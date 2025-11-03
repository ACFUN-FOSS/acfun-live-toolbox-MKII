<template>
  <div class="like-event">
    <div class="user-info">
      <img 
        :src="event.userInfo?.avatar || '/default-avatar.png'" 
        :alt="event.userInfo?.nickname"
        class="user-avatar"
      >
      <span class="username">{{ event.userInfo?.nickname || '匿名用户' }}</span>
      <span
        v-if="event.userInfo?.medal?.clubName"
        class="medal"
      >
        {{ event.userInfo.medal.clubName }} Lv.{{ event.userInfo.medal.level }}
      </span>
    </div>
    <div class="like-content">
      <t-icon
        name="thumb-up"
        class="like-icon"
      />
      <span class="like-text">点赞了直播间</span>
      <span
        v-if="event.count && event.count > 1"
        class="like-count"
      >
        x{{ event.count }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Like } from 'acfunlive-http-api';

interface Props {
  event: Like & { id?: string; type?: string; timestamp?: number; count?: number };
}

defineProps<Props>();
</script>

<style scoped>
.like-event {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: linear-gradient(135deg, #f3e5f5, #e1bee7);
  padding: 8px;
  border-radius: 6px;
  border-left: 3px solid #9c27b0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.user-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
}

.username {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.medal {
  background: linear-gradient(45deg, #ff6b6b, #ffd93d);
  color: white;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: bold;
}

.like-content {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--td-text-color-primary);
}

.like-icon {
  color: #9c27b0;
  font-size: 16px;
}

.like-text {
  font-size: 14px;
}

.like-count {
  font-weight: bold;
  color: #7b1fa2;
}
</style>