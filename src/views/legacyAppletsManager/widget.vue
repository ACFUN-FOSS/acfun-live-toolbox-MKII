<!-- TODO: REFACTOR: 重命名文件为 “appletIconsList” -->
<!-- 而且，本组件不属于 view（页面），应当放到 components 文件夹下。 -->

<template>
	<div class="appletList">
		<div class="block" @click="startApplet(applet)" v-for="(applet, index) in applets" :key="index" :title="applet.name">
			<div :class="applet.icon" />
		</div>
	</div>
</template>

<script lang="ts" src="./mixin.ts" />

<style scoped lang="scss">
@use "sass:map";
@import "@front/styles/common.scss";
@import "@front/styles/scrollbar.scss";

.appletList {
	display: flex;
	flex-wrap: wrap;
	align-content: flex-start;
	@include scrollbarDark();
}
.block {
	height: 40px;
	width: 40px;
	border-radius: 4px;
	margin: 5px;
	display: flex;
	font-size: getCssVar("font-size", "large");
	align-items: center;
	justify-content: center;
	cursor: pointer;
	border: getCssVar("border", "base");
	box-shadow: getCssVar("box-shadow", "base");
	color: getCssVar("text-color", "secondary");
	&:hover {
		color: $--color-primary;
		box-shadow: getCssVar("box-shadow", "light");
	}
}
</style>
