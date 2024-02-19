// import { obsApplets } from "@front/applets";

import { RouteRecordRaw } from "vue-router";

// ATTENTION: Don't use:
// process
// global
// and any other node.js-specific global variables
// in non-electron environment.

// ATTENTION: Make sure browser (not electron) is able to
// execute all code of this file.


export let externalBrowserRouting = [
	{
		path: "/obs/danmaku",
		name: "danmaku",
		meta: {
			label: "弹幕流",
			icon: "ChatLineSquare",
			action: "router",
			noElectron: true
		},
		component: () => import("@front/views/danmakuWeb/index.vue")
	},
	{
		path: "/obs/danmakuSelf",
		name: "danmakuSelf",
		meta: {
			label: "弹幕流",
			icon: "ChatLineSquare",
			action: "router",
			noElectron: true
		},
		component: () => import("@front/views/danmakuWeb/self.vue")
	},
	{
		path: "/obs/applets",
		name: "obsApplet",
		meta: {
			label: "小程序",
			icon: "ChatLineSquare",
			action: "router",
			noElectron: true
		},
		component: () => import("@front/views/danmakuWeb/obsLegacyApplet.vue")
	},
	{
		path: "/404",
		name: "404",
		component: () => import("@front/views/error-page/404.vue")
	}
] as RouteRecordRaw[];
