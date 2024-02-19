/**
 * FILENAME: main.ts
 * 
 * DESC: 浏览器（包括 electron 浏览器和推流软件的浏览器源）的入口文件
 */
import "@front/styles/index.scss";
import ElementPlus from "element-plus";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import store from "@front/store";
import { createRouter } from "@front/router";
import App from "@front/App.vue";
import { initGlobalComp } from "@front/components/injector";
import { registerMethod } from "@front/util_function/globalRegister";
import { createApp, h } from "vue";


// const routings = await (await import("@front/router/electronRouting")).getElectronRouting();
// console.log(routings);

// 可能是 rollup 的 bug 导致了如下问题：在 production 打包时，入口文件以及其所 import
// 的 module 均不能出现 top-level await，否则 await 将永远等待
// 所以需要这样的 workaround。

// 注：vite 在 dev server 模式采用 esbuild，在打包时使用 rollup。
// 所以，對於有關包管理 / js 特性的代碼，能在 dev server 環境中運行不代表就能在
// production 環境中運行。

// 应用程序入口点
async function main() {
	const app = createApp({
		render: () => h(App)
	})
		.use(ElementPlus)
		.use(await createRouter())
		.use(store);
	for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
		app.component(key, component);
	}
	initGlobalComp(app);
	registerMethod();
	app.mount("body");
}

main();

// console.log("main.ts: router:");
// console.log(router);


