<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Icon, Loading, Alert } from 'tdesign-vue-next';

// 默认内容数据
const DEFAULT_CONTENT = {
  welcome: '欢迎使用 AcFun 直播框架\n\n这是一个高效、稳定、可扩展的直播解决方案，专为专业直播场景设计。\n\n主要特性：\n- 多平台推流支持\n- 实时互动弹幕系统\n- 自定义直播间布局\n- 完善的数据分析功能',
  announcements: '【2023-11-15】系统更新公告\n\n1. 新增多机位切换功能\n2. 优化直播延迟问题，降低至2秒以内\n3. 修复已知bug，提升系统稳定性\n\n感谢您的使用与支持！',
  tutorial: '快速开始使用指南\n\n1. 注册并登录账号\n2. 在控制台创建新直播间\n3. 配置直播参数（分辨率、码率等）\n4. 下载并安装推流工具\n5. 复制推流地址到工具中\n6. 点击"开始直播"按钮\n\n详细教程请查看官方文档。'
};


// 内容数据状态
const content = ref<{
  welcome: string;
  announcements: string;
  tutorial: string;
}>({
  welcome: DEFAULT_CONTENT.welcome,
  announcements: DEFAULT_CONTENT.announcements,
  tutorial: DEFAULT_CONTENT.tutorial
});

// 加载状态
const loading = ref<{
  welcome: boolean;
  announcements: boolean;
  tutorial: boolean;
}>({
  welcome: true,
  announcements: true,
  tutorial: true
});

// 错误状态
const error = ref<{
  welcome: string | null;
  announcements: string | null;
  tutorial: string | null;
}>({
  welcome: null,
  announcements: null,
  tutorial: null
});

/**
 * 从TXT文件加载内容
 * @param section 栏目名称
 * @param url 文件URL
 */
const loadContent = async (section: keyof typeof content, url: string) => {
  try {
    loading.value[section] = true;
    error.value[section] = null;
      // 实际项目中应该替换为真实的API请求
    // 这里使用setTimeout模拟网络请求延迟
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 预留接口：通过fetch请求TXT文件
    // const response = await fetch(url);
    // if (!response.ok) throw new Error('内容加载失败');
    // content.value[section] = await response.text();
    
    // 使用默认数据
    content.value[section] = DEFAULT_CONTENT[section];
  } catch (err) {
    error.value[section] = err instanceof Error ? err.message : '加载失败，请重试';
    console.error(`加载${section}内容失败:`, err);
  } finally {
    loading.value[section] = false;
  }
}


// WebGL背景效果
let animationId: number;
let gl: WebGLRenderingContext | null = null;

