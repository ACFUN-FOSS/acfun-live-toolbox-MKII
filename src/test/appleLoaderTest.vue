<template>
	<div class="danmaku">
		<component :is="comp" />
	</div>
</template>

<script>
import { defineComponent } from "vue";
import { loadComponent } from "@front/layouts/applets/httpVue.js";
export default defineComponent({
	cname: "小程序加载测试",
	name: "appletLoaderTest",
	data() {
		return {
			comp: "",
		};
	},
	mounted() {
		loadComponent("/applets/test/index.vue").then((res) => {
			this.comp = res;
		});
	},
});
</script>
<style scoped lang="scss">
@use "sass:map";
.danmaku {
	width: 400px;
	padding: 5px;

	& > div {
		display: inline;
	}
}
</style>
