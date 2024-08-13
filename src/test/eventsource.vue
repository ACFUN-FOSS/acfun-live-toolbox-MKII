<template>
	<div class="danmaku">
		<el-button @click="test">测试</el-button>
	</div>
</template>

<script>
import { defineComponent } from "vue";
// import lzwCompress from "lzwcompress";
import { load } from "@front/util_function/file";
export default defineComponent({
	cname: "JSON测试",
	name: "align1Test",
	data() {
		return {};
	},
	computed: {},
	watch: {},
	methods: {
		test() {
			const a = new EventSource(
				" http://localhost:1299/api/messagers/register?name=123"
			);
			a.onmessage = (r) => {
				console.log(r.data);
			};
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
