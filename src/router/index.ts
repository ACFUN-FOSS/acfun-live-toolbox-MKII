import { createRouter as vueRouterCreateRouter, createWebHistory, RouteRecordRaw, Router } from "vue-router";
import { isElectron } from "@front/util_function/electron";
import { getElectronRouting } from "@front/router/electronRouting";

// ATTENTION: Don't use:
// process
// global
// and any other node.js-specific global variables
// in non-electron environment.



//export default router;

// function foo(): Promise<Router> {
// 	console.log(1);
// 	return new Promise((resolve, reject) => {
// 		console.log(2);
// 		(import("@front/router/electronRouting").then(module =>
// 			console.log(module))
// 		).catch(err => console.error(err));
// 		console.log("e");
// 	})
// }

// export async function createRouter(): Promise<Router> {
// 	foo().then(() => {
// 		console.log("asdf")
// 	});
// 	return null;
// }

/**
 * 給路由器設置一咯過濾器，該過濾器負責主窗口在未登入時跳轉到登入頁面。
 * 
 * 在開發模式下，不起作用。
 */
function setupRouterFilter(router: Router) {
	if (!isElectron() || process.env.NODE_ENV === "production") {
		console.log(2);
		router.beforeEach((to, from, next) => {
			if (!isElectron()) {
				if (to.meta.noElectron || to.name === "404") {
					next();
					return;
				}
				next({
					name: "404"
				});
			} else {
				// @ts-ignore
				if (to.meta.disabled && to.meta.disabled()) {
					next(false);
					return;
				}
				if (to.fullPath.includes("legacyApplet")) {
					next();
					return;
				}

				if (sessionStorage.getItem("logined") === "true") {
					if (to.name !== "Login") {
						next();
						return;
					}
					next({
						name: "dashboard"
					});
					return;
				}
				if (to.name === "Login") {
					next();
					return;
				}
				next({
					name: "Login"
				});
			}
		});
	}
}

// 可能是 rollup 的 bug 导致了如下问题：在 production 时候，入口文件以及其所 import
// 的 module 均不能出现 top-level await，否则 await 将永远等待
// （见 src/main.ts）
export async function createRouter(): Promise<Router> {

	const routings: Array<RouteRecordRaw> = isElectron() ?
		await (await import("@front/router/electronRouting")).getElectronRouting()
		: (await import("@front/router/externalBrowserRouting")).externalBrowserRouting;

	//const routings = await (await import("@front/router/electronRouting")).getElectronRouting();
	// const routings = await getElectronRouting();


	const router = (() => {
		if (isElectron())
			return vueRouterCreateRouter({
				history: createWebHistory(process.env.BASE_URL),
				routes: routings
			});
		else
			return vueRouterCreateRouter({
				history: createWebHistory(),
				routes: routings
			});
	})();
	
	setupRouterFilter(router);

	return router;
}
