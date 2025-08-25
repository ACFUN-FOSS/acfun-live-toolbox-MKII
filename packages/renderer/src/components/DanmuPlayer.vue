<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import { TButton, TInput, TMessage } from 'tdesign-vue-next';

// 弹幕消息接口
interface DanmuMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  color: string;
  fontSize: number;
  speed: number;
  position: 'top' | 'middle' | 'bottom';
  timestamp: number;
}

// 组件属性
const props = defineProps({
  roomId: {
    type: String,
    required: true
  },
  customDanmuUrl: {
    type: String,
    required: true
  },
  officialDanmuUrl: {
    type: String,
    required: true
  }
});

// 组件状态
const danmuList = ref<DanmuMessage[]>([]);
const isConnected = ref(false);
const connectionStatus = ref('disconnected'); // disconnected, connecting, connected
const currentUrl = ref(props.officialDanmuUrl);
const newDanmu = ref('');
const danmuColor = ref('#FFFFFF');
const fontSize = ref(20);
const speed = ref(100);
const position = ref<'top' | 'middle' | 'bottom'>('middle');
const showSendPanel = ref(false);
const danmuRef = ref<HTMLDivElement>(null);
const scrollDanmus = ref<DanmuMessage[]>([]);
const topDanmus = ref<DanmuMessage[]>([]);
const bottomDanmus = ref<DanmuMessage[]>([]);

// WebSocket连接
let socket: WebSocket | null = null;

// 连接弹幕服务器
const connectDanmuServer = () => {
  if (socket) {
    socket.close();
  }

  connectionStatus.value = 'connecting';

  try {
    // 使用当前选择的URL建立WebSocket连接
    socket = new WebSocket(currentUrl.value);

    socket.onopen = () => {
      console.log('弹幕服务器连接成功');
      isConnected.value = true;
      connectionStatus.value = 'connected';
      TMessage.success('弹幕连接成功');
    };

    socket.onmessage = (event) => {
      try {
        // 解析弹幕消息
        const data = JSON.parse(event.data);
        if (data.type === 'danmu') {
          const danmu: DanmuMessage = {
            id: Date.now().toString() + Math.floor(Math.random() * 1000),
            userId: data.userId || 'unknown',
            username: data.username || '匿名用户',
            content: data.content,
            color: data.color || '#FFFFFF',
            fontSize: data.fontSize || 20,
            speed: data.speed || 100,
            position: data.position || 'middle',
            timestamp: Date.now()
          };

          // 添加到弹幕列表
          danmuList.value.push(danmu);

          // 根据位置分类
          if (danmu.position === 'top') {
            topDanmus.value.push(danmu);
          } else if (danmu.position === 'bottom') {
            bottomDanmus.value.push(danmu);
          } else {
            scrollDanmus.value.push(danmu);
          }

          // 限制弹幕数量，防止内存泄漏
          if (danmuList.value.length > 1000) {
            danmuList.value.shift();
          }

          if (scrollDanmus.value.length > 500) {
            scrollDanmus.value.shift();
          }

          if (topDanmus.value.length > 100) {
            topDanmus.value.shift();
          }

          if (bottomDanmus.value.length > 100) {
            bottomDanmus.value.shift();
          }
        }
      } catch (error) {
        console.error('解析弹幕消息失败:', error);
      }
    };

    socket.onclose = () => {
      console.log('弹幕服务器连接关闭');
      isConnected.value = false;
      connectionStatus.value = 'disconnected';
      TMessage.info('弹幕连接已关闭');
    };

    socket.onerror = (error) => {
      console.error('弹幕服务器连接错误:', error);
      isConnected.value = false;
      connectionStatus.value = 'disconnected';
      TMessage.error('弹幕连接失败，请重试');
    };
  } catch (error) {
    console.error('建立弹幕连接失败:', error);
    isConnected.value = false;
    connectionStatus.value = 'disconnected';
    TMessage.error('建立弹幕连接失败');
  }
};

// 切换弹幕源
const switchDanmuSource = (useCustom: boolean) => {
  currentUrl.value = useCustom ? props.customDanmuUrl : props.officialDanmuUrl;
  if (isConnected.value) {
    connectDanmuServer();
  }
};

// 发送弹幕
const sendDanmu = () => {
  if (!newDanmu.value.trim()) {
    TMessage.warning('请输入弹幕内容');
    return;
  }

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    TMessage.warning('请先连接弹幕服务器');
    return;
  }

  const danmu: DanmuMessage = {
    id: Date.now().toString() + Math.floor(Math.random() * 1000),
    userId: 'self',
    username: '我',
    content: newDanmu.value,
    color: danmuColor.value,
    fontSize: fontSize.value,
    speed: speed.value,
    position: position.value,
    timestamp: Date.now()
  };

  try {
    socket.send(JSON.stringify({
      type: 'send_danmu',
      data: danmu
    }));
    newDanmu.value = '';
    TMessage.success('弹幕发送成功');
  } catch (error) {
    console.error('发送弹幕失败:', error);
    TMessage.error('发送弹幕失败，请重试');
  }
};

// 清屏
const clearDanmu = () => {
  danmuList.value = [];
  scrollDanmus.value = [];
  topDanmus.value = [];
  bottomDanmus.value = [];
  TMessage.success('弹幕已清屏');
};

// 组件挂载时
onMounted(() => {
  connectDanmuServer();
});

// 组件卸载时
onUnmounted(() => {
  if (socket) {
    socket.close();
  }
});
</script>

