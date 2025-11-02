<template>
  <div class="console-view">
    <div class="console-header">
      <div class="console-title">
        <i class="fas fa-terminal"></i>
        <span>控制台</span>
      </div>
      <div class="console-actions">
        <button 
          class="btn btn-sm btn-outline-secondary"
          @click="clearConsole"
          title="清空控制台"
        >
          <i class="fas fa-trash"></i>
        </button>
        <button 
          class="btn btn-sm btn-outline-secondary"
          @click="toggleSettings"
          title="设置"
        >
          <i class="fas fa-cog"></i>
        </button>
      </div>
    </div>

    <div class="console-content" ref="consoleContent">
      <div class="console-output" ref="outputContainer">
        <div 
          v-for="(entry, index) in outputHistory" 
          :key="index"
          class="console-entry"
          :class="entry.type"
        >
          <div class="entry-timestamp">
            {{ formatTimestamp(entry.timestamp) }}
          </div>
          <div class="entry-content">
            <div v-if="entry.type === 'command'" class="command-line">
              <span class="prompt">$</span>
              <span class="command">{{ entry.command }}</span>
            </div>
            <div v-else-if="entry.type === 'result'" class="result-content">
              <div 
                v-if="entry.result.success" 
                class="result-success"
              >
                {{ entry.result.message }}
              </div>
              <div 
                v-else 
                class="result-error"
              >
                <i class="fas fa-exclamation-triangle"></i>
                {{ entry.result.error || entry.result.message }}
              </div>
              <div 
                v-if="entry.result.data && showData" 
                class="result-data"
              >
                <pre>{{ formatData(entry.result.data) }}</pre>
              </div>
            </div>
            <div v-else-if="entry.type === 'info'" class="info-content">
              <i class="fas fa-info-circle"></i>
              {{ entry.message }}
            </div>
            <div v-else-if="entry.type === 'warning'" class="warning-content">
              <i class="fas fa-exclamation-triangle"></i>
              {{ entry.message }}
            </div>
            <div v-else-if="entry.type === 'error'" class="error-content">
              <i class="fas fa-times-circle"></i>
              {{ entry.message }}
            </div>
          </div>
        </div>
        
        <div v-if="isExecuting" class="console-entry executing">
          <div class="entry-content">
            <div class="executing-indicator">
              <i class="fas fa-spinner fa-spin"></i>
              执行中...
            </div>
          </div>
        </div>
      </div>

      <div class="console-input-container">
        <div class="input-line">
          <span class="prompt">$</span>
          <input
            ref="commandInput"
            v-model="currentCommand"
            type="text"
            class="command-input"
            placeholder="输入命令..."
            @keydown="handleKeyDown"
            @keyup="handleKeyUp"
            :disabled="isExecuting"
          />
        </div>
        
        <div v-if="suggestions.length > 0" class="command-suggestions">
          <div 
            v-for="(suggestion, index) in suggestions"
            :key="index"
            class="suggestion-item"
            :class="{ active: index === selectedSuggestion }"
            @click="applySuggestion(suggestion)"
          >
            <div class="suggestion-name">{{ suggestion.name }}</div>
            <div class="suggestion-description">{{ suggestion.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 设置面板 -->
    <div v-if="showSettings" class="console-settings">
      <div class="settings-header">
        <h5>控制台设置</h5>
        <button class="btn-close" @click="toggleSettings"></button>
      </div>
      <div class="settings-content">
        <div class="form-group">
          <label>
            <input 
              type="checkbox" 
              v-model="showData"
            />
            显示命令返回数据
          </label>
        </div>
        <div class="form-group">
          <label>
            <input 
              type="checkbox" 
              v-model="showTimestamp"
            />
            显示时间戳
          </label>
        </div>
        <div class="form-group">
          <label>最大历史记录数量</label>
          <input 
            type="number" 
            v-model.number="maxHistorySize"
            min="50"
            max="1000"
            class="form-control"
          />
        </div>
        <div class="form-group">
          <label>字体大小</label>
          <select v-model="fontSize" class="form-control">
            <option value="12px">小</option>
            <option value="14px">中</option>
            <option value="16px">大</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useConsoleStore } from '../../stores/console';

interface OutputEntry {
  type: 'command' | 'result' | 'info' | 'warning' | 'error';
  timestamp: number;
  command?: string;
  result?: any;
  message?: string;
}

interface CommandSuggestion {
  name: string;
  description: string;
  usage: string;
  category: string;
}

const consoleStore = useConsoleStore();

// 组件引用
const consoleContent = ref<HTMLElement>();
const outputContainer = ref<HTMLElement>();
const commandInput = ref<HTMLInputElement>();

// 状态
const currentCommand = ref('');
const outputHistory = ref<OutputEntry[]>([]);
const commandHistory = ref<string[]>([]);
const historyIndex = ref(-1);
const isExecuting = ref(false);
const suggestions = ref<CommandSuggestion[]>([]);
const selectedSuggestion = ref(-1);

// 设置
const showSettings = ref(false);
const showData = ref(false);
const showTimestamp = ref(true);
const maxHistorySize = ref(200);
const fontSize = ref('14px');

// 可用命令列表
const availableCommands = ref<CommandSuggestion[]>([]);

onMounted(async () => {
  // 初始化控制台
  await initializeConsole();
  
  // 加载可用命令
  await loadAvailableCommands();
  
  // 聚焦输入框
  focusInput();
  
  // 监听控制台事件
  consoleStore.onCommandExecuted((result) => {
    addResultEntry(result);
    isExecuting.value = false;
  });
});

onUnmounted(() => {
  // 清理资源
});

// 监听字体大小变化
watch(fontSize, (newSize) => {
  if (consoleContent.value) {
    consoleContent.value.style.fontSize = newSize;
  }
});

// 初始化控制台
async function initializeConsole() {
  try {
    await consoleStore.createSession();
    addInfoEntry('控制台已连接');
  } catch (error) {
    addErrorEntry('控制台连接失败: ' + (error as Error).message);
  }
}

// 加载可用命令
async function loadAvailableCommands() {
  try {
    const commands = await consoleStore.getAvailableCommands();
    availableCommands.value = commands;
  } catch (error) {
    console.error('Failed to load commands:', error);
  }
}

// 处理键盘事件
function handleKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Enter':
      if (suggestions.value.length > 0 && selectedSuggestion.value >= 0) {
        applySuggestion(suggestions.value[selectedSuggestion.value]);
      } else {
        executeCommand();
      }
      break;
      
    case 'ArrowUp':
      event.preventDefault();
      if (suggestions.value.length > 0) {
        selectedSuggestion.value = Math.max(0, selectedSuggestion.value - 1);
      } else {
        navigateHistory(-1);
      }
      break;
      
    case 'ArrowDown':
      event.preventDefault();
      if (suggestions.value.length > 0) {
        selectedSuggestion.value = Math.min(
          suggestions.value.length - 1, 
          selectedSuggestion.value + 1
        );
      } else {
        navigateHistory(1);
      }
      break;
      
    case 'Tab':
      event.preventDefault();
      if (suggestions.value.length > 0) {
        applySuggestion(suggestions.value[selectedSuggestion.value] || suggestions.value[0]);
      }
      break;
      
    case 'Escape':
      suggestions.value = [];
      selectedSuggestion.value = -1;
      break;
  }
}

