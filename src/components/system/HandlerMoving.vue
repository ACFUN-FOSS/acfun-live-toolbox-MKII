<template>
	<div class="handleMoving" @mousedown="addMovingListener">
		<slot />
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { getWinPos, ipcRenderer, setWinBounds } from "@front/util_function/system";
export default defineComponent({
	name: "handleMoving",
	data() {
		const size: any = null;
		return {
			size,
		};
	},
	mounted() {
		ipcRenderer.on("resize", this.setResize);
	},
	beforeUnmount() {
		ipcRenderer.off("resize", this.setResize);
	},
	methods: {
		async setResize() {
			const winPosition = await getWinPos();
			setWinBounds({
				width: 1048,
				height: 724,
				x: winPosition[0],
				y: winPosition[1],
			});
		},
		async addMovingListener(e: MouseEvent): Promise<void> {
			const startX = e.screenX;
			const startY = e.screenY;
			const winPosition = await getWinPos();
			const setPosition = (evt: MouseEvent) => {
				if (!this.size) {
					this.size = {
						height: window.innerHeight,
						width: window.innerWidth,
					};
				}
				setWinBounds({
					...this.size,
					x: winPosition[0] + (evt.screenX - startX),
					y: winPosition[1] + (evt.screenY - startY),
				});
			};
			window.addEventListener("mousemove", setPosition);
			window.addEventListener(
				"mouseup",
				() => {
					window.removeEventListener("mousemove", setPosition);
				},
				{
					once: true,
				}
			);
		},
	},
});
</script>

<style scoped lang="scss">
@use "sass:map";
.handleMoving {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}
</style>
