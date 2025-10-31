<template>
  <div id="app-container">
    <header class="header">
      <h1>AcFun Live Toolbox MKII</h1>
      <nav class="nav">
        <a href="#/home" class="link">首页</a>
        <a href="#/login" class="link">登录</a>
        <a href="#/rooms" class="link">房间管理</a>
        <a href="#/events" class="link">事件历史</a>
        <a href="#/stats" class="link">统计</a>
      </nav>
    </header>
    <router-view />
  </div>
  
</template>

<script setup lang="ts">
// 布局壳：仅承载路由页面
</script>

<style scoped>
#app-container {
  margin: 24px auto;
  padding: 16px;
  max-width: 960px;
  font-family: Avenir, Helvetica, Arial, sans-serif;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--td-border-color);
  padding-bottom: 12px;
}
.nav { margin-top: 12px; }
.link { color: var(--td-brand-color); text-decoration: none; margin-right: 12px; }
</style>