// 初始化WebGL渐变背景
const initWebGLBackground = () => {
  console.log('Initializing WebGL background...');
  const canvas = document.getElementById('webgl-bg') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // 设置canvas尺寸为窗口大小
  const resizeCanvas = () => {
    const parent = canvas.parentElement;
    const width = window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    console.log(`Canvas resized to ${width}x${height}`);
    if (gl) {
      gl.viewport(0, 0, width, height);
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  gl = canvas.getContext('webgl');
  if (!gl) {
    console.error('Failed to get WebGL context');
    // 降级方案: 使用CSS渐变
    canvas.style.background = 'linear-gradient(135deg, #3662e3, #535bf2, #1aa7b9)';
    return;
  }

  console.log('WebGL context initialized successfully');

  // 简单的渐变着色器
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

  if (!vertexShader || !fragmentShader) {
    console.error('Failed to create shaders');
    return;
  }

  // 顶点着色器
  gl.shaderSource(vertexShader, `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `);

  // 片段着色器 - 增强动态渐变效果
  gl.shaderSource(fragmentShader, `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      uv.y = 1.0 - uv.y;

      // 增强动画速度和颜色变化范围
      float time = u_time * 1.5; // 进一步提高动画速度

      // 动态渐变颜色 - 增加动画幅度
      vec3 color1 = vec3(
        0.3 + sin(time * 0.8) * 0.25,
        0.5 + cos(time * 0.6) * 0.25,
        0.9 + sin(time * 0.7) * 0.25
      );
      vec3 color2 = vec3(
        0.6 + cos(time * 0.5) * 0.25,
        0.3 + sin(time * 0.7) * 0.25,
        0.9 + cos(time * 0.6) * 0.25
      );
      vec3 color3 = vec3(
        0.2 + sin(time * 0.6) * 0.25,
        0.7 + cos(time * 0.8) * 0.25,
        0.8 + sin(time * 0.5) * 0.25
      );

      // 添加更强的流动效果
      vec2 flow = vec2(
        sin(time * 0.4 + uv.y * 2.5) * 0.15,
        cos(time * 0.3 + uv.x * 2.5) * 0.15
      );
      vec2 animatedUV = uv + flow;

      // 混合渐变
      vec3 color = mix(color1, color2, animatedUV.x);
      color = mix(color, color3, animatedUV.y);

      // 添加噪点效果
      float noise = fract(sin(dot(animatedUV, vec2(12.9898, 78.233))) * 43758.5453);
      color += noise * 0.05;

      gl_FragColor = vec4(color, 0.85);
    }
  `);

  gl.compileShader(vertexShader);
  gl.compileShader(fragmentShader);

  // 检查着色器编译错误
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader compile error:', gl.getShaderInfoLog(vertexShader));
    return;
  }
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader compile error:', gl.getShaderInfoLog(fragmentShader));
    return;
  }

  const program = gl.createProgram();
  if (!program) {
    console.error('Failed to create program');
    return;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // 检查程序链接错误
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  // 设置顶点数据
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
  if (positionAttributeLocation === -1) {
    console.error('a_position attribute not found');
    return;
  }
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  // 动画循环
  const animate = (timestamp: number) => {
    if (!gl || !program) return;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 更新时间 uniforms
    const timeUniformLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');

    if (timeUniformLocation && resolutionUniformLocation) {
      gl.uniform1f(timeUniformLocation, timestamp / 1000);
      gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      console.error('Uniform locations not found');
    }

    animationId = requestAnimationFrame(animate);
  }

  // 立即执行一次动画以确保显示
  animate(performance.now());
  animationId = requestAnimationFrame(animate);
  console.log('WebGL animation started with animationId:', animationId);
}


// 添加CSS降级样式
// 当WebGL不可用时使用CSS动画渐变

// 组件挂载时加载所有内容
onMounted(() => {
  initWebGLBackground();
  loadContent('welcome', '/api/content/welcome.txt');
  loadContent('announcements', '/api/content/announcements.txt');
  loadContent('tutorial', '/api/content/tutorial.txt');
});

// 组件卸载时清理WebGL资源
onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  window.removeEventListener('resize', () => {});
});
</script>

<template>
  <div class="home-page">
    <!-- 欢迎区域 -->
    <section class="welcome-section acrylic-effect">
  <canvas id="webgl-bg" class="webgl-background"></canvas>
      <div class="welcome-content">
        <h1 class="welcome-title">
          <Icon name="welcome" size="32" class="title-icon" /> AcFrame 直播框架
        </h1>
        <p class="welcome-desc">高效、稳定、可扩展的直播解决方案</p>
        <div class="welcome-actions">
          <TButton size="large" theme="primary" class="action-button">
            <Icon name="play-circle" size="18" class="button-icon" /> 开始使用
          </TButton>
          <TButton size="large" variant="outline" class="action-button">
            <Icon name="book" size="18" class="button-icon" /> 查看文档
          </TButton>
        </div>
      </div>
    </section>

    <!-- 内容区域 -->
    <div class="content-container">
      <!-- 公告区域 -->
      <section class="content-section">
        <div class="section-header">
          <Icon name="bell" size="20" class="section-icon" />
          <h2 class="section-title">公告</h2>
        </div>
        <div class="section-content">
          <Loading v-if="loading.announcements" size="large" />          
          <Alert v-else-if="error.announcements" theme="error" :message="error.announcements" />
          <div v-else class="text-content" v-html="content.announcements.replace(/\n/g, '<br>')"></div>
        </div>
      </section>

      <!-- 使用教程区域 -->
      <section class="content-section">
        <div class="section-header">
          <Icon name="bookmark" size="20" class="section-icon" />
          <h2 class="section-title">使用教程</h2>
        </div>
        <div class="section-content">
          <Loading v-if="loading.tutorial" size="large" />
          <Alert v-else-if="error.tutorial" theme="error" :message="error.tutorial" />
          <div v-else class="text-content" v-html="content.tutorial.replace(/\n/g, '<br>')"></div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* 基础样式 */
