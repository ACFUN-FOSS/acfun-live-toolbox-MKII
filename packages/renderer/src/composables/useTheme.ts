<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ipcRenderer } from 'electron';

// 主题状态管理
const currentTheme = ref('light');

// 应用主题
const applyTheme = () => {
  document.documentElement.setAttribute('data-theme', currentTheme.value);
};

// 初始化主题
const initTheme = async () => {
  try {
    const settings = await ipcRenderer.invoke('settings:getSettings');
    currentTheme.value = settings.theme || 'light';
    applyTheme();
  } catch (error) {
    console.error('获取主题设置失败:', error);
    currentTheme.value = 'light';
    applyTheme();
  }
};

// 监听主题变化并保存到设置
watch(currentTheme, async (newValue) => {
  try {
    await ipcRenderer.invoke('settings:updateSettings', { theme: newValue });
  } catch (error) {
    console.error('保存主题设置失败:', error);
  }
});

// 切换主题
const setTheme = (theme: string) => {
  currentTheme.value = theme;
};

// 初始化主题
onMounted(() => {
  initTheme();
});

export {
  currentTheme,
  setTheme
};

</script>