// 处理键盘释放事件
function handleKeyUp(event: KeyboardEvent) {
  if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
    return;
  }
  
  updateSuggestions();
}

// 更新命令建议
function updateSuggestions() {
  const input = currentCommand.value.trim();
  
  if (!input) {
    suggestions.value = [];
    selectedSuggestion.value = -1;
    return;
  }
  
  const filtered = availableCommands.value.filter(cmd => 
    cmd.name.toLowerCase().includes(input.toLowerCase()) ||
    cmd.description.toLowerCase().includes(input.toLowerCase())
  );
  
  suggestions.value = filtered.slice(0, 5);
  selectedSuggestion.value = filtered.length > 0 ? 0 : -1;
}

// 应用命令建议
function applySuggestion(suggestion: CommandSuggestion) {
  currentCommand.value = suggestion.name + ' ';
  suggestions.value = [];
  selectedSuggestion.value = -1;
  focusInput();
}

// 执行命令
async function executeCommand() {
  const command = currentCommand.value.trim();
  
  if (!command) {
    return;
  }
  
  // 添加到历史记录
  commandHistory.value.push(command);
  if (commandHistory.value.length > 50) {
    commandHistory.value.shift();
  }
  historyIndex.value = -1;
  
  // 显示命令
  addCommandEntry(command);
  
  // 清空输入
  currentCommand.value = '';
  suggestions.value = [];
  selectedSuggestion.value = -1;
  
  // 执行命令
  isExecuting.value = true;
  
  try {
    await consoleStore.executeCommand(command);
  } catch (error) {
    addErrorEntry('命令执行失败: ' + (error as Error).message);
    isExecuting.value = false;
  }
}

