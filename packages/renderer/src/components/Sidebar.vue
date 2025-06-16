<script setup lang="ts">
import {ref} from "vue";
const selectedKeys = ref(['home']);
import { Menu as TMenu, MenuItem as TMenuItem, Icon,MenuGroup as TMenuGroup, } from 'tdesign-vue-next';
const collapsed = ref(false);

const changeCollapsed = () => {
  collapsed.value = !collapsed.value;
};

const handleSelect = (keys) => {
  selectedKeys.value = keys;
  console.log('Selected keys updated:', keys);
};

</script>


<template>
  <div class="sidebar-container" :class="{ collapsed }"><!-- 添加折叠状态类绑定 -->
    <TMenu
  v-model:selectedKeys="selectedKeys"
  class="sidebar-menu"
  :collapsed="collapsed"
  :width="200"
  :collapsed-width="64"
  @select="handleSelect"
  :multiple="false"
>
      <!-- 未命名分组 -->
        <TMenuItem key="home">
          <template #icon>
            <Icon name="home" />
          </template>
          <span class="menu-text">首页</span>
        </TMenuItem>

      <!-- 应用分组 -->
      <TMenuGroup title="应用">
        <!-- 暂时为空 -->
      </TMenuGroup>

      <!-- 其它分组 -->
      <TMenuGroup title="其它">
        <TMenuItem key="settings">
          <template #icon>
            <Icon name="setting" />
          </template>
          <span class="menu-text">设置</span>
        </TMenuItem>
        <TMenuItem key="develop">
          <template #icon>
            <Icon name="system-code" />
          </template>
          <span class="menu-text">开发</span>
        </TMenuItem>
      </TMenuGroup>

      <!-- 操作按钮区域 -->
      <template #operations>
        <TButton class="t-demo-collapse-btn" variant="text" shape="square" @click="changeCollapsed">
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
:deep(.theme--dark) .sidebar-container {
  background-color: #1d1e23;
}

/* 提高侧边栏与顶边栏的区分度 */
:deep(.theme--light) .sidebar-container {
  background-color: #eaeaea;
}

.sidebar-menu {
  height: 100%;
  width: 100%;
  border-right: none;
  padding-top: 20px;
  box-sizing: border-box;
}
</style>