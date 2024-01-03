<template>
	<row-frame title="一般设置" :flex="true">
		<row-span :span="6">
			最大回滚弹幕数量
		</row-span>
		<row-span :span="2">
			<el-input-number  v-model="setting.maxNum" />
		</row-span>
		<row-span :span="6">
			弹幕方向
		</row-span>
		<row-span :span="6">
			<el-select v-model="setting.direction" >
				<el-option label="新弹幕在下" value="addToBottom" />
				<el-option label="新弹幕在上" value="addToTop" />
			</el-select>
		</row-span>
		<span class="hint">请根据机器性能自行调节</span>
	</row-frame>
</template>

<script lang="ts">
import contentFrame from "@front/components/base/frames/contentFrame.vue";
import rowFrame from "@front/components/base/frames/rowFrame.vue";
import rowSpan from "@front/components/base/frames/rowSpan.vue";

import { defineComponent } from "vue";
export default defineComponent({
	components: {
		contentFrame,
		rowFrame,
		rowSpan
	},
	props: {
		settings: {
			required: true
		}
	},
	computed: {
		setting: {
			get(): any {
				return this.settings;
			},
			set(e: any) {
				this.$emit("update:settings", e);
			}
		}
	}
});
</script>

<style scoped lang='scss'>
</style>
