<template>
  <div class="comment-event">
    <div class="user-info">
      <img 
        :src="event.userInfo?.avatar || '/default-avatar.png'" 
        :alt="event.userInfo?.nickname"
        class="user-avatar"
      />
      <span class="username">{{ event.userInfo?.nickname || '匿名用户' }}</span>
      <span v-if="event.userInfo?.medal?.clubName" class="medal">
        {{ event.userInfo.medal.clubName }} Lv.{{ event.userInfo.medal.level }}
      </span>
    </div>
    <div class="comment-content">
      {{ event.content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Comment } from 'acfunlive-http-api/src/types';

interface Props {
  event: Comment & { id?: string; type?: string; timestamp?: number };
}

defineProps<Props>();
</script>

<style scoped>
.comment-event {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.comment-content {
  color: var(--td-text-color-primary);
  line-height: 1.4;
  word-break: break-word;
}
</style>