// 导航历史记录
function navigateHistory(direction: number) {
  if (commandHistory.value.length === 0) {
    return;
  }
  
  if (historyIndex.value === -1) {
    historyIndex.value = commandHistory.value.length;
  }
  
  historyIndex.value += direction;
  
  if (historyIndex.value < 0) {
    historyIndex.value = 0;
  } else if (historyIndex.value >= commandHistory.value.length) {
    historyIndex.value = commandHistory.value.length;
    currentCommand.value = '';
    return;
  }
  
  currentCommand.value = commandHistory.value[historyIndex.value];
}

// 添加输出条目
function addCommandEntry(command: string) {
  addEntry({
    type: 'command',
    timestamp: Date.now(),
    command
  });
}

function addResultEntry(result: any) {
  addEntry({
    type: 'result',
    timestamp: Date.now(),
    result
  });
}

function addInfoEntry(message: string) {
  addEntry({
    type: 'info',
    timestamp: Date.now(),
    message
  });
}

function addErrorEntry(message: string) {
  addEntry({
    type: 'error',
    timestamp: Date.now(),
    message
  });
}

function addEntry(entry: OutputEntry) {
  outputHistory.value.push(entry);
  
  // 限制历史记录大小
  if (outputHistory.value.length > maxHistorySize.value) {
    outputHistory.value.shift();
  }
  
  // 滚动到底部
  nextTick(() => {
    scrollToBottom();
  });
}

// 清空控制台
function clearConsole() {
  outputHistory.value = [];
  addInfoEntry('控制台已清空');
}

// 切换设置面板
function toggleSettings() {
  showSettings.value = !showSettings.value;
}

// 聚焦输入框
function focusInput() {
  nextTick(() => {
    commandInput.value?.focus();
  });
}

// 滚动到底部
function scrollToBottom() {
  if (outputContainer.value) {
    outputContainer.value.scrollTop = outputContainer.value.scrollHeight;
  }
}

// 格式化时间戳
function formatTimestamp(timestamp: number): string {
  if (!showTimestamp.value) {
    return '';
  }
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

// 格式化数据
function formatData(data: any): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
</script>

<style scoped>
.console-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  min-height: 48px; /* 增加最小高度以适应触摸 */
}

.console-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.console-actions {
  display: flex;
  gap: 8px; /* 增加按钮间距 */
}

.console-actions button {
  min-width: 40px; /* 确保按钮足够大以便触摸 */
  min-height: 40px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.console-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.console-output {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  /* 改善移动端滚动 */
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

.console-entry {
  display: flex;
  margin-bottom: 8px; /* 增加条目间距 */
  line-height: 1.5; /* 增加行高以提高可读性 */
  padding: 4px 0; /* 添加垂直内边距 */
}

.entry-timestamp {
  color: #6a6a6a;
  font-size: 11px;
  margin-right: 8px;
  min-width: 80px;
  flex-shrink: 0;
}

.entry-content {
  flex: 1;
  word-wrap: break-word; /* 确保长文本换行 */
  overflow-wrap: break-word;
}

.command-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap; /* 允许换行 */
}

.prompt {
  color: #4ec9b0;
  font-weight: bold;
}

.command {
  color: #d4d4d4;
  word-break: break-all; /* 确保长命令可以换行 */
}

.result-success {
  color: #4ec9b0;
}

.result-error {
  color: #f44747;
  display: flex;
  align-items: flex-start; /* 改为顶部对齐 */
  gap: 4px;
  flex-wrap: wrap;
}

.result-data {
  margin-top: 8px; /* 增加间距 */
  padding: 12px; /* 增加内边距 */
  background: #252526;
  border-radius: 6px; /* 增加圆角 */
  font-size: 12px;
  overflow-x: auto; /* 允许水平滚动 */
}

.result-data pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.info-content,
.warning-content,
.error-content {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
}

.info-content {
  color: #569cd6;
}

.warning-content {
  color: #dcdcaa;
}

.error-content {
  color: #f44747;
}

.executing-indicator {
  color: #dcdcaa;
  display: flex;
  align-items: center;
  gap: 8px;
}

.console-input-container {
  position: relative;
  border-top: 1px solid #3e3e42;
}

.input-line {
  display: flex;
  align-items: center;
  padding: 12px; /* 增加内边距以适应触摸 */
  background: #2d2d30;
  min-height: 56px; /* 确保输入区域足够高 */
}

.command-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #d4d4d4;
  font-family: inherit;
  font-size: 16px; /* 增加字体大小以防止移动端缩放 */
  outline: none;
  margin-left: 8px;
  padding: 8px 0; /* 添加垂直内边距 */
}

