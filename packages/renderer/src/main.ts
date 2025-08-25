import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import TDesign from 'tdesign-vue-next';
import 'tdesign-vue-next/es/style/index.css';
import router from './router';
import WujieVue from "wujie-vue3";
import errorHandler from './utils/error-handler'

// 注册无界微前端组件

// 初始化错误处理
errorHandler.init()

const app = createApp(App);
app.use(TDesign);
app.use(router);
app.use(WujieVue);
app.mount('#app');
