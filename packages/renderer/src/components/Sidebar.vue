<script setup lang="ts">
import {
  Menu as TMenu,
  MenuItem as TMenuItem,
  Icon,
  MenuGroup as TMenuGroup,
} from "tdesign-vue-next";
import { ref } from "vue";
const selectedKeys = ref("home");

const collapsed = ref<boolean>(false);

const handleCollapse = () => {
  collapsed.value = !collapsed.value;
};
</script>

<template>
  <div class="sidebar-container" :class="{ collapsed }">
    <!-- 添加折叠状态类绑定 -->
    <TMenu
     v-model="selectedKeys"
      class="sidebar-menu"
      :collapsed="collapsed"
      :width="200"
      :collapsed-width="64"
      :multiple="false"
    >
      <!-- 未命名分组 -->
      <TMenuItem value="home" :to="{ name: 'home' }">
        <template #icon>
          <Icon name="home" />
        </template>
        <span class="menu-text">首页</span>
      </TMenuItem>

      <!-- 应用分组 -->
      <TMenuGroup title="应用">
        <TMenuItem value="market">
          <template #icon>
            <Icon name="shop" />
          </template>
          <span class="menu-text">应用市场</span>
        </TMenuItem>
      </TMenuGroup>

      <!-- 其它分组 -->
      <TMenuGroup title="其它">
        <TMenuItem value="settings">
          <template #icon>
            <Icon name="setting" />
          </template>
          <span class="menu-text">设置</span>
        </TMenuItem>
        <TMenuItem value="develop">
          <template #icon>
            <Icon name="system-code" />
          </template>
          <span class="menu-text">开发</span>
        </TMenuItem>
      </TMenuGroup>

      <!-- 操作按钮区域 -->
      <template #operations>
        <TButton
          class="t-demo-collapse-btn"
          variant="text"
          shape="square"
          @click="handleCollapse"
        >
          <Icon :name="collapsed ? 'menu-unfold' : 'menu-fold'" />
        </TButton>
      </template>
    </TMenu>
  </div>
</template>

<style scoped>
.sidebar-container {
  height: 100%;
  background-color: var(--td-bg-color-secondary);
  color: var(--td-text-color-primary);
  overflow: hidden;
  display: block !important;
  visibility: visible !important;
}

/* 深色模式特定样式 */
/* 已通过全局CSS变量实现主题适配，无需单独设置 */
/* 侧边栏背景色继承自父容器的 --td-bg-color-secondary */

.sidebar-menu {
  height: 100%;
  width: 100%;
  border-right: none;
  padding-top: 20px;
  box-sizing: border-box;
}
</style>
