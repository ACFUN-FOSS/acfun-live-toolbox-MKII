import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import { isElectron } from "@front/util_function/electron";
const routes: Array<RouteRecordRaw> = isElectron() ?
	await (await import("@front/router/clientRouter")).getClientRouter()
	: (await import("@front/router/webRouter")).default;

console.log(routes);

// ATTENTION: Don't use:
// process
// global
// and any other node.js-specific global variables
// in non-electron environment.

const router = (() => {
	if(isElectron())
		return createRouter({
			history: createWebHistory(process.env.BASE_URL),
			routes
		});
	else
		return createRouter({
			history: createWebHistory(),
			routes
		});
})();
if (!isElectron() || process.env.NODE_ENV === "production") {
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
			if (to.fullPath.includes("applet")) {
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

export default router;
