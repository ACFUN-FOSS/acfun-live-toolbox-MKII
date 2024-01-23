<template>
	<div class="rowFrame" :style="{ width }">
		<div class="title" v-if="title">{{ title }}</div>
		<div :class="[{ content: contentDefaultClass, flex: flex, 'align-center': alignCenter }, contentClass]">
			<slot />
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
	name: "rowFrame",
	props: {
		title: {
			type: String
		},
		contentClass: {
			type: String
		},
		contentDefaultClass: {
			type: Boolean,
			default: false
		},
		flex: {
			type: Boolean,
			default: false
		},
		alignCenter: {
			type: Boolean,
			default: false
		},
		width: {
			type: String,
			default: "50%"
		}
	}
});
</script>

<style scoped lang="scss">
@use "sass:map";
@import "@front/styles/common.scss";
.rowFrame {
	position: relative;
	flex-shrink: 0;
	flex-grow: 0;
	margin-bottom: 16px;
	.flex {
		display: flex;
		flex-wrap: wrap;
	}
	.align-center {
		align-items: center;
	}
	.title {
		position: relative;
		font-weight: 700;
		color: getCssVar("text-color", "primary");
		height: 24px;
		user-select: none;
	}
	.content {
		position: relative;
		background-color: white;
		width: 100%;
		box-shadow: getCssVar("box-shadow", "base");
	}
}
</style>
