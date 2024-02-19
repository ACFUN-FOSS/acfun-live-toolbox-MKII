import store from "@front/store";
//import testRouters from "@front/test";
import legacyAppletLayout from "@front/layouts/legacyApplet/index.vue";
import { restart } from "@front/util_function/login";
import { RouteRecordRaw } from "vue-router";
import { isRunningInDevServer } from "@front/util_function/base";
const main = () => import("@front/layouts/main/index.vue");


const electronRouting: RouteRecordRaw[] = [
	// 小程序窗口路由
	{
		name: "legacyApplet",
		path: "/legacyApplet",
		component: legacyAppletLayout,

		// See: /src/components/base/sidebars/sidebarBase.vue
		// TODO: REFACTOR:
		hidden: true
	},
	// 主窗口登入
	{
		path: "/login",
		name: "Login",
		component: () => import("@front/views/login/index.vue")
	},
	// 主窗口非登入页面（以 layouts/main 作为外层框架的页面）之路由
	{
		path: "/",
		name: "home",
		component: main,
		meta: {
			label: "直播"
		},
		redirect: "/dashboard",
		children: [
			{
				path: "/dashboard",
				name: "dashboard",
				meta: {
					label: "首页",
					icon: "Monitor",
					action: "router"
				},
				component: () => import("@front/views/dashboard/index.vue")
			},
			{
				path: "/roomMgmt",
				name: "roomMgmt",
				meta: {
					label: "房间管理",
					icon: "House",
					action: "router",
					disabled: () => {
						return store.state.streamStatus.step === "unstreamable";
					}
				},
				component: () => import("@front/views/roomMgmt/index.vue")
			},
			{
				path: "/legacyApplets",
				name: "legacyApplets",
				meta: {
					label: "旧式小程序",
					icon: "Menu",
					action: "router"
				},
				component: () => import("@front/views/legacyAppletsManager/index.vue")
			},
			{
				path: "/restart",
				name: "restart",
				meta: {
					label: "快速重启！",
					icon: "RefreshRight",
					action: restart
				}
			},
			{
				path: "/magiScr",
				name: "magiScr",
				meta: {
					label: "魔法画屏",
					icon: "MagicStick",
					action: "router",
					disabled: () => {
						return true;
					}
				},
				redirect: "/"
			}
		]
	},
	{
		path: "/record",
		name: "record",
		component: main,
		meta: {
			label: "录像"
		},
		children: [
			{
				path: "/streamRecord",
				name: "streamRecord",
				meta: {
					label: "直播录制",
					icon: "VideoCamera",
					action: "router",
					disabled: () => {
						return false;
					}
				},
				component: () => import("@front/views/records/index.vue")
			}
		]
	},
	{
		path: "/data",
		name: "data",
		component: main,
		meta: {
			label: "数据"
		},
		children: [
			{
				path: "/replay",
				name: "replay",
				meta: {
					label: "完播复盘",
					icon: "PieChart",
					action: () => {
						window.open(`http://ac.sizzwoo.cc/rank/u/${store.state.userProfile.userID}`, "_blank");
					},
					disabled: () => {
						return false;
					}
				},
				redirect: "/"
			}
		]
	},
	{
		path: "/config",
		name: "config",
		component: main,
		meta: {
			label: "设置与选项"
		},
		children: [
			{
				path: "/config/general",
				name: "general",
				component: () => import("@front/views/general/index.vue"),
				meta: {
					label: "通用",
					icon: "Setting",
					action: "router"
					// disabled: () => {
					// 	return true;
					// }
				}
				// redirect: "/"
			},
			{
				path: "/config/superChat",
				name: "superChat",
				component: () => import("@front/views/superChat/index.vue"),
				meta: {
					label: "超级聊",
					icon: "Upload",
					action: "router"
				}
			},
			{
				path: "/config/emotion",
				name: "emotion",
				component: () => import("@front/views/emotion/index.vue"),
				meta: {
					label: "表情包",
					icon: "Edit",
					action: "router"
				}
			},
			{
				path: "/config/roomNameList",
				name: "roomNameList",
				component: () => import("@front/views/roomNameList/index.vue"),
				meta: {
					label: "小本本",
					icon: "Tickets",
					action: "router",
					disabled: () => {
						return false;
					}
				}
			},
			{
				path: "/config/danmakuSetting",
				name: "danmakuSetting",
				component: () => import("@front/views/danmakuSetting/index.vue"),
				meta: {
					label: "弹幕流",
					icon: "ChatLineSquare",
					action: "router",
					disabled: () => {
						return false;
					}
				}
			},
			{
				path: "/config/robot",
				name: "robot",
				component: () => import("@front/views/robot/index.vue"),
				meta: {
					label: "鸡鸡人",
					icon: "User",
					action: "router",
					disabled: () => {
						return false;
					}
				}
			}
		]
	}
];



export async function getElectronRouting(): Promise<RouteRecordRaw[]> {
	if (isRunningInDevServer()) {
		const testPagesRouting = (await import("@front/test")).default
		return [
			...electronRouting,
			...testPagesRouting
		];
	} else {
		return electronRouting;
	}
}