<template>
  <div class="danmu-player-container">
    <!-- 弹幕显示区域 -->
    <div ref="danmuRef" class="danmu-screen">
      <!-- 滚动弹幕 -->
      <div v-for="danmu in scrollDanmus" :key="danmu.id" class="danmu scroll-danmu"
           :style="{
             color: danmu.color,
             fontSize: `${danmu.fontSize}px`,
             animationDuration: `${10000 / (danmu.speed / 100)}ms`
           }">
        <span class="danmu-username">{{ danmu.username }}:</span> {{ danmu.content }}
      </div>

      <!-- 顶部固定弹幕 -->
      <div v-for="danmu in topDanmus" :key="danmu.id" class="danmu top-danmu"
           :style="{
             color: danmu.color,
             fontSize: `${danmu.fontSize}px`,
             top: `${(topDanmus.indexOf(danmu) % 5) * (danmu.fontSize + 10)}px`
           }">
        <span class="danmu-username">{{ danmu.username }}:</span> {{ danmu.content }}
      </div>

      <!-- 底部固定弹幕 -->
      <div v-for="danmu in bottomDanmus" :key="danmu.id" class="danmu bottom-danmu"
           :style="{
             color: danmu.color,
             fontSize: `${danmu.fontSize}px`,
             bottom: `${(bottomDanmus.indexOf(danmu) % 5) * (danmu.fontSize + 10)}px`
           }">
        <span class="danmu-username">{{ danmu.username }}:</span> {{ danmu.content }}
      </div>
    </div>

    <!-- 弹幕控制区域 -->
    <div class="danmu-controls">
      <div class="connection-status">
        <span>弹幕连接状态: </span>
        <span :class="{
          'status-connected': connectionStatus === 'connected',
          'status-connecting': connectionStatus === 'connecting',
          'status-disconnected': connectionStatus === 'disconnected'
        }">
          {{ connectionStatus === 'connected' ? '已连接' : connectionStatus === 'connecting' ? '连接中' : '未连接' }}
        </span>
        <TButton
          size="small"
          :disabled="connectionStatus === 'connecting'"
          @click="connectDanmuServer"
          :variant="isConnected ? 'outline' : 'primary'"
        >
          {{ isConnected ? '重新连接' : '连接' }}
        </TButton>
      </div>

      <div class="source-switch">
        <span>弹幕源: </span>
        <TButton
          size="small"
          :variant="currentUrl === props.officialDanmuUrl ? 'primary' : 'outline'"
          @click="switchDanmuSource(false)"
        >
          官方源
        </TButton>
        <TButton
          size="small"
          :variant="currentUrl === props.customDanmuUrl ? 'primary' : 'outline'"
          @click="switchDanmuSource(true)"
        >
          自定义源
        </TButton>
      </div>

      <div class="control-buttons">
        <TButton size="small" @click="clearDanmu" variant="outline">清屏</TButton>
        <TButton size="small" @click="showSendPanel = !showSendPanel" variant="outline">
          {{ showSendPanel ? '关闭发送' : '发送弹幕' }}
        </TButton>
      </div>

      <!-- 弹幕发送面板 -->
      <div v-if="showSendPanel" class="send-panel">
        <div class="send-form">
          <TInput
            v-model="newDanmu"
            placeholder="输入弹幕内容"
            maxlength="50"
            class="danmu-input"
          />
          <div class="send-options">
            <div class="option-item">
              <label>颜色:</label>
              <input type="color" v-model="danmuColor" />
            </div>
            <div class="option-item">
              <label>字体大小:</label>
              <input type="range" v-model="fontSize" min="12" max="36" />
              <span>{{ fontSize }}px</span>
            </div>
            <div class="option-item">
              <label>速度:</label>
              <input type="range" v-model="speed" min="50" max="200" />
              <span>{{ speed }}</span>
            </div>
            <div class="option-item">
              <label>位置:</label>
              <select v-model="position">
                <option value="top">顶部</option>
                <option value="middle">滚动</option>
                <option value="bottom">底部</option>
              </select>
            </div>
          </div>
          <TButton @click="sendDanmu" variant="primary" class="send-button">发送</TButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.danmu-player-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  overflow: hidden;
}

.danmu-screen {
  width: 100%;
  height: calc(100% - 120px);
  position: relative;
  overflow: hidden;
}

.danmu {
  position: absolute;
  white-space: nowrap;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  pointer-events: auto;
  padding: 2px 8px;
  border-radius: 4px;
}

.danmu:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.danmu-username {
  font-weight: bold;
  margin-right: 5px;
}

.scroll-danmu {
  animation-name: scrollDanmu;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
  right: -500px;
  top: 0;
}

.top-danmu {
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
}

.bottom-danmu {
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
}

@keyframes scrollDanmu {
  from { right: -500px; }
  to { left: -500px; }
}

.danmu-controls {
  width: 100%;
  padding: 10px;
  box-sizing: border-box;
  background-color: rgba(0, 0, 0, 0.8);
  position: absolute;
  bottom: 0;
}

.connection-status {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.source-switch {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-buttons {
  margin-bottom: 10px;
  display: flex;
  gap: 10px;
}

.send-panel {
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 4px;
}

.send-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.danmu-input {
  width: 100%;
}

.send-options {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  align-items: center;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.send-button {
  align-self: flex-end;
}

.status-connected {
  color: #00b42a;
}

.status-connecting {
  color: #ff7d00;
}

.status-disconnected {
  color: #f53f3f;
}
</style>