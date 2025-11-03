<template>
  <div class="gift-event">
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
    <div class="gift-content">
      <div class="gift-info">
        <img 
          v-if="event.giftDetail?.smallPngPic" 
          :src="event.giftDetail.smallPngPic" 
          :alt="event.giftDetail.giftName"
          class="gift-icon"
        />
        <span class="gift-text">
          送出了 
          <span class="gift-name">{{ event.giftDetail?.giftName || '礼物' }}</span>
          <span v-if="event.count > 1" class="gift-count">x{{ event.count }}</span>
        </span>
      </div>
      <div v-if="event.value" class="gift-value">
        价值 {{ formatPrice(event.value) }} AC币
      </div>
      <div v-if="event.combo > 1" class="combo-info">
        连击 x{{ event.combo }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Gift } from 'acfunlive-http-api/src/types';

interface Props {
  event: Gift & { id?: string; type?: string; timestamp?: number };
}

defineProps<Props>();

const formatPrice = (price: number) => {
  if (price >= 10000) {
    return (price / 10000).toFixed(1) + '万';
  }
  return price.toLocaleString();
};
</script>

<style scoped>
.gift-event {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  padding: 8px;
  border-radius: 6px;
  border-left: 3px solid #ff9800;
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

.gift-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gift-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gift-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.gift-text {
  color: var(--td-text-color-primary);
}

.gift-name {
  font-weight: 500;
  color: #ff9800;
}

.gift-count {
  font-weight: bold;
  color: #f57c00;
}

.gift-value {
  font-size: 12px;
  color: #e65100;
  font-weight: 500;
}

.combo-info {
  font-size: 12px;
  color: #ff5722;
  font-weight: bold;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>