.command-input::placeholder {
  color: #6a6a6a;
}

.command-suggestions {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: #2d2d30;
  border: 1px solid #3e3e42;
  border-bottom: none;
  max-height: 250px; /* 增加最大高度 */
  overflow-y: auto;
  z-index: 1000;
  -webkit-overflow-scrolling: touch;
}

.suggestion-item {
  padding: 12px; /* 增加内边距以适应触摸 */
  cursor: pointer;
  border-bottom: 1px solid #3e3e42;
  min-height: 48px; /* 确保触摸目标足够大 */
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: #094771;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-name {
  font-weight: 500;
  color: #4ec9b0;
  font-size: 14px;
}

.suggestion-description {
  font-size: 12px;
  color: #9d9d9d;
  margin-top: 2px;
  line-height: 1.3;
}

.console-settings {
  position: absolute;
  top: 0;
  right: 0;
  width: 320px; /* 增加宽度 */
  height: 100%;
  background: #2d2d30;
  border-left: 1px solid #3e3e42;
  z-index: 1000;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #3e3e42;
  min-height: 60px;
}

.settings-header h5 {
  margin: 0;
  color: #d4d4d4;
}

.btn-close {
  background: none;
  border: none;
  color: #d4d4d4;
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  min-width: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  background: #3e3e42;
}

.settings-content {
  padding: 16px;
}

.form-group {
  margin-bottom: 20px; /* 增加间距 */
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #d4d4d4;
  font-size: 14px;
  cursor: pointer;
}

.form-group input[type="checkbox"] {
  margin-right: 8px;
  transform: scale(1.2); /* 增大复选框 */
}

.form-group input[type="number"],
.form-group select {
  width: 100%;
  padding: 10px; /* 增加内边距 */
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 14px;
  min-height: 44px; /* 确保输入框足够高 */
}

.form-group input[type="number"]:focus,
.form-group select:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

/* 滚动条样式优化 */
.console-output::-webkit-scrollbar,
.command-suggestions::-webkit-scrollbar,
.console-settings::-webkit-scrollbar {
  width: 8px;
}

.console-output::-webkit-scrollbar-track,
.command-suggestions::-webkit-scrollbar-track,
.console-settings::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.console-output::-webkit-scrollbar-thumb,
.command-suggestions::-webkit-scrollbar-thumb,
.console-settings::-webkit-scrollbar-thumb {
  background: #3e3e42;
  border-radius: 4px;
}

.console-output::-webkit-scrollbar-thumb:hover,
.command-suggestions::-webkit-scrollbar-thumb:hover,
.console-settings::-webkit-scrollbar-thumb:hover {
  background: #4e4e52;
}

/* 滚动条样式 */
.console-output::-webkit-scrollbar,
.command-suggestions::-webkit-scrollbar {
  width: 8px;
}

.console-output::-webkit-scrollbar-track,
.command-suggestions::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.console-output::-webkit-scrollbar-thumb,
.command-suggestions::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 4px;
}

.console-output::-webkit-scrollbar-thumb:hover,
.command-suggestions::-webkit-scrollbar-thumb:hover {
  background: #4f4f4f;
}
</style>