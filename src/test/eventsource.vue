<template>
	<div class="danmaku">
		<el-button @click="test">测试</el-button>
	</div>
</template>

<script>
import { defineComponent } from "vue";
import appMsg from "@front/api/appLink/src/index.js";
export default defineComponent({
	cname: "JSON测试",
	name: "align1Test",
	data() {
		return {};
	},
	methods: {
		test() {
			const msg = new appMsg(" http://localhost:1299");
			msg.register("host");
			msg.on("callback", (e) => {
				console.log(e);
			});
			setTimeout(() => {
				msg.emit("callback", { id: 1, test: 2 }, "host");
			}, 1000);
		},
	},
});
</script>
<style scoped lang="scss">
.danmaku {
	width: 400px;
	padding: 5px;
}
</style>
