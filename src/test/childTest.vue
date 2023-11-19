<template>
	<div class="danmaku">
		<applet-list class="list" />
	</div>
</template>

<script>
import { defineComponent } from "vue";
import appletList from "@front/views/applets/widget.vue";
export default defineComponent({
	cname: "小程序测试",
	name: "appletTest",
	components: { appletList },
});
</script>
<style scoped lang="scss">
@use "sass:map";
.list {
	width: 500px !important;
	height: 200px !important;
}
</style>
