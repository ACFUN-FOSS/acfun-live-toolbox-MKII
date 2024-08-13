import { rmSync } from "node:fs";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import { notBundle } from "vite-plugin-electron/plugin";
import pkg from "./package.json";
import path from "path";
import { exec } from "child_process";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
	rmSync("dist-electron", { recursive: true, force: true });

	const isServe = command === "serve";
	const isBuild = command === "build";
	const sourcemap = isServe || !!process.env.VSCODE_DEBUG;
	if (isServe) {
		//网页插件，默认5173端口
	}
	if (isBuild) {
		//把小模块一起打包了
		exec('cmd /K "cd ./src/api/appLink && npm run build"');
	}

	return {
		// 解決 vite 每次啓動 dev server 都會 “new dependencies optimized: xxx” 某些包
		// 且强制 reload 的問題。
		optimizeDeps: {
			include: [
				"lodash/replace",
				"lodash/random",
				"lodash/throttle",
				"lodash/sampleSize",
				"lodash/sample",
				"@lljj/vue3-form-element",
				"obs-websocket-js",
				"path",
				"file-saver",
				"date-fns",
				"date-fns/format",
				"lodash/debounce",
				"vue/dist/vue.esm-bundler.js",
			],
		},
		plugins: [
			vue(),
			electron([
				{
					// Main process entry file of the Electron App.
					entry: "electron/main/index.ts",
					onstart({ startup }) {
						if (process.env.VSCODE_DEBUG) {
							console.log(
								/* For `.vscode/.debug.script.mjs` */ "[startup] Electron App"
							);
						} else {
							startup();
						}
					},
					vite: {
						build: {
							sourcemap,
							minify: isBuild,
							outDir: "dist-electron/main",
							rollupOptions: {
								// Some third-party Node.js libraries may not be built correctly by Vite, especially `C/C++` addons,
								// we can use `external` to exclude them to ensure they work correctly.
								// Others need to put them in `dependencies` to ensure they are collected into `app.asar` after the app is built.
								// Of course, this is not absolute, just this way is relatively simple. :)
								external: Object.keys(
									"dependencies" in pkg
										? pkg.dependencies
										: {}
								),
							},
						},
						plugins: [
							// This is just an option to improve build performance, it's non-deterministic!
							// e.g. `import log from 'electron-log'` -> `const log = require('electron-log')`
							isServe && notBundle(),
						],
					},
				},
				{
					entry: "electron/preload/index.ts",
					onstart({ reload }) {
						// Notify the Renderer process to reload the page when the Preload scripts build is complete,
						// instead of restarting the entire Electron App.
						reload();
					},
					vite: {
						build: {
							sourcemap: sourcemap ? "inline" : undefined, // #332
							minify: isBuild,
							outDir: "dist-electron/preload",
							rollupOptions: {
								external: Object.keys(
									"dependencies" in pkg
										? pkg.dependencies
										: {}
								),
							},
						},
						plugins: [isServe && notBundle()],
					},
				},
			]),
			// Use Node.js API in the Renderer process
			renderer(),
		],
		resolve: {
			alias: {
				"@front": path.resolve(__dirname, "./src"),
				"@back": path.resolve(__dirname, "./electron"),
				"@appLink":path.resolve(__dirname,"./src/api/appLink")
			},
		},
		server:
			process.env.VSCODE_DEBUG &&
			(() => {
				const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
				return {
					host: url.hostname,
					port: +url.port,
				};
			})(),
		clearScreen: false,
		build: {
			target: "esnext",
			rollupOptions: {
				// build 時候忽略 test 目录
				external: new RegExp("/src/test/.*"),
			},
		},
	};
});