.home-page {
  background-color: #0f172a; /* 页面背景色 - UI规范 */
  color: #f8fafc; /* 主要文本色 - UI规范 */
  display: flex;
  flex-direction: column;
  padding: 0 1.5rem;
}

/* 欢迎区域样式 */
.welcome-section {
  position: relative;
  padding: 2.5rem 2rem;
  margin-bottom: 1.5rem;
  border-radius:4px; /*统一圆角 - UI规范 */
  color: white;
  text-align: center;
  overflow: hidden;
  transition: all 0.3s ease;
  min-height: 280px;
  display: flex;
  align-items: center;
}

.webgl-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* 毛玻璃效果 */
.acrylic-effect {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.8)); /* 深色主题渐变 - UI规范 */
  backdrop-filter: blur(10px);
 -webkit-backdrop-filter: blur(10px);
 box-shadow: var(--td-shadow-3);
}

.welcome-content {
  position: relative;
  z-index: 2;
  max-width: 800px;
  margin: 0 auto;
}

.welcome-title {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon {
  animation: float 3s ease-in-out infinite;
}

.welcome-desc {
  font-size: 1.2rem;
  opacity: 0.9;
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.welcome-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.action-button {
  transition: all 0.2s ease;
}

.action-button:hover {
  transform: translateY(-2px);
}

.button-icon {
  margin-right: 6px;
}

/* 内容容器 */
.content-container {
  width: 100%;
  margin: 0 auto;
  padding: 0 4rem 2rem;
  display: flex;
  gap: 1.5rem;
  height: calc(736px - 304px);
  box-sizing: border-box;
}

/* 内容区块样式 */
.content-section {
  background-color: #1e293b; /* 卡片背景色 - UI规范 */
  border-radius: 4px; /* 统一圆角 - UI规范 */
  padding: 1.2rem;
  margin: 0 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  flex: 1;
  max-height: 100%;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #1890ff transparent; /* 主色调 - UI规范 */
  box-shadow: var(--td-shadow-1);
}

.content-section::-webkit-scrollbar {
  width: 6px;
}

.content-section::-webkit-scrollbar-thumb {
  background-color: var(--td-brand-color);
  border-radius: 3px;
}

.content-section::-webkit-scrollbar-track {
  background: transparent;
}

.content-section:hover {
  transform: translateY(-3px);
  box-shadow: var(--td-shadow-2);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #334155; /* 边框色 - UI规范 */
}

.section-icon {
  color: var(--td-brand-color);
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: #f8fafc; /* 主要文本色 - UI规范 */
}

.section-content {
  min-height: 120px;
  padding: 1rem 0;
}

/* 文本内容样式 */
.text-content {
  line-height: 1.8;
  white-space: pre-line;
  color: #cbd5e1; /* 次要文本色 - UI规范 */
  font-size: 1rem;
}

/* 加载状态居中 */
:deep(.t-spin) {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
}

/* 错误提示样式 */
:deep(.t-alert) {
  margin-bottom: 0;
}

/* 装饰元素动画 */
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .welcome-title {
    font-size: 2rem;
  }
  
  .welcome-section {
    padding: 4rem 1rem;
  }
  
  .welcome-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .action-button {
    width: 100%;
  }
}
</style>