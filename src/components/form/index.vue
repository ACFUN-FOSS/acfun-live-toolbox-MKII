<template>
	<div class="danmaku-flow" @mousemove="leaveScroll" @mousewheel="scrollable = true" @mouseleave="scrollable = false">
		<transition-group name="fade">
			<danmaku-row v-menu="list" @contextmenu="currentRow = danmaku" v-for="danmaku in [...danmakuLists]" :key="getKey(danmaku)" :danmaku="danmaku" :setting="getSetting(danmaku)" />
		</transition-group>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import danmakuRow from "./danmakuRow/index.vue";
import { styleConfig } from "@front/components/danmakuFlow/utils/data";
import { getTime } from "@front/components/danmakuFlow/utils/getter";
import menu from "@front/directives/menu";
import { menu as menuList } from "@front/components/danmakuFlow/utils/common";
import debounce from "lodash/debounce";
import { event } from "@front/util_function/eventBus";
export default defineComponent({
	name: "flow",
	components: { danmakuRow },
	props: {
		danmakuList: {
			default: () => {
				return [];
			},
		},
		settings: {
			required: true,
		},
		configMode: {
			default: false,
		},
	},
	directives: {
		menu: menu(),
	},
	data() {
		const scrollObserver: any = undefined;
		const scrollTimer: any = null;
		return {
			scrollObserver,
			scrollTimer,
			scrollable: false,
			currentRow: null,
		};
	},
	computed: {
		danmakuLists(): Array<any> {
			//@ts-ignore
			switch (this.settings?.direction) {
				case "addToTop":
					return [...this.danmakuList];
				default:
					return [...this.danmakuList].reverse();
			}
		},
		list(): Array<any> {
			if (this.configMode) {
				return [];
			}
			return menuList(this.currentRow, this.$store);
		},
	},
	mounted() {
		this.scrollObserver = new MutationObserver(this.scrollToBottom);
		this.scrollObserver.observe(this.$el, {
			childList: true,
			subtree: true,
		});
		this.scrollToBottom();
		event.on("minify", this.scrollToBottom);
	},
	beforeUnmount() {
		this.scrollObserver.disconnect();
		event.off("minify", this.scrollToBottom);
	},
	methods: {
		getKey(danmaku: any) {
			return getTime(danmaku);
		},
		scrollToBottom: debounce(function () {
			// @ts-ignore
			const that = this;
			const top = that.settings?.direction === "addToTop" ? 0 : that.$el.scrollHeight;
			if (!that.scrollable) {
				clearTimeout(that.scrollTimer);
				that.$nextTick(() => {
					that.$el.scrollTo({
						top,
						behavior: "smooth",
					});
				});
			}
		}, 100),
		
		// TODO: REFACTOR: 用接口定义返回值数据结构，重命名函数名
		/**
		 * return example:
		 * 
		 * {
		 * 	code: 1000,
		 * 	name: "评论",
		 * 	type: "text",
		 * 
		 * 	// 显示该弹幕所用的 widgets（牌子、身份、用户名、弹幕文字……）
		 *	// 用来指定该弹幕的显示外观
		 * 	widgets: [
		 * 		{
		 * 			id: "171739",
		 * 			label: "身份",
		 * 			labelEn: "role"
		 * 		}
		 * 	];	
		 * }
		 */
		getSetting(danmaku: any) {
			// @ts-ignore
			const setting = this.settings?.settingOfType[danmaku.type];
			if (setting) {
				return setting;
			}
			return styleConfig(danmaku.type);
		},
		leaveScroll() {
			if (!this.scrollable) {
				return;
			}
			clearTimeout(this.scrollTimer);
			this.scrollTimer = setTimeout(() => {
				this.scrollable = false;
				this.scrollToBottom();
			}, 2000);
		},
	},
});
</script>
<style scoped lang="scss">
@use "sass:map";
@import "@front/styles/common.scss";
@import "@front/styles/scrollbar.scss";
.danmaku-flow {
	box-sizing: border-box;
	position: relative;
	width: calc(100% - 12px);
	height: calc(100% - 32px);
	overflow-x: hidden;
	overflow-y: auto;
	padding: 4px 6px;
	transform: translateZ(1);
	// will-change: contents scroll-position;
	@include scrollbarBaseSlinder();
	// & > div {
	// 	display: flex;
	// 	flex-direction: column;
	// 	align-content: stretch;
	// }
}
</style>
